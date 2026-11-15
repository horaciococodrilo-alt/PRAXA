-- PRAXA 0023 — Tiendanube: proveedor, credencial por proveedor, datos de la tienda,
-- agregados, sincronización, privacidad y purga (M16e, etapa .1).
--
-- Meta y Tiendanube coexisten en una empresa: una conexión viva por empresa Y proveedor
-- (CA-18 enmendado). Toda escritura de Tiendanube pasa por `worker_api`; los usuarios leen
-- solo agregados, por RLS y mediante funciones `public` SECURITY INVOKER. Las tablas con
-- datos de pedidos, clientes y catálogo viven en `private`, sin grants para nadie.
--
-- MATRIZ DE PRIVILEGIOS DE LOS OBJETOS NUEVOS (M16e §2; la prueba es 18_tiendanube)
--
--   objeto                                  | anon | authenticated   | rol de C          | PUBLIC   | service_role
--   ----------------------------------------+------+-----------------+-------------------+----------+-------------
--   public.tn_sync_status                   | —    | SELECT por RLS  | —                 | —        | —
--   public.tn_sales_daily                   | —    | SELECT por RLS  | —                 | —        | —
--   public.tn_product_units_daily           | —    | SELECT por RLS  | —                 | —        | —
--   public.tn_cohort_cells                  | —    | SELECT por RLS  | —                 | —        | —
--   private.tn_sync_runs, tn_orders,        | —    | —               | —                 | —        | —
--     tn_order_lines, tn_customers,         |      |                 |                   |          |
--     tn_products, tn_product_variants,     |      |                 |                   |          |
--     tn_redaction_suppressions             |      |                 |                   |          |
--   public.get_tn_sync_status,              | —    | EXECUTE         | —                 | revocado | —
--     get_tn_sales, get_tn_product_units,   |      | (INVOKER)       |                   |          |
--     get_tn_cohorts                        |      |                 |                   |          |
--   worker_api.tn_start_sync,               | —    | —               | EXECUTE           | revocado | —
--     tn_publish_orders, tn_publish_catalog,|      |                 |                   |          |
--     tn_finish_sync, tn_fail_sync          |      |                 |                   |          |
--   worker_api.tn_privacy_store_redact,     | —    | —               | EXECUTE           | revocado | —
--     tn_privacy_customer_redact            |      |                 |                   |          |
--   helpers private.tn_* y                  | —    | —               | —                 | revocado | —
--     private.valid_provider_scopes,        |      |                 |                   |          |
--     private.meta_assert_meta_connection   |      |                 |                   |          |
--
-- Las funciones de worker_api que cambian de firma (`create_oauth_attempt`,
-- `consume_oauth_attempt`, `create_pending_connection`, `list_pending_purges`) se recrean:
-- la firma vieja se borra con sus grants y la nueva vuelve a conceder EXECUTE solo al rol
-- de C. `confirm_connection`, `replace_credential`, `purge_connection` y
-- `raise_worker_integrity_error` conservan firma y se reemplazan.
--
-- EXCEPCIÓN A INV-01 (D-M16e-14, D-M16e-27). `tn_privacy_store_redact` y
-- `tn_privacy_customer_redact` no reciben actor: las llama el handler de un webhook con la
-- firma de Tiendanube verificada. Resuelven por (proveedor, ID de tienda) todas las
-- conexiones de esa tienda, en cualquier empresa y estado; solo marcan como desconectadas,
-- quitan credenciales y borran; nunca activan ni devuelven datos, solo la fase
-- (`marked`, `more`, `done`). Toman el mismo cerrojo de empresa que la publicación.
--
-- CATÁLOGO DE ERRORES: se reutilizan PX001–PX011. No hay códigos nuevos.
--
-- ENUM. `alter type ... add value` no se puede usar en la misma transacción en que se
-- agrega, así que el tipo se recrea con los dos valores y las dos columnas se convierten.
-- Sus únicas dependencias son esas columnas y sus defaults. El default 'meta' desaparece:
-- todo flujo nombra su proveedor.

-- ---------------------------------------------------------------------------
-- Proveedor
-- ---------------------------------------------------------------------------

alter type public.integration_provider rename to integration_provider_0012;
create type public.integration_provider as enum ('meta', 'tiendanube');

alter table public.integration_connections alter column provider drop default;
alter table public.integration_connections
  alter column provider type public.integration_provider
  using provider::text::public.integration_provider;

alter table public.oauth_attempts alter column provider drop default;
alter table public.oauth_attempts
  alter column provider type public.integration_provider
  using provider::text::public.integration_provider;

drop type public.integration_provider_0012;

-- CA-18 enmendado: una conexión viva por empresa y proveedor.
drop index public.integration_connections_one_live_per_company;
create unique index integration_connections_one_live_per_provider
  on public.integration_connections (company_id, provider)
  where status in ('pending_selection', 'active', 'needs_reauth');

-- Destino de las FK que además fijan el proveedor (credencial e intento de reautorización).
alter table public.integration_connections
  add constraint integration_connections_company_id_id_provider_key
  unique (company_id, id, provider);

-- Una conexión de Tiendanube no tiene negocio de Meta ni estado de sincronización de Meta,
-- y su cuenta es el ID numérico de la tienda.
alter table public.integration_connections
  add constraint integration_connections_provider_shape
  check (provider::text = 'meta'
         or (provider::text = 'tiendanube'
             and client_business_id is null
             and meta_sync_summary is null
             and current_sync_run_id is null
             and (external_account_id is null
                  or external_account_id ~ '^[1-9][0-9]{0,19}$')));

alter table public.oauth_attempts
  add constraint oauth_attempts_expected_connection_provider_fkey
  foreign key (company_id, expected_connection_id, provider)
  references public.integration_connections (company_id, id, provider) on delete cascade;

-- ---------------------------------------------------------------------------
-- Credencial por proveedor (K04, CA-11c enmendado)
-- ---------------------------------------------------------------------------

-- Meta: la regla de 0012 (incluye `ads_read`). Tiendanube: exactamente los tres `read_*`.
create function private.valid_provider_scopes(p_provider text, p_scopes text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(case p_provider
    when 'meta' then private.valid_granted_scopes(p_scopes)
    when 'tiendanube' then
      p_scopes is not null
      and pg_catalog.array_ndims(p_scopes) = 1
      and pg_catalog.cardinality(p_scopes) = 3
      and pg_catalog.array_position(p_scopes, null) is null
      and (select pg_catalog.count(distinct s) = 3
                  and pg_catalog.bool_and(s in ('read_customers', 'read_orders', 'read_products'))
             from pg_catalog.unnest(p_scopes) as s)
    else false end, false)
$$;

revoke all on function private.valid_provider_scopes(text, text[])
  from public, anon, authenticated, service_role;

alter table private.integration_credentials add column provider public.integration_provider;

-- Las credenciales existentes son de Meta: se copia el proveedor de su conexión, sin tocar
-- el material cifrado.
update private.integration_credentials k
   set provider = c.provider
  from public.integration_connections c
 where c.id = k.connection_id
   and c.company_id = k.company_id;

alter table private.integration_credentials alter column provider set not null;

alter table private.integration_credentials
  drop constraint integration_credentials_token_type,
  drop constraint integration_credentials_scopes;

alter table private.integration_credentials
  add constraint integration_credentials_provider_fkey
    foreign key (company_id, connection_id, provider)
    references public.integration_connections (company_id, id, provider) on delete cascade,
  add constraint integration_credentials_token_type
    check ((provider::text = 'meta' and token_type = 'system_user')
           or (provider::text = 'tiendanube' and token_type = 'store_app_token'
               and expires_at is null)),
  add constraint integration_credentials_scopes
    check (private.valid_provider_scopes(provider::text, granted_scopes));

-- ---------------------------------------------------------------------------
-- Los objetos de Meta solo aceptan conexiones de Meta
-- ---------------------------------------------------------------------------

-- Toda escritura de la sincronización de Meta exige una ejecución propia, y todo informe del
-- diagnóstico de Meta, una reserva: con estas guardas, un error del servidor que pase el id
-- de una conexión de Tiendanube no escribe nada de Meta. Una conexión inexistente o de otra
-- empresa sigue fallando por su FK, como antes.
create function private.meta_assert_meta_connection()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.integration_connections c
     where c.id = new.connection_id
       and c.company_id = new.company_id
       and c.provider::text <> 'meta'
  ) then
    raise exception 'praxa: operación no autorizada' using errcode = 'PX001';
  end if;
  return new;
end;
$$;

revoke all on function private.meta_assert_meta_connection()
  from public, anon, authenticated, service_role;

create trigger meta_sync_runs_meta_only
  before insert on public.meta_sync_runs
  for each row execute function private.meta_assert_meta_connection();
create trigger meta_diagnostic_reservations_meta_only
  before insert on private.meta_diagnostic_reservations
  for each row execute function private.meta_assert_meta_connection();
create trigger diagnostic_reports_meta_only
  before insert on public.diagnostic_reports
  for each row execute function private.meta_assert_meta_connection();

-- ---------------------------------------------------------------------------
-- Tablas privadas de Tiendanube
-- ---------------------------------------------------------------------------

-- Ejecuciones (un paso de sincronización). La posesión es (id, lease, generación).
create table private.tn_sync_runs (
  id                    uuid primary key,
  company_id            uuid not null,
  connection_id         uuid not null,
  credential_generation integer not null,
  lease_token           uuid not null,
  phase                 text not null,
  started_at            timestamptz not null,
  lease_expires_at      timestamptz not null,
  finished_at           timestamptz,
  status                text not null,
  error_kind            text,
  fetched_at            timestamptz,

  constraint tn_sync_runs_connection_fkey
    foreign key (company_id, connection_id)
    references public.integration_connections (company_id, id) on delete cascade,
  constraint tn_sync_runs_generation check (credential_generation >= 0),
  constraint tn_sync_runs_phase check (phase in ('backfill', 'incremental')),
  constraint tn_sync_runs_status
    check (status in ('running', 'complete', 'incomplete', 'failed', 'superseded')),
  constraint tn_sync_runs_finished check ((status = 'running') = (finished_at is null)),
  constraint tn_sync_runs_lease check (lease_expires_at > started_at),
  constraint tn_sync_runs_error_kind
    check ((status = 'failed') = (error_kind is not null)
           and (error_kind is null or error_kind in (
             'credencial_invalida', 'permiso_faltante', 'tienda_suspendida',
             'solicitud_invalida', 'campo_invalido', 'cuota', 'transitorio', 'transporte',
             'no_encontrado', 'desconocido')))
);

create unique index tn_sync_runs_one_running
  on private.tn_sync_runs (connection_id) where status = 'running';
create index tn_sync_runs_connection_idx on private.tn_sync_runs (company_id, connection_id);

-- Cliente: solo el identificador opaco (M16e §2).
create table private.tn_customers (
  company_id           uuid not null,
  connection_id        uuid not null,
  external_customer_id text not null,

  constraint tn_customers_pkey primary key (connection_id, external_customer_id),
  constraint tn_customers_company_key unique (company_id, connection_id, external_customer_id),
  constraint tn_customers_connection_fkey
    foreign key (company_id, connection_id)
    references public.integration_connections (company_id, id) on delete cascade,
  constraint tn_customers_id_format check (external_customer_id ~ '^[1-9][0-9]{0,19}$')
);

-- Pedido: estado vigente únicamente (D-M16e-16). `local_day`, `eligible` y
-- `partially_paid` se calculan al publicar, con la zona de la tienda (§3).
create table private.tn_orders (
  company_id              uuid not null,
  connection_id           uuid not null,
  external_order_id       text not null,
  external_customer_id    text,
  status                  text not null,
  payment_status          text not null,
  created_at              timestamptz not null,
  source_updated_at       timestamptz not null,
  paid_at                 timestamptz,
  closed_at               timestamptz,
  cancelled_at            timestamptz,
  currency                text not null,
  subtotal                numeric,
  discount                numeric,
  total                   numeric not null,
  total_paid_by_customer  numeric,
  storefront              text,
  cancel_reason           text,
  is_subscription         boolean,
  is_subscription_initial boolean,
  refunded_amount         numeric,
  local_day               date not null,
  eligible                boolean not null,
  partially_paid          boolean not null,

  constraint tn_orders_pkey primary key (connection_id, external_order_id),
  constraint tn_orders_company_key unique (company_id, connection_id, external_order_id),
  constraint tn_orders_connection_fkey
    foreign key (company_id, connection_id)
    references public.integration_connections (company_id, id) on delete cascade,
  constraint tn_orders_customer_fkey
    foreign key (company_id, connection_id, external_customer_id)
    references private.tn_customers (company_id, connection_id, external_customer_id),
  constraint tn_orders_id_format check (external_order_id ~ '^[1-9][0-9]{0,19}$'),
  constraint tn_orders_status check (status in ('open', 'closed', 'cancelled')),
  constraint tn_orders_payment_status
    check (payment_status in ('authorized', 'pending', 'paid', 'partially_paid', 'abandoned',
                              'refunded', 'partially_refunded', 'voided')),
  constraint tn_orders_currency check (currency ~ '^[A-Z]{3}$'),
  constraint tn_orders_amounts
    check (total >= 0 and (subtotal is null or subtotal >= 0)
           and (discount is null or discount >= 0)
           and (total_paid_by_customer is null or total_paid_by_customer >= 0)
           and (refunded_amount is null or refunded_amount >= 0)),
  constraint tn_orders_storefront
    check (storefront is null or storefront ~ '^[A-Za-z0-9_-]{1,32}$'),
  constraint tn_orders_cancel_reason
    check (cancel_reason is null or cancel_reason ~ '^[A-Za-z0-9_ -]{1,64}$'),
  constraint tn_orders_eligibility
    check (eligible = (payment_status in ('paid', 'partially_refunded') and status <> 'cancelled')
           and partially_paid = (payment_status = 'partially_paid' and status <> 'cancelled'))
);

create index tn_orders_customer_idx
  on private.tn_orders (connection_id, external_customer_id) where external_customer_id is not null;
create index tn_orders_day_idx on private.tn_orders (connection_id, local_day);

-- Líneas: se reemplazan enteras con su pedido.
create table private.tn_order_lines (
  company_id          uuid not null,
  connection_id       uuid not null,
  external_order_id   text not null,
  line_no             integer not null,
  external_product_id text,
  external_variant_id text,
  name                text not null,
  price               numeric not null,
  quantity            integer not null,

  constraint tn_order_lines_pkey primary key (connection_id, external_order_id, line_no),
  constraint tn_order_lines_order_fkey
    foreign key (company_id, connection_id, external_order_id)
    references private.tn_orders (company_id, connection_id, external_order_id) on delete cascade,
  constraint tn_order_lines_line_no check (line_no between 1 and 1000),
  constraint tn_order_lines_product_format
    check (external_product_id is null or external_product_id ~ '^[1-9][0-9]{0,19}$'),
  constraint tn_order_lines_variant_format
    check (external_variant_id is null or external_variant_id ~ '^[1-9][0-9]{0,19}$'),
  constraint tn_order_lines_name check (char_length(name) between 1 and 500),
  constraint tn_order_lines_price check (price >= 0),
  constraint tn_order_lines_quantity check (quantity between 1 and 1000000)
);

-- Catálogo. La clave interna (`id`) es la que llega a los agregados, nunca el ID externo.
-- Un producto que solo se vio en una línea queda con `last_seen_at` nulo hasta que lo
-- confirme el catálogo; al cerrar un recorrido completo, el que no se vio queda eliminado.
create table private.tn_products (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null,
  connection_id       uuid not null,
  external_product_id text not null,
  name                text not null,
  visibility          text,
  deleted             boolean not null default false,
  last_seen_at        timestamptz,

  constraint tn_products_external_key unique (connection_id, external_product_id),
  constraint tn_products_company_key unique (company_id, connection_id, id),
  constraint tn_products_connection_fkey
    foreign key (company_id, connection_id)
    references public.integration_connections (company_id, id) on delete cascade,
  constraint tn_products_id_format check (external_product_id ~ '^[1-9][0-9]{0,19}$'),
  constraint tn_products_name check (char_length(name) between 1 and 500),
  constraint tn_products_visibility check (visibility in ('visible', 'unlisted', 'hidden'))
);

create table private.tn_product_variants (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null,
  connection_id       uuid not null,
  product_id          uuid not null,
  external_variant_id text not null,
  sku                 text,
  last_seen_at        timestamptz,

  constraint tn_product_variants_external_key unique (connection_id, external_variant_id),
  constraint tn_product_variants_product_fkey
    foreign key (company_id, connection_id, product_id)
    references private.tn_products (company_id, connection_id, id) on delete cascade,
  constraint tn_product_variants_id_format check (external_variant_id ~ '^[1-9][0-9]{0,19}$'),
  constraint tn_product_variants_sku check (sku is null or char_length(sku) between 1 and 100)
);

-- Supresión por pedido de `customer/redact` (D-M16e-17, D-M16e-30), sin PII.
create table private.tn_redaction_suppressions (
  company_id           uuid not null,
  connection_id        uuid not null,
  external_customer_id text not null,
  external_order_id    text not null,
  created_at           timestamptz not null default now(),

  constraint tn_redaction_suppressions_pkey primary key (connection_id, external_order_id),
  constraint tn_redaction_suppressions_connection_fkey
    foreign key (company_id, connection_id)
    references public.integration_connections (company_id, id) on delete cascade,
  constraint tn_redaction_suppressions_customer_format
    check (external_customer_id ~ '^[1-9][0-9]{0,19}$'),
  constraint tn_redaction_suppressions_order_format
    check (external_order_id ~ '^[1-9][0-9]{0,19}$')
);

create index tn_redaction_suppressions_customer_idx
  on private.tn_redaction_suppressions (connection_id, external_customer_id);

-- ---------------------------------------------------------------------------
-- Agregados públicos (solo los escribe worker_api; se leen por RLS)
-- ---------------------------------------------------------------------------

-- Estado de la sincronización, checkpoint durable y cobertura (§3). Sin IDs externos.
create table public.tn_sync_status (
  connection_id                uuid primary key,
  company_id                   uuid not null,
  phase                        text not null,
  watermark                    timestamptz not null,
  backfill_next                date,
  backfill_done_at             timestamptz,
  incremental_checkpoint       timestamptz,
  coverage_until               timestamptz,
  catalog_next_page            integer,
  catalog_traversal_started_at timestamptz,
  catalog_complete_at          timestamptz,
  store_domain                 text,
  store_country                text,
  last_run_started_at          timestamptz,
  last_run_finished_at         timestamptz,
  last_run_status              text,
  last_error_kind              text,
  last_fetched_at              timestamptz,
  updated_at                   timestamptz not null default now(),

  constraint tn_sync_status_connection_fkey
    foreign key (company_id, connection_id)
    references public.integration_connections (company_id, id) on delete cascade,
  constraint tn_sync_status_phase check (phase in ('backfill', 'incremental')),
  constraint tn_sync_status_incremental
    check (phase = 'backfill'
           or (backfill_done_at is not null and incremental_checkpoint is not null)),
  constraint tn_sync_status_coverage check (coverage_until is null or phase = 'incremental'),
  constraint tn_sync_status_catalog_page check (catalog_next_page is null or catalog_next_page >= 2),
  constraint tn_sync_status_domain
    check (store_domain is null or store_domain ~ '^[A-Za-z0-9.-]{1,253}$'),
  constraint tn_sync_status_country check (store_country is null or store_country ~ '^[A-Z]{2}$'),
  constraint tn_sync_status_last_status
    check (last_run_status is null
           or last_run_status in ('running', 'complete', 'incomplete', 'failed')),
  constraint tn_sync_status_last_error check (last_error_kind is null or last_error_kind in (
    'credencial_invalida', 'permiso_faltante', 'tienda_suspendida', 'solicitud_invalida',
    'campo_invalido', 'cuota', 'transitorio', 'transporte', 'no_encontrado', 'desconocido'))
);

create unique index tn_sync_status_company_connection_key
  on public.tn_sync_status (company_id, connection_id);

-- Ventas por día local y moneda (§2). Una fila solo si hay algún pedido que contar.
create table public.tn_sales_daily (
  company_id                   uuid not null,
  connection_id                uuid not null,
  day                          date not null,
  currency                     text not null,
  paid_orders                  integer not null,
  paid_orders_without_customer integer not null,
  partially_paid_orders        integer not null,
  paid_amount                  numeric not null,
  refunded_amount              numeric not null,

  constraint tn_sales_daily_pkey primary key (connection_id, day, currency),
  constraint tn_sales_daily_connection_fkey
    foreign key (company_id, connection_id)
    references public.integration_connections (company_id, id) on delete cascade,
  constraint tn_sales_daily_currency check (currency ~ '^[A-Z]{3}$'),
  constraint tn_sales_daily_counts
    check (paid_orders >= 0 and partially_paid_orders >= 0
           and paid_orders_without_customer between 0 and paid_orders
           and paid_orders + partially_paid_orders > 0),
  constraint tn_sales_daily_amounts check (paid_amount >= 0 and refunded_amount >= 0)
);

-- Unidades por día local, producto y variante, con claves internas (§2, D-M16e-19).
create table public.tn_product_units_daily (
  company_id    uuid not null,
  connection_id uuid not null,
  day           date not null,
  product_key   uuid not null,
  variant_key   uuid,
  name          text not null,
  sku           text,
  deleted       boolean not null,
  units         bigint not null,

  constraint tn_product_units_daily_key
    unique nulls not distinct (connection_id, day, product_key, variant_key),
  constraint tn_product_units_daily_connection_fkey
    foreign key (company_id, connection_id)
    references public.integration_connections (company_id, id) on delete cascade,
  constraint tn_product_units_daily_name check (char_length(name) between 1 and 500),
  constraint tn_product_units_daily_units check (units > 0)
);

-- Cohortes (§5). La regla de cinco se aplica AL ESCRIBIR: ningún conteo menor que cinco
-- llega a la tabla (D-M16e-11, D-M16e-20).
create table public.tn_cohort_cells (
  company_id    uuid not null,
  connection_id uuid not null,
  cohort_month  date not null,
  month_offset  integer not null,
  cohort_size   integer,
  active        integer,
  size_hidden   boolean not null,
  active_hidden boolean not null,
  partial       boolean not null,

  constraint tn_cohort_cells_pkey primary key (connection_id, cohort_month, month_offset),
  constraint tn_cohort_cells_connection_fkey
    foreign key (company_id, connection_id)
    references public.integration_connections (company_id, id) on delete cascade,
  constraint tn_cohort_cells_month check (cohort_month = pg_catalog.date_trunc('month', cohort_month)::date),
  constraint tn_cohort_cells_offset check (month_offset >= 0),
  constraint tn_cohort_cells_minimum
    check ((cohort_size is null or cohort_size >= 5) and (active is null or active >= 5)),
  constraint tn_cohort_cells_hidden
    check (size_hidden = (cohort_size is null)
           and active_hidden = (active is null)
           and (not size_hidden or active_hidden)
           and (active is null or cohort_size is null or active <= cohort_size))
);

-- ---------------------------------------------------------------------------
-- RLS y privilegios de tablas
-- ---------------------------------------------------------------------------

revoke all on private.tn_sync_runs from public, anon, authenticated, service_role;
revoke all on private.tn_customers from public, anon, authenticated, service_role;
revoke all on private.tn_orders from public, anon, authenticated, service_role;
revoke all on private.tn_order_lines from public, anon, authenticated, service_role;
revoke all on private.tn_products from public, anon, authenticated, service_role;
revoke all on private.tn_product_variants from public, anon, authenticated, service_role;
revoke all on private.tn_redaction_suppressions from public, anon, authenticated, service_role;
revoke all on public.tn_sync_status from public, anon, authenticated, service_role;
revoke all on public.tn_sales_daily from public, anon, authenticated, service_role;
revoke all on public.tn_product_units_daily from public, anon, authenticated, service_role;
revoke all on public.tn_cohort_cells from public, anon, authenticated, service_role;

alter table private.tn_sync_runs enable row level security;
alter table private.tn_sync_runs force row level security;
alter table private.tn_customers enable row level security;
alter table private.tn_customers force row level security;
alter table private.tn_orders enable row level security;
alter table private.tn_orders force row level security;
alter table private.tn_order_lines enable row level security;
alter table private.tn_order_lines force row level security;
alter table private.tn_products enable row level security;
alter table private.tn_products force row level security;
alter table private.tn_product_variants enable row level security;
alter table private.tn_product_variants force row level security;
alter table private.tn_redaction_suppressions enable row level security;
alter table private.tn_redaction_suppressions force row level security;
alter table public.tn_sync_status enable row level security;
alter table public.tn_sync_status force row level security;
alter table public.tn_sales_daily enable row level security;
alter table public.tn_sales_daily force row level security;
alter table public.tn_product_units_daily enable row level security;
alter table public.tn_product_units_daily force row level security;
alter table public.tn_cohort_cells enable row level security;
alter table public.tn_cohort_cells force row level security;

-- Membresía del JWT y conexión de Tiendanube vigente (`active` o `needs_reauth`).
create policy tn_sync_status_select_member
  on public.tn_sync_status for select to authenticated
  using (private.is_company_member(company_id) and exists (
    select 1 from public.integration_connections c
     where c.id = tn_sync_status.connection_id and c.company_id = tn_sync_status.company_id
       and c.provider::text = 'tiendanube' and c.status in ('active', 'needs_reauth')));

create policy tn_sales_daily_select_member
  on public.tn_sales_daily for select to authenticated
  using (private.is_company_member(company_id) and exists (
    select 1 from public.integration_connections c
     where c.id = tn_sales_daily.connection_id and c.company_id = tn_sales_daily.company_id
       and c.provider::text = 'tiendanube' and c.status in ('active', 'needs_reauth')));

create policy tn_product_units_daily_select_member
  on public.tn_product_units_daily for select to authenticated
  using (private.is_company_member(company_id) and exists (
    select 1 from public.integration_connections c
     where c.id = tn_product_units_daily.connection_id
       and c.company_id = tn_product_units_daily.company_id
       and c.provider::text = 'tiendanube' and c.status in ('active', 'needs_reauth')));

create policy tn_cohort_cells_select_member
  on public.tn_cohort_cells for select to authenticated
  using (private.is_company_member(company_id) and exists (
    select 1 from public.integration_connections c
     where c.id = tn_cohort_cells.connection_id and c.company_id = tn_cohort_cells.company_id
       and c.provider::text = 'tiendanube' and c.status in ('active', 'needs_reauth')));

grant select on public.tn_sync_status to authenticated;
grant select on public.tn_sales_daily to authenticated;
grant select on public.tn_product_units_daily to authenticated;
grant select on public.tn_cohort_cells to authenticated;

-- ---------------------------------------------------------------------------
-- Helpers privados
-- ---------------------------------------------------------------------------

-- Traduce violaciones de integridad. Reemplaza la de 0016 con el índice nuevo de conexión
-- viva y las restricciones de las ejecuciones de Tiendanube.
create or replace function private.raise_worker_integrity_error(p_constraint_name text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_constraint_name = 'integration_connections_account_key' then
    raise exception 'praxa: la cuenta ya está vinculada' using errcode = 'PX007';
  elsif p_constraint_name in ('integration_connections_one_live_per_provider',
                              'integration_connections_one_live_per_company') then
    raise exception 'praxa: la empresa ya tiene una conexión' using errcode = 'PX003';
  elsif p_constraint_name in ('integration_connections_pkey', 'meta_sync_runs_pkey',
                              'tn_sync_runs_pkey') then
    raise exception 'praxa: operación no autorizada' using errcode = 'PX001';
  elsif p_constraint_name in ('meta_sync_runs_one_running', 'tn_sync_runs_one_running') then
    raise exception 'praxa: ya hay una sincronización en curso' using errcode = 'PX009';
  else
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;
end;
$$;

-- Día local de la tienda (§3): `paid_at` o, si es nulo, `created_at`, en la zona de K03.
create function private.tn_local_day(p_paid_at timestamptz, p_created_at timestamptz, p_timezone text)
returns date
language sql
immutable
set search_path = ''
as $$
  select (coalesce(p_paid_at, p_created_at) at time zone p_timezone)::date
$$;

-- Último día local cubierto completo: el anterior al día del instante de cobertura.
create function private.tn_covered_through(p_coverage_until timestamptz, p_timezone text)
returns date
language sql
immutable
set search_path = ''
as $$
  select case when p_coverage_until is null then null
              else (p_coverage_until at time zone p_timezone)::date - 1 end
$$;

-- Recalcula ventas y unidades de los días indicados (A-06).
create function private.tn_recalc_days(p_connection_id uuid, p_days date[])
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_days is null or pg_catalog.cardinality(p_days) = 0 then
    return;
  end if;

  delete from public.tn_sales_daily s
   where s.connection_id = p_connection_id and s.day = any (p_days);

  insert into public.tn_sales_daily
    (company_id, connection_id, day, currency, paid_orders, paid_orders_without_customer,
     partially_paid_orders, paid_amount, refunded_amount)
  select o.company_id, o.connection_id, o.local_day, o.currency,
         (pg_catalog.count(*) filter (where o.eligible))::integer,
         (pg_catalog.count(*) filter (where o.eligible and o.external_customer_id is null))::integer,
         (pg_catalog.count(*) filter (where o.partially_paid))::integer,
         coalesce(pg_catalog.sum(o.total_paid_by_customer) filter (where o.eligible), 0),
         coalesce(pg_catalog.sum(o.refunded_amount) filter (where o.eligible), 0)
    from private.tn_orders o
   where o.connection_id = p_connection_id and o.local_day = any (p_days)
   group by o.company_id, o.connection_id, o.local_day, o.currency
  having pg_catalog.count(*) filter (where o.eligible or o.partially_paid) > 0;

  delete from public.tn_product_units_daily u
   where u.connection_id = p_connection_id and u.day = any (p_days);

  insert into public.tn_product_units_daily
    (company_id, connection_id, day, product_key, variant_key, name, sku, deleted, units)
  select o.company_id, o.connection_id, o.local_day, p.id, v.id, p.name, v.sku, p.deleted,
         pg_catalog.sum(l.quantity)
    from private.tn_orders o
    join private.tn_order_lines l
      on l.connection_id = o.connection_id and l.external_order_id = o.external_order_id
    join private.tn_products p
      on p.connection_id = o.connection_id and p.external_product_id = l.external_product_id
    left join private.tn_product_variants v
      on v.connection_id = o.connection_id and v.external_variant_id = l.external_variant_id
     and v.product_id = p.id
   where o.connection_id = p_connection_id and o.local_day = any (p_days) and o.eligible
   group by o.company_id, o.connection_id, o.local_day, p.id, v.id, p.name, v.sku, p.deleted;
end;
$$;

-- Recalcula todas las cohortes de la conexión (§5). La regla de cinco va acá.
create function private.tn_recalc_cohorts(p_connection_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_company_id uuid;
  v_timezone   text;
  v_through    date;
begin
  select c.company_id, c.timezone,
         private.tn_covered_through(s.coverage_until, c.timezone)
    into v_company_id, v_timezone, v_through
    from public.integration_connections c
    left join public.tn_sync_status s on s.connection_id = c.id
   where c.id = p_connection_id;

  delete from public.tn_cohort_cells x where x.connection_id = p_connection_id;

  if v_company_id is null then
    return;
  end if;

  insert into public.tn_cohort_cells
    (company_id, connection_id, cohort_month, month_offset, cohort_size, active,
     size_hidden, active_hidden, partial)
  with months as (
    select o.external_customer_id as customer,
           pg_catalog.date_trunc('month', o.local_day)::date as mon
      from private.tn_orders o
     where o.connection_id = p_connection_id and o.eligible
       and o.external_customer_id is not null
     group by 1, 2
  ), firsts as (
    select m.customer, pg_catalog.min(m.mon) as cohort from months m group by m.customer
  ), sizes as (
    select f.cohort, pg_catalog.count(*)::integer as n from firsts f group by f.cohort
  ), actives as (
    select f.cohort,
           ((pg_catalog.date_part('year', m.mon) - pg_catalog.date_part('year', f.cohort)) * 12
             + pg_catalog.date_part('month', m.mon) - pg_catalog.date_part('month', f.cohort))::integer
             as k,
           pg_catalog.count(*)::integer as a
      from firsts f join months m on m.customer = f.customer
     group by 1, 2
  ), last_month as (
    select pg_catalog.max(m.mon) as mon from months m
  ), grid as (
    select s.cohort, s.n, g.k
      from sizes s
     cross join last_month lm
     cross join lateral pg_catalog.generate_series(0,
       ((pg_catalog.date_part('year', lm.mon) - pg_catalog.date_part('year', s.cohort)) * 12
         + pg_catalog.date_part('month', lm.mon) - pg_catalog.date_part('month', s.cohort))::integer)
       as g(k)
  )
  select v_company_id, p_connection_id, g.cohort, g.k,
         case when g.n >= 5 then g.n end,
         case when g.n >= 5 and coalesce(a.a, 0) >= 5 then a.a end,
         g.n < 5,
         g.n < 5 or coalesce(a.a, 0) < 5,
         v_through is null
           or (g.cohort + pg_catalog.make_interval(months => g.k + 1))::date - 1 > v_through
    from grid g
    left join actives a on a.cohort = g.cohort and a.k = g.k;
end;
$$;

-- Posesión de una ejecución de Tiendanube: id, conexión, lease, generación, vigencia.
create function private.tn_locked_run(
  p_connection public.integration_connections, p_run_id uuid, p_lease_token uuid,
  p_generation integer)
returns private.tn_sync_runs
language plpgsql
set search_path = ''
as $$
declare
  v_run private.tn_sync_runs;
begin
  select r.* into v_run
    from private.tn_sync_runs r
   where r.id = p_run_id
     and r.connection_id = p_connection.id
     and r.company_id = p_connection.company_id
     and r.lease_token = p_lease_token
   for update;

  if not found then
    raise exception 'praxa: la sincronización venció o fue reemplazada' using errcode = 'PX010';
  end if;
  if p_connection.status <> 'active' then
    raise exception 'praxa: transición de estado no permitida' using errcode = 'PX004';
  end if;
  if p_connection.credential_generation <> p_generation then
    raise exception 'praxa: la credencial cambió; volvé a empezar' using errcode = 'PX006';
  end if;
  if v_run.credential_generation <> p_generation or v_run.status <> 'running'
     or v_run.lease_expires_at <= pg_catalog.clock_timestamp() then
    raise exception 'praxa: la sincronización venció o fue reemplazada' using errcode = 'PX010';
  end if;
  return v_run;
end;
$$;

-- Conexión de Tiendanube de la empresa, bloqueada. Una conexión ajena, inexistente o de
-- otro proveedor da PX001, sin distinguir.
create function private.tn_locked_connection(p_company_id uuid, p_connection_id uuid)
returns public.integration_connections
language plpgsql
set search_path = ''
as $$
declare
  v_connection public.integration_connections;
begin
  select c.* into v_connection
    from public.integration_connections c
   where c.id = p_connection_id and c.company_id = p_company_id
   for update;
  if not found or v_connection.provider::text <> 'tiendanube' then
    raise exception 'praxa: operación no autorizada' using errcode = 'PX001';
  end if;
  return v_connection;
end;
$$;

-- Borra los pedidos con marca de supresión que sigan presentes y recalcula (§4).
create function private.tn_drop_suppressed(p_connection_id uuid)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_days    date[];
  v_deleted integer;
begin
  with gone as (
    delete from private.tn_orders o
     using private.tn_redaction_suppressions s
     where s.connection_id = o.connection_id
       and s.external_order_id = o.external_order_id
       and o.connection_id = p_connection_id
    returning o.local_day
  )
  select pg_catalog.array_agg(distinct g.local_day), pg_catalog.count(*)::integer
    into v_days, v_deleted
    from gone g;

  if v_deleted > 0 then
    delete from private.tn_customers c
     where c.connection_id = p_connection_id
       and exists (select 1 from private.tn_redaction_suppressions s
                    where s.connection_id = c.connection_id
                      and s.external_customer_id = c.external_customer_id)
       and not exists (select 1 from private.tn_orders o
                        where o.connection_id = c.connection_id
                          and o.external_customer_id = c.external_customer_id);
    perform private.tn_recalc_days(p_connection_id, v_days);
    perform private.tn_recalc_cohorts(p_connection_id);
  end if;
  return v_deleted;
end;
$$;

-- Mensaje fijo y clase de cada tipo de error (tabla de clasificación de la spec).
create function private.tn_error_class(p_kind text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_kind
    when 'credencial_invalida' then 'authentication'
    when 'permiso_faltante' then 'permission'
    when 'tienda_suspendida' then 'user_action'
    when 'solicitud_invalida' then 'own_error'
    when 'campo_invalido' then 'own_error'
    when 'cuota' then 'rate_limit'
    when 'transitorio' then 'temporary'
    when 'transporte' then 'transport'
    when 'no_encontrado' then 'unknown'
    when 'desconocido' then 'unknown'
  end
$$;

create function private.tn_error_message(p_kind text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_kind
    when 'credencial_invalida' then 'Tiendanube rechazó la autorización. Volvé a conectar la tienda.'
    when 'permiso_faltante' then 'Faltan permisos de lectura en Tiendanube. Volvé a conectar la tienda.'
    when 'tienda_suspendida' then 'Tiendanube informa que la tienda está suspendida. La sincronización queda detenida.'
    when 'solicitud_invalida' then 'PRAXA armó mal una consulta a Tiendanube. Es un error nuestro.'
    when 'campo_invalido' then 'Tiendanube rechazó un campo pedido por PRAXA. Es un error nuestro.'
    when 'cuota' then 'Se agotó la cuota de consultas a Tiendanube. Volvé a sincronizar en unos minutos.'
    when 'transitorio' then 'Tiendanube no respondió. Volvé a sincronizar en unos minutos.'
    when 'transporte' then 'No se pudo llegar a Tiendanube. Volvé a sincronizar en unos minutos.'
    when 'no_encontrado' then 'Tiendanube no encontró un recurso pedido. La sincronización quedó incompleta.'
    when 'desconocido' then 'Error desconocido al leer Tiendanube. La sincronización quedó incompleta.'
  end
$$;

revoke all on function private.tn_local_day(timestamptz, timestamptz, text)
  from public, anon, authenticated, service_role;
revoke all on function private.tn_covered_through(timestamptz, text)
  from public, anon, authenticated, service_role;
revoke all on function private.tn_recalc_days(uuid, date[])
  from public, anon, authenticated, service_role;
revoke all on function private.tn_recalc_cohorts(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.tn_locked_run(public.integration_connections, uuid, uuid, integer)
  from public, anon, authenticated, service_role;
revoke all on function private.tn_locked_connection(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.tn_drop_suppressed(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.tn_error_class(text)
  from public, anon, authenticated, service_role;
revoke all on function private.tn_error_message(text)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- worker_api: OAuth y conexión con proveedor (K02–K04)
-- ---------------------------------------------------------------------------

drop function worker_api.create_oauth_attempt(uuid, uuid, text, text, text, text, timestamptz, uuid);
drop function worker_api.consume_oauth_attempt(uuid, uuid, text, text);
drop function worker_api.create_pending_connection(
  uuid, uuid, uuid, text, text, text, text, integer, text, text, text[], timestamptz);
drop function worker_api.list_pending_purges(uuid, uuid);

-- Igual que 0012, con el proveedor explícito: el `initial` exige que la empresa no tenga
-- una conexión viva DE ESE PROVEEDOR, y el `reauth` apunta a una conexión del mismo.
create function worker_api.create_oauth_attempt(
  p_actor_user_id          uuid,
  p_company_id             uuid,
  p_provider               public.integration_provider,
  p_purpose                text,
  p_state_hash             text,
  p_browser_binding_hash   text,
  p_return_path            text,
  p_expires_at             timestamptz,
  p_expected_connection_id uuid default null
)
returns table (
  attempt_id             uuid,
  purpose                text,
  expected_connection_id uuid,
  expected_generation    integer,
  created_at             timestamptz,
  expires_at             timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection public.integration_connections;
  v_generation integer;
  v_constraint text;
begin
  perform private.assert_worker_actor(p_actor_user_id, p_company_id);

  if p_provider is null or p_purpose is null or p_state_hash is null
     or p_browser_binding_hash is null or p_return_path is null or p_expires_at is null
     or p_purpose not in ('initial', 'reauth')
     or p_state_hash !~ '^[0-9a-f]{64}$'
     or p_browser_binding_hash !~ '^[0-9a-f]{64}$'
     or p_return_path <> '/app/integraciones'
     or (p_purpose = 'initial' and p_expected_connection_id is not null)
     or (p_purpose = 'reauth' and p_expected_connection_id is null)
     or p_expires_at <= now()
     or p_expires_at > now() + interval '10 minutes' then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;

  perform private.lock_company(p_company_id);

  delete from public.oauth_attempts a
   where a.company_id = p_company_id
     and ((a.consumed_at is null and a.expires_at <= now())
           or a.consumed_at < now() - interval '10 minutes');

  if p_purpose = 'reauth' then
    select c.* into v_connection
    from public.integration_connections c
    where c.id = p_expected_connection_id
      and c.company_id = p_company_id
    for update;

    if not found or v_connection.provider <> p_provider then
      raise exception 'praxa: operación no autorizada' using errcode = 'PX001';
    end if;

    if v_connection.status not in ('active', 'needs_reauth') then
      raise exception 'praxa: transición de estado no permitida' using errcode = 'PX004';
    end if;

    v_generation := v_connection.credential_generation;
  end if;

  return query
  select a.id, a.purpose, a.expected_connection_id, a.expected_generation,
         a.created_at, a.expires_at
  from public.oauth_attempts a
  where a.state_hash = p_state_hash
    and a.actor_user_id = p_actor_user_id
    and a.company_id = p_company_id
    and a.provider = p_provider
    and a.purpose = p_purpose
    and a.expected_connection_id is not distinct from p_expected_connection_id
    and a.browser_binding_hash = p_browser_binding_hash
    and a.return_path = p_return_path
    and a.expires_at = p_expires_at
    and a.consumed_at is null
    and a.expires_at > now();

  if found then
    return;
  end if;

  if p_purpose = 'initial' then
    if exists (
      select 1
      from public.integration_connections c
      where c.company_id = p_company_id
        and c.provider = p_provider
        and c.status in ('pending_selection', 'active', 'needs_reauth')
    ) then
      raise exception 'praxa: la empresa ya tiene una conexión' using errcode = 'PX003';
    end if;
  end if;

  return query
  insert into public.oauth_attempts as a
    (provider, company_id, actor_user_id, purpose, expected_connection_id, expected_generation,
     state_hash, browser_binding_hash, return_path, created_at, expires_at)
  values
    (p_provider, p_company_id, p_actor_user_id, p_purpose, p_expected_connection_id, v_generation,
     p_state_hash, p_browser_binding_hash, p_return_path, now(), p_expires_at)
  returning a.id, a.purpose, a.expected_connection_id, a.expected_generation,
            a.created_at, a.expires_at;
exception
  when integrity_constraint_violation then
    get stacked diagnostics v_constraint = constraint_name;
    perform private.raise_worker_integrity_error(v_constraint);
end;
$$;

-- Consumo único y atómico (CA-03), ahora también por proveedor (A-14): un intento de otro
-- proveedor da el mismo PX002 que cualquier otra causa.
create function worker_api.consume_oauth_attempt(
  p_actor_user_id        uuid,
  p_company_id           uuid,
  p_provider             public.integration_provider,
  p_state_hash           text,
  p_browser_binding_hash text
)
returns table (
  attempt_id             uuid,
  purpose                text,
  expected_connection_id uuid,
  expected_generation    integer,
  return_path            text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_constraint text;
begin
  perform private.assert_worker_actor(p_actor_user_id, p_company_id);

  if p_provider is null or p_state_hash is null or p_browser_binding_hash is null
     or p_state_hash !~ '^[0-9a-f]{64}$'
     or p_browser_binding_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;

  return query
  update public.oauth_attempts a
     set consumed_at = now()
   where a.state_hash = p_state_hash
     and a.browser_binding_hash = p_browser_binding_hash
     and a.actor_user_id = p_actor_user_id
     and a.company_id = p_company_id
     and a.provider = p_provider
     and a.consumed_at is null
     and a.expires_at > now()
  returning a.id, a.purpose, a.expected_connection_id, a.expected_generation, a.return_path;

  if not found then
    raise exception 'praxa: la autorización no es válida o ya se usó' using errcode = 'PX002';
  end if;
exception
  when integrity_constraint_violation then
    get stacked diagnostics v_constraint = constraint_name;
    perform private.raise_worker_integrity_error(v_constraint);
end;
$$;

-- Conexión pendiente y su credencial, con el proveedor explícito. Meta exige negocio,
-- `system_user` y `ads_read`; Tiendanube, ningún negocio, `store_app_token`, los tres
-- `read_*` y sin vencimiento (CA-11c enmendado).
create function worker_api.create_pending_connection(
  p_actor_user_id      uuid,
  p_company_id         uuid,
  p_connection_id      uuid,
  p_provider           public.integration_provider,
  p_client_business_id text,
  p_ciphertext         text,
  p_iv                 text,
  p_auth_tag           text,
  p_key_version        integer,
  p_token_type         text,
  p_issued_for_app_id  text,
  p_granted_scopes     text[],
  p_token_expires_at   timestamptz
)
returns table (
  connection_id         uuid,
  status                text,
  pending_expires_at    timestamptz,
  credential_generation integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_constraint text;
begin
  perform private.assert_worker_actor(p_actor_user_id, p_company_id);

  if p_connection_id is null or p_provider is null or p_ciphertext is null
     or p_iv is null or p_auth_tag is null or p_key_version is null
     or p_token_type is null or p_issued_for_app_id is null or p_granted_scopes is null
     or p_ciphertext !~ '^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$'
     or p_ciphertext = '' or p_iv !~ '^[A-Za-z0-9+/]{16}$'
     or p_auth_tag !~ '^[A-Za-z0-9+/]{22}==$'
     or p_key_version <= 0
     or p_issued_for_app_id !~ '^[A-Za-z0-9_-]{1,64}$'
     or not private.valid_provider_scopes(p_provider::text, p_granted_scopes)
     or (p_provider::text = 'meta'
         and (p_client_business_id is null
              or p_client_business_id !~ '^[A-Za-z0-9_-]{1,64}$'
              or p_token_type <> 'system_user'))
     or (p_provider::text = 'tiendanube'
         and (p_client_business_id is not null
              or p_token_type <> 'store_app_token'
              or p_token_expires_at is not null)) then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;

  perform private.lock_company(p_company_id);

  -- Reintento exacto de la misma llamada (D-M06.1a-M06.2a-11), como en 0012.
  return query
  select c.id, c.status::text, c.pending_expires_at, c.credential_generation
  from public.integration_connections c
  join private.integration_credentials k
    on k.connection_id = c.id
   and k.company_id = c.company_id
  where c.id = p_connection_id
    and c.company_id = p_company_id
    and c.provider = p_provider
    and c.status = 'pending_selection'
    and c.pending_expires_at > now()
    and c.client_business_id is not distinct from p_client_business_id
    and k.ciphertext = p_ciphertext
    and k.iv = p_iv
    and k.auth_tag = p_auth_tag
    and k.key_version = p_key_version
    and k.token_type = p_token_type
    and k.issued_for_app_id = p_issued_for_app_id
    and k.granted_scopes = p_granted_scopes
    and k.expires_at is not distinct from p_token_expires_at;

  if found then
    return;
  end if;

  if exists (
    select 1
    from public.integration_connections c
    where c.company_id = p_company_id
      and c.provider = p_provider
      and c.status in ('pending_selection', 'active', 'needs_reauth')
  ) then
    raise exception 'praxa: la empresa ya tiene una conexión' using errcode = 'PX003';
  end if;

  if exists (select 1 from public.integration_connections c where c.id = p_connection_id) then
    raise exception 'praxa: operación no autorizada' using errcode = 'PX001';
  end if;

  insert into public.integration_connections
    (id, company_id, provider, status, client_business_id, pending_expires_at)
  values
    (p_connection_id, p_company_id, p_provider, 'pending_selection', p_client_business_id,
     now() + interval '30 minutes');

  insert into private.integration_credentials
    (connection_id, company_id, provider, ciphertext, iv, auth_tag, key_version, token_type,
     issued_for_app_id, granted_scopes, expires_at)
  values
    (p_connection_id, p_company_id, p_provider, p_ciphertext, p_iv, p_auth_tag, p_key_version,
     p_token_type, p_issued_for_app_id, p_granted_scopes, p_token_expires_at);

  return query
  select c.id, c.status::text, c.pending_expires_at, c.credential_generation
  from public.integration_connections c
  where c.id = p_connection_id;
exception
  when integrity_constraint_violation then
    get stacked diagnostics v_constraint = constraint_name;
    perform private.raise_worker_integrity_error(v_constraint);
end;
$$;

-- Igual que 0012, con el proveedor de cada fila en el resultado: la purga perezosa decide
-- por él si revoca en Meta (A-13).
create function worker_api.list_pending_purges(p_actor_user_id uuid, p_company_id uuid)
returns table (
  connection_id      uuid,
  provider           text,
  status             text,
  reason             text,
  has_credential     boolean,
  pending_expires_at timestamptz,
  purge_requested_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_worker_actor(p_actor_user_id, p_company_id);

  return query
  select c.id,
         c.provider::text,
         c.status::text,
         case when c.status = 'disconnected' then 'disconnect_requested'
              else 'pending_expired' end,
         exists (select 1 from private.integration_credentials k
                  where k.connection_id = c.id and k.company_id = c.company_id),
         c.pending_expires_at,
         c.purge_requested_at
  from public.integration_connections c
  where c.company_id = p_company_id
    and ((c.status = 'pending_selection' and c.pending_expires_at <= now())
         or c.status = 'disconnected')
  order by c.created_at, c.id;
end;
$$;

-- pending_selection → active. Conserva la firma de 0012 y agrega dos comprobaciones: la
-- credencial de la pendiente es del mismo proveedor, y la cuenta de Tiendanube es el ID
-- numérico de la tienda.
create or replace function worker_api.confirm_connection(
  p_actor_user_id       uuid,
  p_company_id          uuid,
  p_connection_id       uuid,
  p_external_account_id text,
  p_currency            text,
  p_timezone            text,
  p_probe_succeeded     boolean
)
returns table (
  connection_id         uuid,
  status                text,
  credential_generation integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection public.integration_connections;
  v_constraint text;
begin
  perform private.assert_worker_actor(p_actor_user_id, p_company_id);

  if p_connection_id is null or p_external_account_id is null or p_currency is null
     or p_timezone is null or p_probe_succeeded is distinct from true
     or p_external_account_id !~ '^[A-Za-z0-9_-]{1,64}$'
     or p_currency !~ '^[A-Z]{3}$'
     or (p_timezone <> 'UTC'
         and p_timezone !~ '^[A-Z][A-Za-z_]+(/[A-Za-z0-9_+-]+)+$')
     or not exists (select 1 from pg_catalog.pg_timezone_names z where z.name = p_timezone) then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;

  perform private.lock_company(p_company_id);

  select c.* into v_connection
  from public.integration_connections c
  where c.id = p_connection_id
    and c.company_id = p_company_id
  for update;

  if not found then
    raise exception 'praxa: operación no autorizada' using errcode = 'PX001';
  end if;

  if v_connection.provider::text = 'tiendanube'
     and p_external_account_id !~ '^[1-9][0-9]{0,19}$' then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;

  if v_connection.status = 'active'
     and v_connection.external_account_id = p_external_account_id
     and v_connection.currency = p_currency
     and v_connection.timezone = p_timezone
     and v_connection.credential_generation = 0 then
    return query
    select v_connection.id, v_connection.status::text, v_connection.credential_generation;
    return;
  end if;

  if v_connection.status <> 'pending_selection' then
    raise exception 'praxa: transición de estado no permitida' using errcode = 'PX004';
  end if;

  if v_connection.pending_expires_at <= now() then
    raise exception 'praxa: la conexión pendiente venció' using errcode = 'PX005';
  end if;

  if not exists (
    select 1 from private.integration_credentials k
     where k.connection_id = v_connection.id
       and k.company_id = v_connection.company_id
       and k.provider = v_connection.provider
  ) then
    raise exception 'praxa: transición de estado no permitida' using errcode = 'PX004';
  end if;

  update public.integration_connections c
     set status = 'active',
         external_account_id = p_external_account_id,
         currency = p_currency,
         timezone = p_timezone,
         pending_expires_at = null,
         last_error_class = null,
         last_error_message = null
   where c.id = p_connection_id;

  return query
  select c.id, c.status::text, c.credential_generation
  from public.integration_connections c
  where c.id = p_connection_id;
exception
  when integrity_constraint_violation then
    get stacked diagnostics v_constraint = constraint_name;
    perform private.raise_worker_integrity_error(v_constraint);
end;
$$;

-- Reautorización (CA-37c). Conserva la firma de 0012; el tipo de token, los permisos y el
-- vencimiento se validan contra el proveedor de la conexión, y el intento consumido tiene
-- que ser de ese mismo proveedor.
create or replace function worker_api.replace_credential(
  p_actor_user_id     uuid,
  p_company_id        uuid,
  p_connection_id     uuid,
  p_attempt_id        uuid,
  p_ciphertext        text,
  p_iv                text,
  p_auth_tag          text,
  p_key_version       integer,
  p_token_type        text,
  p_issued_for_app_id text,
  p_granted_scopes    text[],
  p_token_expires_at  timestamptz
)
returns table (
  connection_id         uuid,
  status                text,
  credential_generation integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection public.integration_connections;
  v_attempt    public.oauth_attempts;
  v_constraint text;
begin
  perform private.assert_worker_actor(p_actor_user_id, p_company_id);

  if p_connection_id is null or p_attempt_id is null or p_ciphertext is null
     or p_iv is null or p_auth_tag is null or p_key_version is null
     or p_token_type is null or p_issued_for_app_id is null or p_granted_scopes is null
     or p_ciphertext !~ '^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$'
     or p_ciphertext = '' or p_iv !~ '^[A-Za-z0-9+/]{16}$'
     or p_auth_tag !~ '^[A-Za-z0-9+/]{22}==$'
     or p_key_version <= 0 or p_token_type not in ('system_user', 'store_app_token')
     or p_issued_for_app_id !~ '^[A-Za-z0-9_-]{1,64}$' then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;

  perform private.lock_company(p_company_id);

  select c.* into v_connection
  from public.integration_connections c
  where c.id = p_connection_id
    and c.company_id = p_company_id
  for update;

  if not found then
    raise exception 'praxa: operación no autorizada' using errcode = 'PX001';
  end if;

  if not private.valid_provider_scopes(v_connection.provider::text, p_granted_scopes)
     or (v_connection.provider::text = 'meta' and p_token_type <> 'system_user')
     or (v_connection.provider::text = 'tiendanube'
         and (p_token_type <> 'store_app_token' or p_token_expires_at is not null)) then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;

  select a.* into v_attempt
  from public.oauth_attempts a
  where a.id = p_attempt_id
    and a.company_id = p_company_id
    and a.actor_user_id = p_actor_user_id
    and a.provider = v_connection.provider
    and a.purpose = 'reauth'
    and a.consumed_at is not null
    and a.consumed_at >= now() - interval '10 minutes'
    and a.expected_connection_id = p_connection_id;

  if not found then
    raise exception 'praxa: la autorización no es válida o ya se usó' using errcode = 'PX002';
  end if;

  if v_connection.credential_generation = v_attempt.expected_generation + 1
     and v_connection.status = 'active'
     and exists (
       select 1 from private.integration_credentials k
       where k.connection_id = p_connection_id
         and k.company_id = p_company_id
         and k.provider = v_connection.provider
         and k.ciphertext = p_ciphertext
         and k.iv = p_iv
         and k.auth_tag = p_auth_tag
         and k.key_version = p_key_version
         and k.token_type = p_token_type
         and k.issued_for_app_id = p_issued_for_app_id
         and k.granted_scopes = p_granted_scopes
         and k.expires_at is not distinct from p_token_expires_at
     ) then
    return query
    select v_connection.id, v_connection.status::text, v_connection.credential_generation;
    return;
  end if;

  if v_connection.status not in ('active', 'needs_reauth') then
    raise exception 'praxa: transición de estado no permitida' using errcode = 'PX004';
  end if;

  if v_connection.credential_generation <> v_attempt.expected_generation then
    raise exception 'praxa: la credencial cambió; volvé a empezar' using errcode = 'PX006';
  end if;

  insert into private.integration_credentials as k
    (connection_id, company_id, provider, ciphertext, iv, auth_tag, key_version, token_type,
     issued_for_app_id, granted_scopes, expires_at)
  values
    (p_connection_id, p_company_id, v_connection.provider, p_ciphertext, p_iv, p_auth_tag,
     p_key_version, p_token_type, p_issued_for_app_id, p_granted_scopes, p_token_expires_at)
  on conflict on constraint integration_credentials_pkey do update
     set ciphertext = excluded.ciphertext,
         iv = excluded.iv,
         auth_tag = excluded.auth_tag,
         key_version = excluded.key_version,
         token_type = excluded.token_type,
         issued_for_app_id = excluded.issued_for_app_id,
         granted_scopes = excluded.granted_scopes,
         expires_at = excluded.expires_at;

  update public.integration_connections c
     set credential_generation = c.credential_generation + 1,
         status = 'active',
         last_error_class = null,
         last_error_message = null
   where c.id = p_connection_id;

  return query
  select c.id, c.status::text, c.credential_generation
  from public.integration_connections c
  where c.id = p_connection_id;
exception
  when integrity_constraint_violation then
    get stacked diagnostics v_constraint = constraint_name;
    perform private.raise_worker_integrity_error(v_constraint);
end;
$$;

-- Purga (CA-38, DEC-09). Conserva firma y semántica de 0018 y borra también los hijos de
-- Tiendanube, de hijos a padre. El informe del diagnóstico cae por cascada al borrar la
-- conexión (D-M16e-15).
create or replace function worker_api.purge_connection(
  p_actor_user_id uuid, p_company_id uuid, p_connection_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_connection public.integration_connections; v_constraint text;
begin
  perform private.assert_worker_actor(p_actor_user_id, p_company_id);
  if p_connection_id is null then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;
  perform private.lock_company(p_company_id);
  select c.* into v_connection from public.integration_connections c
   where c.id = p_connection_id and c.company_id = p_company_id for update;
  if not found then return false; end if;
  if v_connection.status <> 'disconnected' then
    raise exception 'praxa: transición de estado no permitida' using errcode = 'PX004';
  end if;
  update public.integration_connections c set current_sync_run_id = null where c.id = p_connection_id;
  delete from public.chat_query_records x where x.company_id = p_company_id and x.connection_id = p_connection_id;
  delete from public.meta_daily_coverage x where x.connection_id = p_connection_id;
  delete from public.meta_snapshot_actions x where x.connection_id = p_connection_id;
  delete from public.meta_snapshot_days x where x.connection_id = p_connection_id;
  delete from public.meta_snapshot_entities x where x.connection_id = p_connection_id;
  delete from public.meta_insight_snapshots x where x.connection_id = p_connection_id;
  delete from public.meta_sync_runs x where x.connection_id = p_connection_id;
  delete from public.meta_entities x where x.connection_id = p_connection_id;
  delete from public.tn_cohort_cells x where x.connection_id = p_connection_id;
  delete from public.tn_product_units_daily x where x.connection_id = p_connection_id;
  delete from public.tn_sales_daily x where x.connection_id = p_connection_id;
  delete from public.tn_sync_status x where x.connection_id = p_connection_id;
  delete from private.tn_order_lines x where x.connection_id = p_connection_id;
  delete from private.tn_orders x where x.connection_id = p_connection_id;
  delete from private.tn_customers x where x.connection_id = p_connection_id;
  delete from private.tn_product_variants x where x.connection_id = p_connection_id;
  delete from private.tn_products x where x.connection_id = p_connection_id;
  delete from private.tn_redaction_suppressions x where x.connection_id = p_connection_id;
  delete from private.tn_sync_runs x where x.connection_id = p_connection_id;
  delete from private.integration_credentials k
   where k.connection_id = p_connection_id and k.company_id = p_company_id;
  delete from public.integration_connections c where c.id = p_connection_id and c.company_id = p_company_id;
  return true;
exception when integrity_constraint_violation then
  get stacked diagnostics v_constraint = constraint_name;
  perform private.raise_worker_integrity_error(v_constraint);
  return false;
end;
$$;

-- ---------------------------------------------------------------------------
-- worker_api: sincronización de Tiendanube (§3)
-- ---------------------------------------------------------------------------

-- Abre un paso. Antes de leer, borra los pedidos suprimidos que sigan presentes (§4). El
-- primer paso guarda su instante como marca de agua del backfill (A-05).
create function worker_api.tn_start_sync(
  p_actor_user_id       uuid,
  p_company_id          uuid,
  p_connection_id       uuid,
  p_expected_generation integer,
  p_run_id              uuid,
  p_lease_token         uuid,
  p_lease_expires_at    timestamptz
)
returns table (
  run_id            uuid,
  phase             text,
  started_at        timestamptz,
  lease_expires_at  timestamptz,
  watermark         timestamptz,
  backfill_next     date,
  incremental_from  timestamptz,
  catalog_next_page integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection public.integration_connections;
  v_run        private.tn_sync_runs;
  v_status     public.tn_sync_status;
  v_now        timestamptz;
  v_constraint text;
begin
  perform private.assert_worker_actor(p_actor_user_id, p_company_id);

  if p_connection_id is null or p_expected_generation is null or p_run_id is null
     or p_lease_token is null or p_lease_expires_at is null
     or p_lease_expires_at <= pg_catalog.clock_timestamp()
     or p_lease_expires_at > pg_catalog.clock_timestamp() + interval '5 minutes' then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;

  perform private.lock_company(p_company_id);
  v_connection := private.tn_locked_connection(p_company_id, p_connection_id);

  if v_connection.status <> 'active' then
    raise exception 'praxa: transición de estado no permitida' using errcode = 'PX004';
  end if;
  if v_connection.credential_generation <> p_expected_generation then
    raise exception 'praxa: la credencial cambió; volvé a empezar' using errcode = 'PX006';
  end if;

  -- Reintento exacto: devuelve la misma ejecución sin renovar el lease.
  select r.* into v_run from private.tn_sync_runs r where r.id = p_run_id for update;
  if found then
    if v_run.company_id <> p_company_id or v_run.connection_id <> p_connection_id
       or v_run.lease_token <> p_lease_token
       or v_run.credential_generation <> p_expected_generation then
      raise exception 'praxa: operación no autorizada' using errcode = 'PX001';
    end if;
    if v_run.status <> 'running' or v_run.lease_expires_at <= pg_catalog.clock_timestamp() then
      raise exception 'praxa: la sincronización venció o fue reemplazada' using errcode = 'PX010';
    end if;
    select s.* into v_status from public.tn_sync_status s where s.connection_id = p_connection_id;
    return query select v_run.id, v_run.phase, v_run.started_at, v_run.lease_expires_at,
      v_status.watermark, v_status.backfill_next,
      v_status.incremental_checkpoint - interval '1 hour', v_status.catalog_next_page;
    return;
  end if;

  select r.* into v_run
    from private.tn_sync_runs r
   where r.connection_id = p_connection_id and r.status = 'running'
   for update;
  if found then
    if v_run.lease_expires_at > pg_catalog.clock_timestamp()
       and v_run.credential_generation = v_connection.credential_generation then
      raise exception 'praxa: ya hay una sincronización en curso' using errcode = 'PX009';
    end if;
    update private.tn_sync_runs r
       set status = 'superseded', finished_at = pg_catalog.clock_timestamp()
     where r.id = v_run.id;
  end if;

  perform private.tn_drop_suppressed(p_connection_id);

  v_now := pg_catalog.date_trunc('milliseconds', pg_catalog.clock_timestamp());

  insert into public.tn_sync_status as s (connection_id, company_id, phase, watermark)
  values (p_connection_id, p_company_id, 'backfill', v_now)
  on conflict (connection_id) do nothing;

  update public.tn_sync_status s
     set last_run_started_at = v_now, last_run_finished_at = null,
         last_run_status = 'running', updated_at = now()
   where s.connection_id = p_connection_id
  returning s.* into v_status;

  insert into private.tn_sync_runs
    (id, company_id, connection_id, credential_generation, lease_token, phase, started_at,
     lease_expires_at, status)
  values
    (p_run_id, p_company_id, p_connection_id, p_expected_generation, p_lease_token,
     v_status.phase, v_now, p_lease_expires_at, 'running');

  return query select p_run_id, v_status.phase, v_now, p_lease_expires_at,
    v_status.watermark, v_status.backfill_next,
    v_status.incremental_checkpoint - interval '1 hour', v_status.catalog_next_page;
exception
  when integrity_constraint_violation then
    get stacked diagnostics v_constraint = constraint_name;
    perform private.raise_worker_integrity_error(v_constraint);
end;
$$;

-- Publica en UNA transacción los pedidos y líneas de una página de la ventana (§3). Repetir
-- no duplica: upsert por (conexión, pedido) y reemplazo entero de las líneas. Los pedidos
-- con marca de supresión se filtran acá mismo (§4). El checkpoint del backfill avanza solo
-- con la última página de una ventana.
--
-- p_window, backfill:    {"kind":"backfill","window_from":"AAAA-MM-DD","window_to":"AAAA-MM-DD","last_page":bool}
-- p_window, incremental: {"kind":"incremental","last_page":bool}
-- p_orders: [{id, customer_id, status, payment_status, created_at, updated_at, paid_at,
--             closed_at, cancelled_at, currency, subtotal, discount, total,
--             total_paid_by_customer, storefront, cancel_reason, is_subscription,
--             is_subscription_initial, refunded_amount}]
-- p_lines:  [{order_id, line_no, product_id, variant_id, name, price, quantity}]
create function worker_api.tn_publish_orders(
  p_actor_user_id       uuid,
  p_company_id          uuid,
  p_connection_id       uuid,
  p_expected_generation integer,
  p_run_id              uuid,
  p_lease_token         uuid,
  p_window              jsonb,
  p_orders              jsonb,
  p_lines               jsonb
)
returns table (orders_written integer, orders_suppressed integer, backfill_next date)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection public.integration_connections;
  v_run        private.tn_sync_runs;
  v_status     public.tn_sync_status;
  v_from       date;
  v_to         date;
  v_last       boolean;
  v_old_days   date[];
  v_new_days   date[];
  v_orders     private.tn_orders[];
  v_lines      private.tn_order_lines[];
  v_written    integer := 0;
  v_suppressed integer := 0;
  v_constraint text;
  v_order_keys constant text[] := array['id', 'customer_id', 'status', 'payment_status',
    'created_at', 'updated_at', 'paid_at', 'closed_at', 'cancelled_at', 'currency',
    'subtotal', 'discount', 'total', 'total_paid_by_customer', 'storefront', 'cancel_reason',
    'is_subscription', 'is_subscription_initial', 'refunded_amount'];
  v_line_keys constant text[] := array['order_id', 'line_no', 'product_id', 'variant_id',
    'name', 'price', 'quantity'];
begin
  perform private.assert_worker_actor(p_actor_user_id, p_company_id);

  if p_connection_id is null or p_expected_generation is null or p_run_id is null
     or p_lease_token is null or p_window is null or p_orders is null or p_lines is null
     or pg_catalog.jsonb_typeof(p_orders) <> 'array' or pg_catalog.jsonb_typeof(p_lines) <> 'array'
     or pg_catalog.jsonb_array_length(p_orders) > 1000
     or pg_catalog.jsonb_array_length(p_lines) > 20000
     or not (private.meta_has_exact_keys(p_window, array['kind', 'window_from', 'window_to', 'last_page'])
             and p_window->>'kind' = 'backfill'
             or private.meta_has_exact_keys(p_window, array['kind', 'last_page'])
             and p_window->>'kind' = 'incremental')
     or pg_catalog.jsonb_typeof(p_window->'last_page') <> 'boolean'
     or exists (select 1 from pg_catalog.jsonb_array_elements(p_orders) e
                 where not private.meta_has_exact_keys(e, v_order_keys)
                    or pg_catalog.jsonb_typeof(e->'id') <> 'string'
                    or e->>'id' !~ '^[1-9][0-9]{0,19}$'
                    or pg_catalog.jsonb_typeof(e->'customer_id') not in ('string', 'null')
                    or coalesce(e->>'customer_id', '1') !~ '^[1-9][0-9]{0,19}$')
     or exists (select 1 from pg_catalog.jsonb_array_elements(p_lines) e
                 where not private.meta_has_exact_keys(e, v_line_keys)
                    or pg_catalog.jsonb_typeof(e->'order_id') <> 'string'
                    or pg_catalog.jsonb_typeof(e->'line_no') <> 'number'
                    or pg_catalog.jsonb_typeof(e->'product_id') not in ('string', 'null')
                    or coalesce(e->>'product_id', '1') !~ '^[1-9][0-9]{0,19}$'
                    or pg_catalog.jsonb_typeof(e->'variant_id') not in ('string', 'null')
                    or coalesce(e->>'variant_id', '1') !~ '^[1-9][0-9]{0,19}$')
     or (select pg_catalog.count(*) <> pg_catalog.count(distinct e->>'id')
           from pg_catalog.jsonb_array_elements(p_orders) e)
     or (select pg_catalog.count(*) <> pg_catalog.count(distinct (e->>'order_id', e->>'line_no'))
           from pg_catalog.jsonb_array_elements(p_lines) e)
     or exists (select 1 from pg_catalog.jsonb_array_elements(p_lines) l
                 where not exists (select 1 from pg_catalog.jsonb_array_elements(p_orders) o
                                    where o->>'id' = l->>'order_id')) then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;

  v_last := (p_window->>'last_page')::boolean;
  if p_window->>'kind' = 'backfill' then
    begin
      v_from := (p_window->>'window_from')::date;
      v_to := (p_window->>'window_to')::date;
    exception when others then
      raise exception 'praxa: argumento inválido' using errcode = '22023';
    end;
    if v_from is null or v_to is null or v_to < v_from then
      raise exception 'praxa: argumento inválido' using errcode = '22023';
    end if;
  end if;

  perform private.lock_company(p_company_id);
  v_connection := private.tn_locked_connection(p_company_id, p_connection_id);
  v_run := private.tn_locked_run(v_connection, p_run_id, p_lease_token, p_expected_generation);

  select s.* into v_status from public.tn_sync_status s
   where s.connection_id = p_connection_id for update;

  if p_window->>'kind' <> v_run.phase
     or (v_run.phase = 'backfill'
         and ((v_status.backfill_next is not null and v_from <> v_status.backfill_next)
              or v_to > (v_status.watermark at time zone v_connection.timezone)::date)) then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;

  -- Proyección tipada a filas de las tablas destino. Un valor con forma inválida (fecha,
  -- número, booleano) es 22023. Los pedidos con marca de supresión se descartan acá, dentro
  -- de la transacción de publicación (D-M16e-17).
  begin
    select coalesce(pg_catalog.array_agg(row(
             p_company_id, p_connection_id, x.id, x.customer_id, x.status, x.payment_status,
             x.created_at, x.updated_at, x.paid_at, x.closed_at, x.cancelled_at, x.currency,
             x.subtotal, x.discount, x.total, x.total_paid_by_customer, x.storefront,
             x.cancel_reason, x.is_subscription, x.is_subscription_initial, x.refunded_amount,
             private.tn_local_day(x.paid_at, x.created_at, v_connection.timezone),
             x.payment_status in ('paid', 'partially_refunded') and x.status <> 'cancelled',
             x.payment_status = 'partially_paid' and x.status <> 'cancelled'
           )::private.tn_orders), '{}')
      into v_orders
      from pg_catalog.jsonb_to_recordset(p_orders) as x(
        id text, customer_id text, status text, payment_status text, created_at timestamptz,
        updated_at timestamptz, paid_at timestamptz, closed_at timestamptz,
        cancelled_at timestamptz, currency text, subtotal numeric, discount numeric,
        total numeric, total_paid_by_customer numeric, storefront text, cancel_reason text,
        is_subscription boolean, is_subscription_initial boolean, refunded_amount numeric)
     where not exists (select 1 from private.tn_redaction_suppressions s
                        where s.connection_id = p_connection_id and s.external_order_id = x.id);

    select coalesce(pg_catalog.array_agg(row(
             p_company_id, p_connection_id, x.order_id, x.line_no, x.product_id, x.variant_id,
             x.name, x.price, x.quantity)::private.tn_order_lines), '{}')
      into v_lines
      from pg_catalog.jsonb_to_recordset(p_lines) as x(
        order_id text, line_no integer, product_id text, variant_id text, name text,
        price numeric, quantity integer)
     where x.order_id in (select o.external_order_id from pg_catalog.unnest(v_orders) as o);
  exception when data_exception then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end;

  v_suppressed := pg_catalog.jsonb_array_length(p_orders) - pg_catalog.cardinality(v_orders);

  select pg_catalog.array_agg(distinct o.local_day) into v_old_days
    from private.tn_orders o
    join pg_catalog.unnest(v_orders) as i on i.external_order_id = o.external_order_id
   where o.connection_id = p_connection_id;
  select pg_catalog.array_agg(distinct i.local_day) into v_new_days
    from pg_catalog.unnest(v_orders) as i;

  insert into private.tn_customers (company_id, connection_id, external_customer_id)
  select distinct p_company_id, p_connection_id, i.external_customer_id
    from pg_catalog.unnest(v_orders) as i where i.external_customer_id is not null
  on conflict on constraint tn_customers_pkey do nothing;

  delete from private.tn_order_lines l
   using pg_catalog.unnest(v_orders) as i
   where l.connection_id = p_connection_id and l.external_order_id = i.external_order_id;

  insert into private.tn_orders as o
  select * from pg_catalog.unnest(v_orders)
  on conflict on constraint tn_orders_pkey do update
     set external_customer_id = excluded.external_customer_id,
         status = excluded.status,
         payment_status = excluded.payment_status,
         created_at = excluded.created_at,
         source_updated_at = excluded.source_updated_at,
         paid_at = excluded.paid_at,
         closed_at = excluded.closed_at,
         cancelled_at = excluded.cancelled_at,
         currency = excluded.currency,
         subtotal = excluded.subtotal,
         discount = excluded.discount,
         total = excluded.total,
         total_paid_by_customer = excluded.total_paid_by_customer,
         storefront = excluded.storefront,
         cancel_reason = excluded.cancel_reason,
         is_subscription = excluded.is_subscription,
         is_subscription_initial = excluded.is_subscription_initial,
         refunded_amount = excluded.refunded_amount,
         local_day = excluded.local_day,
         eligible = excluded.eligible,
         partially_paid = excluded.partially_paid;
  get diagnostics v_written = row_count;

  -- Un producto o variante que solo se vio en una línea queda como provisional, con el
  -- nombre de la línea, hasta que lo confirme el catálogo.
  insert into private.tn_products (company_id, connection_id, external_product_id, name)
  select distinct on (l.external_product_id) p_company_id, p_connection_id,
         l.external_product_id, l.name
    from pg_catalog.unnest(v_lines) as l
   where l.external_product_id is not null
   order by l.external_product_id, l.external_order_id, l.line_no
  on conflict on constraint tn_products_external_key do nothing;

  insert into private.tn_product_variants
    (company_id, connection_id, product_id, external_variant_id)
  select distinct on (l.external_variant_id) p_company_id, p_connection_id, p.id,
         l.external_variant_id
    from pg_catalog.unnest(v_lines) as l
    join private.tn_products p
      on p.connection_id = p_connection_id and p.external_product_id = l.external_product_id
   where l.external_variant_id is not null
   order by l.external_variant_id
  on conflict on constraint tn_product_variants_external_key do nothing;

  insert into private.tn_order_lines
  select * from pg_catalog.unnest(v_lines);

  perform private.tn_recalc_days(p_connection_id,
    pg_catalog.array_cat(coalesce(v_old_days, '{}'), coalesce(v_new_days, '{}')));
  perform private.tn_recalc_cohorts(p_connection_id);

  if v_run.phase = 'backfill' and v_last then
    update public.tn_sync_status s
       set backfill_next = v_to + 1, updated_at = now()
     where s.connection_id = p_connection_id
    returning s.* into v_status;
  end if;

  return query select v_written, v_suppressed, v_status.backfill_next;
exception
  when integrity_constraint_violation then
    get stacked diagnostics v_constraint = constraint_name;
    perform private.raise_worker_integrity_error(v_constraint);
end;
$$;

-- Publica una página del catálogo. Con `p_complete`, cierra el recorrido: lo que no se vio
-- desde que empezó queda como eliminado (A-13). Un recorrido incompleto no marca nada.
--
-- p_products: [{id, name, visibility, variants:[{id, sku}]}]
-- p_state:    {"next_page": entero >= 2 | null, "store": {"original_domain", "country"} | null}
create function worker_api.tn_publish_catalog(
  p_actor_user_id       uuid,
  p_company_id          uuid,
  p_connection_id       uuid,
  p_expected_generation integer,
  p_run_id              uuid,
  p_lease_token         uuid,
  p_products            jsonb,
  p_state               jsonb,
  p_complete            boolean
)
returns table (products_written integer, products_deleted integer, catalog_next_page integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection public.integration_connections;
  v_run        private.tn_sync_runs;
  v_status     public.tn_sync_status;
  v_next       integer;
  v_written    integer := 0;
  v_deleted    integer := 0;
  v_started    timestamptz;
  v_constraint text;
begin
  perform private.assert_worker_actor(p_actor_user_id, p_company_id);

  if p_connection_id is null or p_expected_generation is null or p_run_id is null
     or p_lease_token is null or p_products is null or p_state is null or p_complete is null
     or pg_catalog.jsonb_typeof(p_products) <> 'array'
     or pg_catalog.jsonb_array_length(p_products) > 1000
     or not private.meta_has_exact_keys(p_state, array['next_page', 'store'])
     or pg_catalog.jsonb_typeof(p_state->'next_page') not in ('number', 'null')
     or (pg_catalog.jsonb_typeof(p_state->'next_page') = 'number'
         and ((p_state->>'next_page') !~ '^[0-9]{1,6}$' or (p_state->>'next_page')::integer < 2))
     or (p_complete and pg_catalog.jsonb_typeof(p_state->'next_page') <> 'null')
     or not (pg_catalog.jsonb_typeof(p_state->'store') = 'null'
             or (private.meta_has_exact_keys(p_state->'store', array['original_domain', 'country'])
                 and coalesce(p_state->'store'->>'original_domain', '') ~ '^[A-Za-z0-9.-]{1,253}$'
                 and coalesce(p_state->'store'->>'country', '') ~ '^[A-Z]{2}$'))
     or exists (select 1 from pg_catalog.jsonb_array_elements(p_products) e
                 where not private.meta_has_exact_keys(e, array['id', 'name', 'visibility', 'variants'])
                    or pg_catalog.jsonb_typeof(e->'id') <> 'string'
                    or e->>'id' !~ '^[1-9][0-9]{0,19}$'
                    or pg_catalog.jsonb_typeof(e->'name') <> 'string'
                    or pg_catalog.char_length(e->>'name') not between 1 and 500
                    or pg_catalog.jsonb_typeof(e->'visibility') not in ('string', 'null')
                    or pg_catalog.jsonb_typeof(e->'variants') <> 'array'
                    or exists (select 1 from pg_catalog.jsonb_array_elements(e->'variants') v
                                where not private.meta_has_exact_keys(v, array['id', 'sku'])
                                   or pg_catalog.jsonb_typeof(v->'id') <> 'string'
                                   or v->>'id' !~ '^[1-9][0-9]{0,19}$'
                                   or pg_catalog.jsonb_typeof(v->'sku') not in ('string', 'null')))
     or (select pg_catalog.count(*) <> pg_catalog.count(distinct e->>'id')
           from pg_catalog.jsonb_array_elements(p_products) e)
     or (select pg_catalog.count(*) <> pg_catalog.count(distinct v->>'id')
           from pg_catalog.jsonb_array_elements(p_products) e,
                pg_catalog.jsonb_array_elements(e->'variants') v) then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;

  v_next := case when pg_catalog.jsonb_typeof(p_state->'next_page') = 'number'
                 then (p_state->>'next_page')::integer end;

  perform private.lock_company(p_company_id);
  v_connection := private.tn_locked_connection(p_company_id, p_connection_id);
  v_run := private.tn_locked_run(v_connection, p_run_id, p_lease_token, p_expected_generation);

  select s.* into v_status from public.tn_sync_status s
   where s.connection_id = p_connection_id for update;

  v_started := coalesce(v_status.catalog_traversal_started_at, now());

  insert into private.tn_products as p
    (company_id, connection_id, external_product_id, name, visibility, deleted, last_seen_at)
  select p_company_id, p_connection_id, e->>'id', e->>'name', e->>'visibility', false, now()
    from pg_catalog.jsonb_array_elements(p_products) e
  on conflict on constraint tn_products_external_key do update
     set name = excluded.name, visibility = excluded.visibility, deleted = false,
         last_seen_at = excluded.last_seen_at;
  get diagnostics v_written = row_count;

  insert into private.tn_product_variants as v
    (company_id, connection_id, product_id, external_variant_id, sku, last_seen_at)
  select p_company_id, p_connection_id, p.id, x->>'id', x->>'sku', now()
    from pg_catalog.jsonb_array_elements(p_products) e
   cross join pg_catalog.jsonb_array_elements(e->'variants') x
    join private.tn_products p
      on p.connection_id = p_connection_id and p.external_product_id = e->>'id'
  on conflict on constraint tn_product_variants_external_key do update
     set product_id = excluded.product_id, sku = excluded.sku,
         last_seen_at = excluded.last_seen_at;

  if p_complete then
    update private.tn_products p
       set deleted = true
     where p.connection_id = p_connection_id
       and not p.deleted
       and (p.last_seen_at is null or p.last_seen_at < v_started);
    get diagnostics v_deleted = row_count;
  end if;

  -- Los agregados llevan nombre, SKU y marca de eliminado desnormalizados.
  update public.tn_product_units_daily u
     set name = p.name, deleted = p.deleted
    from private.tn_products p
   where u.connection_id = p_connection_id
     and p.connection_id = p_connection_id
     and p.id = u.product_key
     and (u.name is distinct from p.name or u.deleted is distinct from p.deleted);

  update public.tn_product_units_daily u
     set sku = v.sku
    from private.tn_product_variants v
   where u.connection_id = p_connection_id
     and v.connection_id = p_connection_id
     and v.id = u.variant_key
     and u.sku is distinct from v.sku;

  update public.tn_sync_status s
     set catalog_next_page = v_next,
         catalog_traversal_started_at = case when p_complete then null else v_started end,
         catalog_complete_at = case when p_complete then now() else s.catalog_complete_at end,
         store_domain = coalesce(p_state->'store'->>'original_domain', s.store_domain),
         store_country = coalesce(p_state->'store'->>'country', s.store_country),
         updated_at = now()
   where s.connection_id = p_connection_id;

  return query select v_written, v_deleted, v_next;
exception
  when integrity_constraint_violation then
    get stacked diagnostics v_constraint = constraint_name;
    perform private.raise_worker_integrity_error(v_constraint);
end;
$$;

-- Cierra el paso. Con `p_complete`: en backfill, pasa a incremental desde la marca de agua;
-- en incremental, el checkpoint y la cobertura avanzan hasta el inicio de este paso (§3).
-- Sin `p_complete`, la ejecución queda incompleta y nada avanza.
create function worker_api.tn_finish_sync(
  p_actor_user_id       uuid,
  p_company_id          uuid,
  p_connection_id       uuid,
  p_expected_generation integer,
  p_run_id              uuid,
  p_lease_token         uuid,
  p_fetched_at          timestamptz,
  p_complete            boolean
)
returns table (phase text, coverage_until timestamptz, run_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection public.integration_connections;
  v_run        private.tn_sync_runs;
  v_status     public.tn_sync_status;
  v_result     text;
  v_constraint text;
begin
  perform private.assert_worker_actor(p_actor_user_id, p_company_id);

  if p_connection_id is null or p_expected_generation is null or p_run_id is null
     or p_lease_token is null or p_fetched_at is null or p_complete is null then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;

  perform private.lock_company(p_company_id);
  v_connection := private.tn_locked_connection(p_company_id, p_connection_id);
  v_run := private.tn_locked_run(v_connection, p_run_id, p_lease_token, p_expected_generation);

  if p_fetched_at < v_run.started_at or p_fetched_at > pg_catalog.clock_timestamp() then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;

  select s.* into v_status from public.tn_sync_status s
   where s.connection_id = p_connection_id for update;

  v_result := case when p_complete then 'complete' else 'incomplete' end;

  if p_complete and v_run.phase = 'backfill' then
    update public.tn_sync_status s
       set phase = 'incremental', backfill_done_at = now(),
           incremental_checkpoint = s.watermark
     where s.connection_id = p_connection_id;
  elsif p_complete and v_run.phase = 'incremental' then
    update public.tn_sync_status s
       set incremental_checkpoint = v_run.started_at,
           coverage_until = v_run.started_at
     where s.connection_id = p_connection_id;
    perform private.tn_recalc_cohorts(p_connection_id);
  end if;

  update public.tn_sync_status s
     set last_run_finished_at = pg_catalog.clock_timestamp(), last_run_status = v_result,
         last_error_kind = case when p_complete then null else s.last_error_kind end,
         last_fetched_at = p_fetched_at, updated_at = now()
   where s.connection_id = p_connection_id
  returning s.* into v_status;

  update private.tn_sync_runs r
     set status = v_result, finished_at = pg_catalog.clock_timestamp(), fetched_at = p_fetched_at
   where r.id = v_run.id;

  if p_complete then
    update public.integration_connections c
       set last_error_class = null, last_error_message = null
     where c.id = p_connection_id and c.last_error_class is not null;
  end if;

  return query select v_status.phase, v_status.coverage_until, v_result;
exception
  when integrity_constraint_violation then
    get stacked diagnostics v_constraint = constraint_name;
    perform private.raise_worker_integrity_error(v_constraint);
end;
$$;

-- Registra el fallo del paso con su tipo y clase (tabla de clasificación). `401` y `403`
-- llevan la conexión a `needs_reauth`; `402` la deja activa con el aviso; el resto solo
-- anota el error. El mensaje es fijo: nunca texto de Tiendanube.
create function worker_api.tn_fail_sync(
  p_actor_user_id       uuid,
  p_company_id          uuid,
  p_connection_id       uuid,
  p_expected_generation integer,
  p_run_id              uuid,
  p_lease_token         uuid,
  p_error_kind          text,
  p_error_class         text
)
returns table (connection_status text, run_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection public.integration_connections;
  v_run        private.tn_sync_runs;
  v_constraint text;
begin
  perform private.assert_worker_actor(p_actor_user_id, p_company_id);

  if p_connection_id is null or p_expected_generation is null or p_run_id is null
     or p_lease_token is null or p_error_kind is null or p_error_class is null
     or private.tn_error_class(p_error_kind) is distinct from p_error_class then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;

  perform private.lock_company(p_company_id);
  v_connection := private.tn_locked_connection(p_company_id, p_connection_id);
  v_run := private.tn_locked_run(v_connection, p_run_id, p_lease_token, p_expected_generation);

  update private.tn_sync_runs r
     set status = 'failed', finished_at = pg_catalog.clock_timestamp(), error_kind = p_error_kind
   where r.id = v_run.id;

  update public.tn_sync_status s
     set last_run_finished_at = pg_catalog.clock_timestamp(), last_run_status = 'failed',
         last_error_kind = p_error_kind, updated_at = now()
   where s.connection_id = p_connection_id;

  update public.integration_connections c
     set status = case when p_error_class in ('authentication', 'permission')
                       then 'needs_reauth'::public.connection_status else c.status end,
         last_error_class = p_error_class,
         last_error_message = private.tn_error_message(p_error_kind)
   where c.id = p_connection_id;

  return query
  select c.status::text, 'failed'::text
    from public.integration_connections c where c.id = p_connection_id;
exception
  when integrity_constraint_violation then
    get stacked diagnostics v_constraint = constraint_name;
    perform private.raise_worker_integrity_error(v_constraint);
end;
$$;

-- ---------------------------------------------------------------------------
-- worker_api: privacidad sin sesión (§4, D-M16e-14, D-M16e-26, D-M16e-27)
-- ---------------------------------------------------------------------------

-- `app/store_redact`, en dos fases y por tandas. Cada llamada es una transacción corta:
--   1. si alguna conexión de la tienda no está marcada (desconectada y sin credencial), las
--      marca a todas y devuelve `marked`;
--   2. si no, borra hasta `p_max_rows` filas de hijos a padre y devuelve `more` o `done`.
create function worker_api.tn_privacy_store_redact(p_store_id text, p_max_rows integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company    uuid;
  v_conn       record;
  v_budget     integer;
  v_count      integer;
  v_marked     boolean := false;
  v_constraint text;
begin
  if p_store_id is null or p_max_rows is null
     or p_store_id !~ '^[1-9][0-9]{0,19}$' or p_max_rows not between 1 and 5000 then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;

  -- Cerrojo de cada empresa con una conexión de la tienda, en orden fijo.
  for v_company in
    select distinct c.company_id from public.integration_connections c
     where c.provider::text = 'tiendanube' and c.external_account_id = p_store_id
     order by c.company_id
  loop
    perform private.lock_company(v_company);
  end loop;

  for v_conn in
    select c.id, c.company_id, c.status::text as status,
           exists (select 1 from private.integration_credentials k
                    where k.connection_id = c.id and k.company_id = c.company_id) as has_credential
      from public.integration_connections c
     where c.provider::text = 'tiendanube' and c.external_account_id = p_store_id
     order by c.company_id, c.id
     for update
  loop
    if v_conn.status <> 'disconnected' or v_conn.has_credential then
      v_marked := true;
      update public.integration_connections c
         set status = 'disconnected',
             credential_generation = case when c.status = 'disconnected'
                                          then c.credential_generation
                                          else c.credential_generation + 1 end,
             purge_requested_at = coalesce(c.purge_requested_at, now()),
             pending_expires_at = null
       where c.id = v_conn.id;
      delete from private.integration_credentials k
       where k.connection_id = v_conn.id and k.company_id = v_conn.company_id;
      update private.tn_sync_runs r
         set status = 'superseded', finished_at = pg_catalog.clock_timestamp()
       where r.connection_id = v_conn.id and r.status = 'running';
    end if;
  end loop;

  if v_marked then
    return 'marked';
  end if;

  v_budget := p_max_rows;
  for v_conn in
    select c.id, c.company_id from public.integration_connections c
     where c.provider::text = 'tiendanube' and c.external_account_id = p_store_id
     order by c.company_id, c.id
  loop
    delete from public.chat_query_records x where x.ctid in (
      select y.ctid from public.chat_query_records y
       where y.company_id = v_conn.company_id and y.connection_id = v_conn.id limit v_budget);
    get diagnostics v_count = row_count; v_budget := v_budget - v_count;
    if v_budget <= 0 then return 'more'; end if;

    delete from public.tn_cohort_cells x where x.ctid in (
      select y.ctid from public.tn_cohort_cells y where y.connection_id = v_conn.id limit v_budget);
    get diagnostics v_count = row_count; v_budget := v_budget - v_count;
    if v_budget <= 0 then return 'more'; end if;

    delete from public.tn_product_units_daily x where x.ctid in (
      select y.ctid from public.tn_product_units_daily y where y.connection_id = v_conn.id limit v_budget);
    get diagnostics v_count = row_count; v_budget := v_budget - v_count;
    if v_budget <= 0 then return 'more'; end if;

    delete from public.tn_sales_daily x where x.ctid in (
      select y.ctid from public.tn_sales_daily y where y.connection_id = v_conn.id limit v_budget);
    get diagnostics v_count = row_count; v_budget := v_budget - v_count;
    if v_budget <= 0 then return 'more'; end if;

    delete from public.tn_sync_status x where x.connection_id = v_conn.id;
    get diagnostics v_count = row_count; v_budget := v_budget - v_count;
    if v_budget <= 0 then return 'more'; end if;

    delete from private.tn_order_lines x where x.ctid in (
      select y.ctid from private.tn_order_lines y where y.connection_id = v_conn.id limit v_budget);
    get diagnostics v_count = row_count; v_budget := v_budget - v_count;
    if v_budget <= 0 then return 'more'; end if;

    -- Un pedido con líneas restantes no se toca: sus líneas van primero.
    delete from private.tn_orders x where x.ctid in (
      select y.ctid from private.tn_orders y where y.connection_id = v_conn.id limit v_budget);
    get diagnostics v_count = row_count; v_budget := v_budget - v_count;
    if v_budget <= 0 then return 'more'; end if;

    delete from private.tn_customers x where x.ctid in (
      select y.ctid from private.tn_customers y where y.connection_id = v_conn.id limit v_budget);
    get diagnostics v_count = row_count; v_budget := v_budget - v_count;
    if v_budget <= 0 then return 'more'; end if;

    delete from private.tn_product_variants x where x.ctid in (
      select y.ctid from private.tn_product_variants y where y.connection_id = v_conn.id limit v_budget);
    get diagnostics v_count = row_count; v_budget := v_budget - v_count;
    if v_budget <= 0 then return 'more'; end if;

    delete from private.tn_products x where x.ctid in (
      select y.ctid from private.tn_products y where y.connection_id = v_conn.id limit v_budget);
    get diagnostics v_count = row_count; v_budget := v_budget - v_count;
    if v_budget <= 0 then return 'more'; end if;

    delete from private.tn_redaction_suppressions x where x.ctid in (
      select y.ctid from private.tn_redaction_suppressions y where y.connection_id = v_conn.id limit v_budget);
    get diagnostics v_count = row_count; v_budget := v_budget - v_count;
    if v_budget <= 0 then return 'more'; end if;

    delete from private.tn_sync_runs x where x.ctid in (
      select y.ctid from private.tn_sync_runs y where y.connection_id = v_conn.id limit v_budget);
    get diagnostics v_count = row_count; v_budget := v_budget - v_count;
    if v_budget <= 0 then return 'more'; end if;

    -- La fila de la conexión arrastra por cascada los intentos y el informe del
    -- diagnóstico con sección de tienda (D-M16e-15).
    delete from public.integration_connections c
     where c.id = v_conn.id and c.company_id = v_conn.company_id;
    v_budget := v_budget - 1;
    if v_budget <= 0 then
      if exists (select 1 from public.integration_connections c
                  where c.provider::text = 'tiendanube' and c.external_account_id = p_store_id) then
        return 'more';
      end if;
      return 'done';
    end if;
  end loop;

  return 'done';
exception
  when integrity_constraint_violation then
    get stacked diagnostics v_constraint = constraint_name;
    perform private.raise_worker_integrity_error(v_constraint);
    return null;
end;
$$;

-- `customer/redact` (D-M16e-04, D-M16e-30), en dos pasos:
--   1. si algún pedido a borrar (los listados más los locales del cliente) no tiene marca
--      de supresión, la inserta y devuelve `marked`;
--   2. si todos la tienen, borra líneas, pedidos y cliente, recalcula y devuelve `done`.
create function worker_api.tn_privacy_customer_redact(
  p_store_id text, p_customer_id text, p_order_ids text[])
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company    uuid;
  v_conn       record;
  v_marked     integer := 0;
  v_count      integer;
  v_days       date[];
  v_constraint text;
begin
  if p_store_id is null or p_customer_id is null or p_order_ids is null
     or p_store_id !~ '^[1-9][0-9]{0,19}$' or p_customer_id !~ '^[1-9][0-9]{0,19}$'
     or pg_catalog.array_ndims(p_order_ids) > 1
     or pg_catalog.cardinality(p_order_ids) > 10000
     or pg_catalog.array_position(p_order_ids, null) is not null
     or exists (select 1 from pg_catalog.unnest(p_order_ids) o where o !~ '^[1-9][0-9]{0,19}$') then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;

  for v_company in
    select distinct c.company_id from public.integration_connections c
     where c.provider::text = 'tiendanube' and c.external_account_id = p_store_id
     order by c.company_id
  loop
    perform private.lock_company(v_company);
  end loop;

  for v_conn in
    select c.id, c.company_id from public.integration_connections c
     where c.provider::text = 'tiendanube' and c.external_account_id = p_store_id
     order by c.company_id, c.id
  loop
    insert into private.tn_redaction_suppressions
      (company_id, connection_id, external_customer_id, external_order_id)
    select v_conn.company_id, v_conn.id, p_customer_id, x.order_id
      from (select pg_catalog.unnest(p_order_ids) as order_id
            union
            select o.external_order_id from private.tn_orders o
             where o.connection_id = v_conn.id and o.external_customer_id = p_customer_id) x
    on conflict on constraint tn_redaction_suppressions_pkey do nothing;
    get diagnostics v_count = row_count;
    v_marked := v_marked + v_count;
  end loop;

  if v_marked > 0 then
    return 'marked';
  end if;

  for v_conn in
    select c.id, c.company_id from public.integration_connections c
     where c.provider::text = 'tiendanube' and c.external_account_id = p_store_id
     order by c.company_id, c.id
  loop
    with gone as (
      delete from private.tn_orders o
       using private.tn_redaction_suppressions s
       where s.connection_id = v_conn.id
         and s.external_customer_id = p_customer_id
         and o.connection_id = v_conn.id
         and o.external_order_id = s.external_order_id
      returning o.local_day
    )
    select pg_catalog.array_agg(distinct g.local_day) into v_days from gone g;

    delete from private.tn_customers c
     where c.connection_id = v_conn.id and c.external_customer_id = p_customer_id
       and not exists (select 1 from private.tn_orders o
                        where o.connection_id = v_conn.id
                          and o.external_customer_id = p_customer_id);

    perform private.tn_recalc_days(v_conn.id, v_days);
    perform private.tn_recalc_cohorts(v_conn.id);
  end loop;

  return 'done';
exception
  when integrity_constraint_violation then
    get stacked diagnostics v_constraint = constraint_name;
    perform private.raise_worker_integrity_error(v_constraint);
    return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Lecturas de agregados (SECURITY INVOKER, bajo RLS)
--
-- No llaman a helpers privados: corren como `authenticated`, que no tiene EXECUTE sobre
-- ellos. El último día cubierto se calcula en línea, igual que `private.tn_covered_through`.
-- ---------------------------------------------------------------------------

create function public.get_tn_sync_status(p_connection_id uuid)
returns table (
  phase                text,
  backfill_done        boolean,
  coverage_until       timestamptz,
  covered_through      date,
  timezone             text,
  currency             text,
  store_domain         text,
  last_run_started_at  timestamptz,
  last_run_finished_at timestamptz,
  last_run_status      text,
  last_error_kind      text,
  last_fetched_at      timestamptz,
  catalog_complete_at  timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.phase, s.backfill_done_at is not null, s.coverage_until,
         (s.coverage_until at time zone c.timezone)::date - 1, c.timezone, c.currency,
         s.store_domain, s.last_run_started_at, s.last_run_finished_at, s.last_run_status,
         s.last_error_kind, s.last_fetched_at, s.catalog_complete_at
    from public.tn_sync_status s
    join public.integration_connections c
      on c.id = s.connection_id and c.company_id = s.company_id
   where s.connection_id = p_connection_id
     and c.provider::text = 'tiendanube'
$$;

-- Ventas por día o mes en la zona de la tienda, una fila por período y moneda. Un período
-- sin pedidos devuelve una fila con moneda nula y ceros; `covered` distingue el cero real
-- de la ventana no cubierta (§3).
create function public.get_tn_sales(p_connection_id uuid, p_from date, p_to date, p_grain text)
returns table (
  period_start                 date,
  currency                     text,
  paid_orders                  integer,
  paid_orders_without_customer integer,
  partially_paid_orders        integer,
  paid_amount                  numeric,
  refunded_amount              numeric,
  covered                      boolean,
  fetched_at                   timestamptz,
  timezone                     text,
  definition                   text
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_timezone text;
  v_through  date;
  v_fetched  timestamptz;
begin
  if p_connection_id is null or p_from is null or p_to is null or p_grain is null
     or p_grain not in ('day', 'month') or p_to < p_from or p_to - p_from > 730 then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;

  select c.timezone, (s.coverage_until at time zone c.timezone)::date - 1, s.last_fetched_at
    into v_timezone, v_through, v_fetched
    from public.integration_connections c
    join public.tn_sync_status s on s.connection_id = c.id and s.company_id = c.company_id
   where c.id = p_connection_id and c.provider::text = 'tiendanube';
  if not found then
    return;
  end if;

  return query
  with periods as (
    select g::date as ps,
           greatest(g::date, p_from) as lo,
           least(case when p_grain = 'day' then g::date
                      else (g + interval '1 month')::date - 1 end, p_to) as hi
      from pg_catalog.generate_series(
             case when p_grain = 'day' then p_from::timestamp
                  else pg_catalog.date_trunc('month', p_from::timestamp) end,
             p_to::timestamp,
             case when p_grain = 'day' then interval '1 day' else interval '1 month' end) as g
  ), sums as (
    select p.ps, d.currency,
           pg_catalog.sum(d.paid_orders)::integer as paid_orders,
           pg_catalog.sum(d.paid_orders_without_customer)::integer as without_customer,
           pg_catalog.sum(d.partially_paid_orders)::integer as partially_paid,
           pg_catalog.sum(d.paid_amount) as paid_amount,
           pg_catalog.sum(d.refunded_amount) as refunded_amount
      from periods p
      join public.tn_sales_daily d
        on d.connection_id = p_connection_id and d.day between p.lo and p.hi
     group by p.ps, d.currency
  )
  select p.ps, s.currency, coalesce(s.paid_orders, 0), coalesce(s.without_customer, 0),
         coalesce(s.partially_paid, 0), coalesce(s.paid_amount, 0),
         coalesce(s.refunded_amount, 0),
         v_through is not null and p.hi <= v_through,
         v_fetched, v_timezone, 'tn_sales_v1'::text
    from periods p
    left join sums s on s.ps = p.ps
   order by p.ps, s.currency nulls first;
end;
$$;

-- Ranking por unidades de pedidos pagados elegibles (D-M16e-19), con desempate por nombre.
create function public.get_tn_product_units(
  p_connection_id uuid, p_from date, p_to date, p_limit integer)
returns table (
  rank        integer,
  product_key uuid,
  variant_key uuid,
  name        text,
  sku         text,
  deleted     boolean,
  units       bigint,
  covered     boolean,
  fetched_at  timestamptz,
  timezone    text,
  definition  text
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_timezone text;
  v_through  date;
  v_fetched  timestamptz;
begin
  if p_connection_id is null or p_from is null or p_to is null or p_limit is null
     or p_to < p_from or p_to - p_from > 730 or p_limit not between 1 and 50 then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;

  select c.timezone, (s.coverage_until at time zone c.timezone)::date - 1, s.last_fetched_at
    into v_timezone, v_through, v_fetched
    from public.integration_connections c
    join public.tn_sync_status s on s.connection_id = c.id and s.company_id = c.company_id
   where c.id = p_connection_id and c.provider::text = 'tiendanube';
  if not found then
    return;
  end if;

  return query
  select (pg_catalog.row_number() over (order by t.units desc, t.name, t.sku nulls last,
                                                t.product_key, t.variant_key nulls first))::integer,
         t.product_key, t.variant_key, t.name, t.sku, t.deleted, t.units,
         v_through is not null and p_to <= v_through, v_fetched, v_timezone,
         'tn_product_units_v1'::text
    from (select u.product_key, u.variant_key, pg_catalog.max(u.name) as name,
                 pg_catalog.max(u.sku) as sku, pg_catalog.bool_or(u.deleted) as deleted,
                 pg_catalog.sum(u.units)::bigint as units
            from public.tn_product_units_daily u
           where u.connection_id = p_connection_id and u.day between p_from and p_to
           group by u.product_key, u.variant_key) t
   order by 1
   limit p_limit;
end;
$$;

-- Cohortes con la regla de cinco ya aplicada al escribir (§5).
create function public.get_tn_cohorts(
  p_connection_id uuid, p_from_month date, p_to_month date, p_max_offset integer)
returns table (
  cohort_month  date,
  month_offset  integer,
  cohort_size   integer,
  active        integer,
  retention     numeric,
  size_hidden   boolean,
  active_hidden boolean,
  partial       boolean,
  fetched_at    timestamptz,
  timezone      text,
  definition    text
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_timezone text;
  v_fetched  timestamptz;
begin
  if p_connection_id is null or p_from_month is null or p_to_month is null
     or p_max_offset is null or p_to_month < p_from_month
     or p_from_month <> pg_catalog.date_trunc('month', p_from_month)::date
     or p_to_month <> pg_catalog.date_trunc('month', p_to_month)::date
     or p_max_offset not between 0 and 60
     or p_to_month > (p_from_month + interval '120 months')::date then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;

  select c.timezone, s.last_fetched_at into v_timezone, v_fetched
    from public.integration_connections c
    join public.tn_sync_status s on s.connection_id = c.id and s.company_id = c.company_id
   where c.id = p_connection_id and c.provider::text = 'tiendanube';
  if not found then
    return;
  end if;

  return query
  select x.cohort_month, x.month_offset, x.cohort_size, x.active,
         case when x.cohort_size is null or x.active is null then null
              else pg_catalog.round(x.active::numeric / x.cohort_size, 4) end,
         x.size_hidden, x.active_hidden, x.partial, v_fetched, v_timezone, 'tn_cohorts_v1'::text
    from public.tn_cohort_cells x
   where x.connection_id = p_connection_id
     and x.cohort_month between p_from_month and p_to_month
     and x.month_offset <= p_max_offset
   order by x.cohort_month, x.month_offset;
end;
$$;

-- ---------------------------------------------------------------------------
-- Privilegios de funciones
-- ---------------------------------------------------------------------------

revoke all on function worker_api.create_oauth_attempt(
  uuid, uuid, public.integration_provider, text, text, text, text, timestamptz, uuid)
  from public, anon, authenticated, service_role;
revoke all on function worker_api.consume_oauth_attempt(
  uuid, uuid, public.integration_provider, text, text)
  from public, anon, authenticated, service_role;
revoke all on function worker_api.create_pending_connection(
  uuid, uuid, uuid, public.integration_provider, text, text, text, text, integer, text, text,
  text[], timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function worker_api.list_pending_purges(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function worker_api.tn_start_sync(uuid, uuid, uuid, integer, uuid, uuid, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function worker_api.tn_publish_orders(
  uuid, uuid, uuid, integer, uuid, uuid, jsonb, jsonb, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function worker_api.tn_publish_catalog(
  uuid, uuid, uuid, integer, uuid, uuid, jsonb, jsonb, boolean)
  from public, anon, authenticated, service_role;
revoke all on function worker_api.tn_finish_sync(
  uuid, uuid, uuid, integer, uuid, uuid, timestamptz, boolean)
  from public, anon, authenticated, service_role;
revoke all on function worker_api.tn_fail_sync(uuid, uuid, uuid, integer, uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all on function worker_api.tn_privacy_store_redact(text, integer)
  from public, anon, authenticated, service_role;
revoke all on function worker_api.tn_privacy_customer_redact(text, text, text[])
  from public, anon, authenticated, service_role;

grant execute on function worker_api.create_oauth_attempt(
  uuid, uuid, public.integration_provider, text, text, text, text, timestamptz, uuid)
  to praxa_integrations;
grant execute on function worker_api.consume_oauth_attempt(
  uuid, uuid, public.integration_provider, text, text) to praxa_integrations;
grant execute on function worker_api.create_pending_connection(
  uuid, uuid, uuid, public.integration_provider, text, text, text, text, integer, text, text,
  text[], timestamptz) to praxa_integrations;
grant execute on function worker_api.list_pending_purges(uuid, uuid) to praxa_integrations;
grant execute on function worker_api.tn_start_sync(uuid, uuid, uuid, integer, uuid, uuid, timestamptz)
  to praxa_integrations;
grant execute on function worker_api.tn_publish_orders(
  uuid, uuid, uuid, integer, uuid, uuid, jsonb, jsonb, jsonb) to praxa_integrations;
grant execute on function worker_api.tn_publish_catalog(
  uuid, uuid, uuid, integer, uuid, uuid, jsonb, jsonb, boolean) to praxa_integrations;
grant execute on function worker_api.tn_finish_sync(
  uuid, uuid, uuid, integer, uuid, uuid, timestamptz, boolean) to praxa_integrations;
grant execute on function worker_api.tn_fail_sync(uuid, uuid, uuid, integer, uuid, uuid, text, text)
  to praxa_integrations;
grant execute on function worker_api.tn_privacy_store_redact(text, integer) to praxa_integrations;
grant execute on function worker_api.tn_privacy_customer_redact(text, text, text[])
  to praxa_integrations;

revoke all on function public.get_tn_sync_status(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.get_tn_sales(uuid, date, date, text)
  from public, anon, authenticated, service_role;
revoke all on function public.get_tn_product_units(uuid, date, date, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.get_tn_cohorts(uuid, date, date, integer)
  from public, anon, authenticated, service_role;

grant execute on function public.get_tn_sync_status(uuid) to authenticated;
grant execute on function public.get_tn_sales(uuid, date, date, text) to authenticated;
grant execute on function public.get_tn_product_units(uuid, date, date, integer) to authenticated;
grant execute on function public.get_tn_cohorts(uuid, date, date, integer) to authenticated;
