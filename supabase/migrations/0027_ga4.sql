-- PRAXA 0027 — GA4: forma, credencial, agregados y acceso acotado.
--
-- Matriz de privilegios de los objetos nuevos (M16f-T-01):
-- Objeto                                      anon  authenticated  praxa_integrations  PUBLIC  service_role
-- public.ga4_* (ocho tablas)                  —     SELECT/RLS     —                   —       —
-- private.ga4_* (cuatro tablas)               —     —              —                   —       —
-- public.get_ga4_* (siete funciones INVOKER) —     EXECUTE        —                   —       —
-- worker_api.ga4_* (cinco funciones DEFINER) —     —              EXECUTE             —       —
-- private.ga4_* helpers                      —     —              —                   —       —
-- Funciones existentes reemplazadas sin cambiar firma: create_pending_connection,
-- replace_credential y purge_connection. Sus grants siguen acotados al rol de C.

-- Proveedor: la conexión de GA4 solo guarda el número de la propiedad y ningún
-- estado específico de Meta. La unicidad por (empresa, proveedor) ya existe.
alter table public.integration_connections
  drop constraint integration_connections_provider_shape;
alter table public.integration_connections
  add constraint integration_connections_provider_shape
  check (provider::text = 'meta'
         or (provider::text in ('tiendanube', 'ga4')
             and client_business_id is null
             and meta_sync_summary is null
             and current_sync_run_id is null
             and (external_account_id is null
                  or external_account_id ~ '^[1-9][0-9]{0,19}$')));

create or replace function private.valid_provider_scopes(p_provider text, p_scopes text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(case p_provider
    when 'meta' then private.valid_granted_scopes(p_scopes)
    when 'tiendanube' then
      p_scopes is not null and pg_catalog.array_ndims(p_scopes) = 1
      and pg_catalog.cardinality(p_scopes) = 3
      and pg_catalog.array_position(p_scopes, null) is null
      and (select pg_catalog.count(distinct s) = 3
                  and pg_catalog.bool_and(s in ('read_customers', 'read_orders', 'read_products'))
             from pg_catalog.unnest(p_scopes) as s)
    when 'ga4' then p_scopes = array['https://www.googleapis.com/auth/analytics.readonly']::text[]
    else false end, false)
$$;
revoke all on function private.valid_provider_scopes(text, text[])
  from public, anon, authenticated, service_role, praxa_integrations;

alter table private.integration_credentials
  drop constraint integration_credentials_token_type,
  drop constraint integration_credentials_scopes;
alter table private.integration_credentials
  add constraint integration_credentials_token_type
    check ((provider::text = 'meta' and token_type = 'system_user')
           or (provider::text = 'tiendanube' and token_type = 'store_app_token'
               and expires_at is null)
           or (provider::text = 'ga4' and token_type = 'google_refresh_token'
               and expires_at is null and issued_for_app_id ~ '^[1-9][0-9]*$')),
  add constraint integration_credentials_scopes
    check (private.valid_provider_scopes(provider::text, granted_scopes));

create table private.ga4_sync_runs (
  id uuid primary key,
  company_id uuid not null,
  connection_id uuid not null,
  credential_generation integer not null check (credential_generation >= 0),
  lease_token uuid not null,
  phase text not null check (phase in ('backfill', 'incremental')),
  status text not null check (status in ('running', 'complete', 'incomplete', 'failed', 'superseded')),
  target_reports text[] not null default '{}',
  preflight jsonb not null default '{}'::jsonb,
  checkpoint jsonb not null default '{}'::jsonb,
  window_from date,
  window_to date,
  report_id text,
  started_at timestamptz not null,
  lease_expires_at timestamptz not null,
  finished_at timestamptz,
  error_kind text,
  pages_fetched integer not null default 0 check (pages_fetched >= 0),
  quota_remaining integer check (quota_remaining >= 0),
  fetched_at timestamptz,
  constraint ga4_sync_runs_connection_fkey foreign key (company_id, connection_id)
    references public.integration_connections (company_id, id) on delete cascade,
  constraint ga4_sync_runs_lease check (lease_expires_at > started_at),
  constraint ga4_sync_runs_dates check (window_from is null or window_to >= window_from),
  constraint ga4_sync_runs_json check (jsonb_typeof(preflight) = 'object' and jsonb_typeof(checkpoint) = 'object')
);
create unique index ga4_sync_runs_one_running on private.ga4_sync_runs (connection_id)
  where status = 'running';
create index ga4_sync_runs_connection_idx on private.ga4_sync_runs (company_id, connection_id);

create table private.ga4_item_keys (
  company_id uuid not null,
  connection_id uuid not null,
  external_item_id text not null check (external_item_id <> ''),
  item_ref uuid not null default gen_random_uuid(),
  constraint ga4_item_keys_pkey primary key (connection_id, external_item_id),
  constraint ga4_item_keys_ref_key unique (connection_id, item_ref),
  constraint ga4_item_keys_connection_fkey foreign key (company_id, connection_id)
    references public.integration_connections (company_id, id) on delete cascade
);

create table private.ga4_item_rows (
  company_id uuid not null,
  connection_id uuid not null,
  day date not null,
  external_item_id text,
  item_ref uuid,
  item_name text,
  views bigint not null check (views >= 0),
  add_to_carts bigint not null check (add_to_carts >= 0),
  purchases bigint not null check (purchases >= 0),
  constraint ga4_item_rows_key unique nulls not distinct (connection_id, day, external_item_id),
  constraint ga4_item_rows_connection_fkey foreign key (company_id, connection_id)
    references public.integration_connections (company_id, id) on delete cascade,
  constraint ga4_item_rows_ref check ((external_item_id is null) = (item_ref is null))
);

create table private.ga4_campaign_rows (
  company_id uuid not null,
  connection_id uuid not null,
  day date not null,
  external_campaign_id text,
  sessions bigint not null check (sessions >= 0),
  quality_id uuid not null,
  constraint ga4_campaign_rows_key unique nulls not distinct (connection_id, day, external_campaign_id),
  constraint ga4_campaign_rows_connection_fkey foreign key (company_id, connection_id)
    references public.integration_connections (company_id, id) on delete cascade
);

create table public.ga4_sync_status (
  connection_id uuid primary key,
  company_id uuid not null,
  display_name text check (display_name is null or char_length(display_name) between 1 and 100),
  phase text check (phase is null or phase in ('backfill', 'incremental')),
  coverage_from date,
  coverage_through date,
  backfill_next date,
  last_step_at timestamptz,
  last_step_status text,
  last_error_kind text,
  last_fetched_at timestamptz,
  time_zone text,
  currency_code text check (currency_code is null or currency_code ~ '^[A-Z]{3}$'),
  preflight jsonb not null default '{}'::jsonb check (jsonb_typeof(preflight) = 'object'),
  preflight_at timestamptz,
  flags jsonb not null default '{}'::jsonb check (jsonb_typeof(flags) = 'object'),
  item_mapping_rule text check (item_mapping_rule is null or item_mapping_rule in ('variant', 'product', 'sku')),
  item_mapping_connection_id uuid,
  campaign_mapping_connection_id uuid,
  updated_at timestamptz not null default now(),
  constraint ga4_sync_status_connection_fkey foreign key (company_id, connection_id)
    references public.integration_connections (company_id, id) on delete cascade,
  constraint ga4_sync_status_dates check (coverage_from is null or coverage_through >= coverage_from)
);
create unique index ga4_sync_status_company_connection_key
  on public.ga4_sync_status (company_id, connection_id);

create table public.ga4_report_quality (
  quality_id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  connection_id uuid not null,
  report_id text not null,
  report_version integer not null check (report_version > 0),
  window_from date not null,
  window_to date not null,
  fetched_at timestamptz not null,
  row_count integer not null check (row_count >= 0),
  sampling_metadatas jsonb not null default '[]'::jsonb check (jsonb_typeof(sampling_metadatas) = 'array'),
  subject_to_thresholding boolean not null default false,
  data_loss_from_other_row boolean not null default false,
  data_truncation_reasons text[] not null default '{}',
  restricted_metrics jsonb not null default '[]'::jsonb check (jsonb_typeof(restricted_metrics) = 'array'),
  empty_reason text,
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  time_zone text not null,
  constraint ga4_report_quality_connection_fkey foreign key (company_id, connection_id)
    references public.integration_connections (company_id, id) on delete cascade,
  constraint ga4_report_quality_company_key unique (company_id, connection_id, quality_id),
  constraint ga4_report_quality_window_key unique (connection_id, report_id, report_version, window_from, window_to),
  constraint ga4_report_quality_catalog check (report_id in (
    'ga4_trafico_dia', 'ga4_trafico_fuente', 'ga4_cohortes',
    'ga4_campanias', 'ga4_embudo', 'ga4_productos')),
  constraint ga4_report_quality_dates check (window_to >= window_from)
);

create table public.ga4_traffic_daily (
  company_id uuid not null,
  connection_id uuid not null,
  day date not null,
  sessions bigint not null check (sessions >= 0),
  active_users bigint not null check (active_users >= 0),
  new_users bigint not null check (new_users >= 0),
  meta_visits bigint check (meta_visits >= 0),
  provisional boolean not null,
  traffic_quality_id uuid not null,
  source_quality_id uuid,
  constraint ga4_traffic_daily_pkey primary key (connection_id, day),
  constraint ga4_traffic_daily_connection_fkey foreign key (company_id, connection_id)
    references public.integration_connections (company_id, id) on delete cascade,
  constraint ga4_traffic_daily_traffic_quality_fkey foreign key (company_id, connection_id, traffic_quality_id)
    references public.ga4_report_quality (company_id, connection_id, quality_id),
  constraint ga4_traffic_daily_source_quality_fkey foreign key (company_id, connection_id, source_quality_id)
    references public.ga4_report_quality (company_id, connection_id, quality_id)
);

create table public.ga4_source_daily (
  company_id uuid not null,
  connection_id uuid not null,
  day date not null,
  source text not null check (char_length(source) between 1 and 200),
  medium text not null check (char_length(medium) between 1 and 200),
  sessions bigint not null check (sessions >= 0),
  quality_id uuid not null,
  constraint ga4_source_daily_pkey primary key (connection_id, day, source, medium),
  constraint ga4_source_daily_connection_fkey foreign key (company_id, connection_id)
    references public.integration_connections (company_id, id) on delete cascade,
  constraint ga4_source_daily_quality_fkey foreign key (company_id, connection_id, quality_id)
    references public.ga4_report_quality (company_id, connection_id, quality_id)
);

create table public.ga4_funnel_daily (
  company_id uuid not null,
  connection_id uuid not null,
  day date not null,
  event_name text not null check (event_name in ('view_item', 'add_to_cart', 'begin_checkout', 'purchase')),
  event_count bigint not null check (event_count >= 0),
  quality_id uuid not null,
  constraint ga4_funnel_daily_pkey primary key (connection_id, day, event_name),
  constraint ga4_funnel_daily_connection_fkey foreign key (company_id, connection_id)
    references public.integration_connections (company_id, id) on delete cascade,
  constraint ga4_funnel_daily_quality_fkey foreign key (company_id, connection_id, quality_id)
    references public.ga4_report_quality (company_id, connection_id, quality_id)
);

create table public.ga4_item_daily (
  company_id uuid not null,
  connection_id uuid not null,
  day date not null,
  item_ref uuid,
  tn_product_key uuid,
  item_name text,
  views bigint not null check (views >= 0),
  add_to_carts bigint not null check (add_to_carts >= 0),
  purchases bigint not null check (purchases >= 0),
  quality_id uuid not null,
  constraint ga4_item_daily_key unique nulls not distinct (connection_id, day, item_ref),
  constraint ga4_item_daily_connection_fkey foreign key (company_id, connection_id)
    references public.integration_connections (company_id, id) on delete cascade,
  constraint ga4_item_daily_quality_fkey foreign key (company_id, connection_id, quality_id)
    references public.ga4_report_quality (company_id, connection_id, quality_id)
);

create table public.ga4_campaign_daily (
  company_id uuid not null,
  connection_id uuid not null,
  day date not null,
  entity_ref uuid,
  sessions bigint not null check (sessions >= 0),
  quality_id uuid not null,
  constraint ga4_campaign_daily_key unique nulls not distinct (connection_id, day, entity_ref),
  constraint ga4_campaign_daily_connection_fkey foreign key (company_id, connection_id)
    references public.integration_connections (company_id, id) on delete cascade,
  constraint ga4_campaign_daily_quality_fkey foreign key (company_id, connection_id, quality_id)
    references public.ga4_report_quality (company_id, connection_id, quality_id)
);

create table public.ga4_visitor_cohorts (
  company_id uuid not null,
  connection_id uuid not null,
  cohort_month date not null,
  month_offset integer not null check (month_offset between 0 and 11),
  cohort_size bigint,
  active bigint,
  size_hidden boolean not null,
  active_hidden boolean not null,
  provisional boolean not null,
  quality_id uuid not null,
  constraint ga4_visitor_cohorts_pkey primary key (connection_id, cohort_month, month_offset),
  constraint ga4_visitor_cohorts_connection_fkey foreign key (company_id, connection_id)
    references public.integration_connections (company_id, id) on delete cascade,
  constraint ga4_visitor_cohorts_quality_fkey foreign key (company_id, connection_id, quality_id)
    references public.ga4_report_quality (company_id, connection_id, quality_id),
  constraint ga4_visitor_cohorts_month check (cohort_month = pg_catalog.date_trunc('month', cohort_month)::date),
  constraint ga4_visitor_cohorts_hidden check (
    (cohort_size is null or cohort_size >= 5) and (active is null or active >= 5)
    and size_hidden = (cohort_size is null) and active_hidden = (active is null)
    and (not size_hidden or active_hidden)
    and (active is null or cohort_size is null or active <= cohort_size))
);

-- Sin grants directos al rol de C: solo las funciones worker_api escriben.
revoke all on private.ga4_sync_runs from public, anon, authenticated, service_role, praxa_integrations;
revoke all on private.ga4_item_keys from public, anon, authenticated, service_role, praxa_integrations;
revoke all on private.ga4_item_rows from public, anon, authenticated, service_role, praxa_integrations;
revoke all on private.ga4_campaign_rows from public, anon, authenticated, service_role, praxa_integrations;
revoke all on public.ga4_sync_status from public, anon, authenticated, service_role, praxa_integrations;
revoke all on public.ga4_report_quality from public, anon, authenticated, service_role, praxa_integrations;
revoke all on public.ga4_traffic_daily from public, anon, authenticated, service_role, praxa_integrations;
revoke all on public.ga4_source_daily from public, anon, authenticated, service_role, praxa_integrations;
revoke all on public.ga4_funnel_daily from public, anon, authenticated, service_role, praxa_integrations;
revoke all on public.ga4_item_daily from public, anon, authenticated, service_role, praxa_integrations;
revoke all on public.ga4_campaign_daily from public, anon, authenticated, service_role, praxa_integrations;
revoke all on public.ga4_visitor_cohorts from public, anon, authenticated, service_role, praxa_integrations;

alter table private.ga4_sync_runs enable row level security;
alter table private.ga4_sync_runs force row level security;
alter table private.ga4_item_keys enable row level security;
alter table private.ga4_item_keys force row level security;
alter table private.ga4_item_rows enable row level security;
alter table private.ga4_item_rows force row level security;
alter table private.ga4_campaign_rows enable row level security;
alter table private.ga4_campaign_rows force row level security;
alter table public.ga4_sync_status enable row level security;
alter table public.ga4_sync_status force row level security;
alter table public.ga4_report_quality enable row level security;
alter table public.ga4_report_quality force row level security;
alter table public.ga4_traffic_daily enable row level security;
alter table public.ga4_traffic_daily force row level security;
alter table public.ga4_source_daily enable row level security;
alter table public.ga4_source_daily force row level security;
alter table public.ga4_funnel_daily enable row level security;
alter table public.ga4_funnel_daily force row level security;
alter table public.ga4_item_daily enable row level security;
alter table public.ga4_item_daily force row level security;
alter table public.ga4_campaign_daily enable row level security;
alter table public.ga4_campaign_daily force row level security;
alter table public.ga4_visitor_cohorts enable row level security;
alter table public.ga4_visitor_cohorts force row level security;

-- La membresía sola no alcanza: la conexión debe ser GA4 y seguir viva.
create policy ga4_sync_status_select_member on public.ga4_sync_status for select to authenticated
  using (private.is_company_member(company_id) and exists (
    select 1 from public.integration_connections c
     where c.id = ga4_sync_status.connection_id and c.company_id = ga4_sync_status.company_id
       and c.provider::text = 'ga4' and c.status in ('active', 'needs_reauth')));
create policy ga4_report_quality_select_member on public.ga4_report_quality for select to authenticated
  using (private.is_company_member(company_id) and exists (
    select 1 from public.integration_connections c
     where c.id = ga4_report_quality.connection_id and c.company_id = ga4_report_quality.company_id
       and c.provider::text = 'ga4' and c.status in ('active', 'needs_reauth')));
create policy ga4_traffic_daily_select_member on public.ga4_traffic_daily for select to authenticated
  using (private.is_company_member(company_id) and exists (
    select 1 from public.integration_connections c
     where c.id = ga4_traffic_daily.connection_id and c.company_id = ga4_traffic_daily.company_id
       and c.provider::text = 'ga4' and c.status in ('active', 'needs_reauth')));
create policy ga4_source_daily_select_member on public.ga4_source_daily for select to authenticated
  using (private.is_company_member(company_id) and exists (
    select 1 from public.integration_connections c
     where c.id = ga4_source_daily.connection_id and c.company_id = ga4_source_daily.company_id
       and c.provider::text = 'ga4' and c.status in ('active', 'needs_reauth')));
create policy ga4_funnel_daily_select_member on public.ga4_funnel_daily for select to authenticated
  using (private.is_company_member(company_id) and exists (
    select 1 from public.integration_connections c
     where c.id = ga4_funnel_daily.connection_id and c.company_id = ga4_funnel_daily.company_id
       and c.provider::text = 'ga4' and c.status in ('active', 'needs_reauth')));
create policy ga4_item_daily_select_member on public.ga4_item_daily for select to authenticated
  using (private.is_company_member(company_id) and exists (
    select 1 from public.integration_connections c
     where c.id = ga4_item_daily.connection_id and c.company_id = ga4_item_daily.company_id
       and c.provider::text = 'ga4' and c.status in ('active', 'needs_reauth')));
create policy ga4_campaign_daily_select_member on public.ga4_campaign_daily for select to authenticated
  using (private.is_company_member(company_id) and exists (
    select 1 from public.integration_connections c
     where c.id = ga4_campaign_daily.connection_id and c.company_id = ga4_campaign_daily.company_id
       and c.provider::text = 'ga4' and c.status in ('active', 'needs_reauth')));
create policy ga4_visitor_cohorts_select_member on public.ga4_visitor_cohorts for select to authenticated
  using (private.is_company_member(company_id) and exists (
    select 1 from public.integration_connections c
     where c.id = ga4_visitor_cohorts.connection_id and c.company_id = ga4_visitor_cohorts.company_id
       and c.provider::text = 'ga4' and c.status in ('active', 'needs_reauth')));

grant select on public.ga4_sync_status to authenticated;
grant select on public.ga4_report_quality to authenticated;
grant select on public.ga4_traffic_daily to authenticated;
grant select on public.ga4_source_daily to authenticated;
grant select on public.ga4_funnel_daily to authenticated;
grant select on public.ga4_item_daily to authenticated;
grant select on public.ga4_campaign_daily to authenticated;
grant select on public.ga4_visitor_cohorts to authenticated;

create or replace function worker_api.create_pending_connection(
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
     or (p_provider::text = 'ga4' and p_issued_for_app_id !~ '^[1-9][0-9]*$')
     or (p_provider::text <> 'ga4' and p_issued_for_app_id !~ '^[A-Za-z0-9_-]{1,64}$')
     or not private.valid_provider_scopes(p_provider::text, p_granted_scopes)
     or (p_provider::text = 'meta'
         and (p_client_business_id is null
              or p_client_business_id !~ '^[A-Za-z0-9_-]{1,64}$'
              or p_token_type <> 'system_user'))
     or (p_provider::text = 'tiendanube'
         and (p_client_business_id is not null
              or p_token_type <> 'store_app_token'
              or p_token_expires_at is not null))
     or (p_provider::text = 'ga4'
         and (p_client_business_id is not null
              or p_token_type <> 'google_refresh_token'
              or p_token_expires_at is not null)) then
    raise exception 'praxa: argumento invÃ¡lido' using errcode = '22023';
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
    raise exception 'praxa: la empresa ya tiene una conexiÃ³n' using errcode = 'PX003';
  end if;

  if exists (select 1 from public.integration_connections c where c.id = p_connection_id) then
    raise exception 'praxa: operaciÃ³n no autorizada' using errcode = 'PX001';
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

-- Helpers invocados solo desde worker_api, que ejecuta como el dueño de la migración.
create function private.ga4_locked_connection(
  p_actor_user_id uuid, p_company_id uuid, p_connection_id uuid, p_generation integer)
returns public.integration_connections
language plpgsql
set search_path = ''
as $$
declare v_connection public.integration_connections;
begin
  perform private.assert_worker_actor(p_actor_user_id, p_company_id);
  if p_connection_id is null or p_generation is null or p_generation < 0 then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;
  perform private.lock_company(p_company_id);
  select c.* into v_connection from public.integration_connections c
   where c.id = p_connection_id and c.company_id = p_company_id for update;
  if not found or v_connection.provider::text <> 'ga4' then
    raise exception 'praxa: operación no autorizada' using errcode = 'PX001';
  end if;
  if v_connection.status <> 'active' then
    raise exception 'praxa: transición de estado no permitida' using errcode = 'PX004';
  end if;
  if v_connection.credential_generation <> p_generation then
    raise exception 'praxa: la credencial cambió; volvé a empezar' using errcode = 'PX006';
  end if;
  return v_connection;
end;
$$;

create function private.ga4_locked_run(
  p_actor_user_id uuid, p_company_id uuid, p_connection_id uuid,
  p_generation integer, p_run_id uuid, p_lease_token uuid)
returns private.ga4_sync_runs
language plpgsql
set search_path = ''
as $$
declare v_run private.ga4_sync_runs;
begin
  perform private.ga4_locked_connection(p_actor_user_id, p_company_id, p_connection_id, p_generation);
  if p_run_id is null or p_lease_token is null then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;
  select r.* into v_run from private.ga4_sync_runs r
   where r.id = p_run_id and r.company_id = p_company_id and r.connection_id = p_connection_id
     and r.credential_generation = p_generation and r.lease_token = p_lease_token
     and r.status = 'running' and r.lease_expires_at > now() for update;
  if not found then
    raise exception 'praxa: ejecución o lease inválido' using errcode = 'PX006';
  end if;
  return v_run;
end;
$$;

revoke all on function private.ga4_locked_connection(uuid, uuid, uuid, integer)
  from public, anon, authenticated, service_role, praxa_integrations;
revoke all on function private.ga4_locked_run(uuid, uuid, uuid, integer, uuid, uuid)
  from public, anon, authenticated, service_role, praxa_integrations;

create function worker_api.ga4_start_sync(
  p_actor_user_id uuid, p_company_id uuid, p_connection_id uuid,
  p_generation integer, p_run_id uuid, p_lease_token uuid,
  p_lease_expires_at timestamptz, p_phase text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare v_connection public.integration_connections;
        v_previous private.ga4_sync_runs;
begin
  v_connection := private.ga4_locked_connection(
    p_actor_user_id, p_company_id, p_connection_id, p_generation);
  if p_run_id is null or p_lease_token is null or p_lease_expires_at is null
     or p_lease_expires_at <= now() or p_lease_expires_at > now() + interval '15 minutes'
     or p_phase is null or p_phase not in ('backfill', 'incremental') then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;
  if exists (select 1 from private.ga4_sync_runs r where r.connection_id = p_connection_id
             and r.status = 'running') then
    raise exception 'praxa: ya hay una sincronización en curso' using errcode = 'PX003';
  end if;
  select r.* into v_previous from private.ga4_sync_runs r
   where r.connection_id = p_connection_id and r.company_id = p_company_id
     and r.credential_generation = p_generation and r.phase = p_phase
     and r.status = 'incomplete'
   order by r.finished_at desc limit 1;
  insert into private.ga4_sync_runs
    (id, company_id, connection_id, credential_generation, lease_token, phase,
     status, started_at, lease_expires_at, target_reports, preflight, checkpoint)
  values (p_run_id, p_company_id, p_connection_id, p_generation, p_lease_token,
          p_phase, 'running', now(), p_lease_expires_at,
          coalesce(v_previous.target_reports, '{}'::text[]),
          coalesce(v_previous.preflight, '{}'::jsonb),
          coalesce(v_previous.checkpoint, '{}'::jsonb));
  insert into public.ga4_sync_status (company_id, connection_id, phase, last_step_at, last_step_status)
  values (p_company_id, p_connection_id, p_phase, now(), 'running')
  on conflict (connection_id) do update
    set phase = excluded.phase, last_step_at = excluded.last_step_at,
        last_step_status = excluded.last_step_status, updated_at = now();
  return true;
end;
$$;

create function private.ga4_valid_preflight(p_preflight jsonb)
returns boolean
language plpgsql immutable set search_path = ''
as $$
declare v_key text; v_capability jsonb;
begin
  if p_preflight is null or jsonb_typeof(p_preflight) <> 'object'
     or (select count(*) from jsonb_object_keys(p_preflight)) <> 5
     or not p_preflight ?& array['trafico', 'cohortes', 'embudo', 'productos', 'campanias']
  then return false; end if;
  for v_key in select jsonb_object_keys(p_preflight) loop
    v_capability := p_preflight->v_key;
    if jsonb_typeof(v_capability) <> 'object'
       or not v_capability ?& array['status', 'reason']
       or (select count(*) from jsonb_object_keys(v_capability)) <> 2
       or v_capability->>'status' is null
       or v_capability->>'status' not in
          ('disponible', 'sin_instrumentacion', 'incompatible', 'restringida')
       or (v_capability->>'status' = 'disponible' and jsonb_typeof(v_capability->'reason') <> 'null')
       or (v_capability->>'status' <> 'disponible'
           and (jsonb_typeof(v_capability->'reason') <> 'string'
                or (v_capability->>'reason') !~ '^[a-z_]{1,64}$'))
    then return false; end if;
  end loop;
  return true;
end;
$$;
revoke all on function private.ga4_valid_preflight(jsonb)
  from public, anon, authenticated, service_role, praxa_integrations;

create function worker_api.ga4_set_preflight(
  p_actor_user_id uuid, p_company_id uuid, p_connection_id uuid,
  p_generation integer, p_run_id uuid, p_lease_token uuid,
  p_display_name text, p_time_zone text, p_currency_code text,
  p_preflight jsonb, p_target_reports text[])
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.ga4_locked_run(
    p_actor_user_id, p_company_id, p_connection_id, p_generation, p_run_id, p_lease_token);
  if p_display_name is null or char_length(p_display_name) not between 1 and 100
     or p_time_zone is null or char_length(p_time_zone) not between 1 and 100
     or p_currency_code is null or p_currency_code !~ '^[A-Z]{3}$'
     or not private.ga4_valid_preflight(p_preflight)
     or p_preflight->'trafico'->>'status' <> 'disponible'
     or p_preflight->'cohortes'->>'status' <> 'disponible'
     or p_target_reports is null
     or not p_target_reports @> array['ga4_trafico_dia', 'ga4_trafico_fuente', 'ga4_cohortes']::text[]
     or exists (select 1 from unnest(p_target_reports) x
                 where x is null or x not in ('ga4_trafico_dia', 'ga4_trafico_fuente',
                   'ga4_cohortes', 'ga4_campanias', 'ga4_embudo', 'ga4_productos'))
     or cardinality(p_target_reports) <> (select count(distinct x) from unnest(p_target_reports) x)
     or ('ga4_embudo' = any(p_target_reports)) <> (p_preflight->'embudo'->>'status' = 'disponible')
     or ('ga4_productos' = any(p_target_reports)) <> (p_preflight->'productos'->>'status' = 'disponible')
     or ('ga4_campanias' = any(p_target_reports)) <> (p_preflight->'campanias'->>'status' = 'disponible')
  then raise exception 'praxa: argumento inválido' using errcode = '22023'; end if;
  update private.ga4_sync_runs r set preflight = p_preflight, target_reports = p_target_reports
   where r.id = p_run_id;
  update public.ga4_sync_status s
     set display_name = p_display_name, time_zone = p_time_zone,
         currency_code = p_currency_code, preflight = p_preflight,
         preflight_at = now(), updated_at = now()
   where s.connection_id = p_connection_id and s.company_id = p_company_id;
  return true;
end;
$$;


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
     or p_key_version <= 0 or p_token_type not in ('system_user', 'store_app_token', 'google_refresh_token')
     or p_issued_for_app_id !~ '^[A-Za-z0-9_-]{1,64}$' then
    raise exception 'praxa: argumento invÃ¡lido' using errcode = '22023';
  end if;

  perform private.lock_company(p_company_id);

  select c.* into v_connection
  from public.integration_connections c
  where c.id = p_connection_id
    and c.company_id = p_company_id
  for update;

  if not found then
    raise exception 'praxa: operaciÃ³n no autorizada' using errcode = 'PX001';
  end if;

  if not private.valid_provider_scopes(v_connection.provider::text, p_granted_scopes)
     or (v_connection.provider::text = 'meta' and p_token_type <> 'system_user')
     or (v_connection.provider::text = 'tiendanube'
         and (p_token_type <> 'store_app_token' or p_token_expires_at is not null))
     or (v_connection.provider::text = 'ga4'
         and (p_token_type <> 'google_refresh_token' or p_token_expires_at is not null
              or p_issued_for_app_id !~ '^[1-9][0-9]*$')) then
    raise exception 'praxa: argumento invÃ¡lido' using errcode = '22023';
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
    raise exception 'praxa: la autorizaciÃ³n no es vÃ¡lida o ya se usÃ³' using errcode = 'PX002';
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
    raise exception 'praxa: transiciÃ³n de estado no permitida' using errcode = 'PX004';
  end if;

  if v_connection.credential_generation <> v_attempt.expected_generation then
    raise exception 'praxa: la credencial cambiÃ³; volvÃ© a empezar' using errcode = 'PX006';
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

  if v_connection.provider::text = 'ga4' then
    update private.ga4_sync_runs r
       set status = 'superseded', finished_at = now()
     where r.connection_id = p_connection_id and r.status = 'running';
    update public.ga4_sync_status s
       set last_step_status = 'superseded', last_step_at = now(), updated_at = now()
     where s.connection_id = p_connection_id;
  end if;

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
    raise exception 'praxa: argumento invÃ¡lido' using errcode = '22023';
  end if;
  perform private.lock_company(p_company_id);
  select c.* into v_connection from public.integration_connections c
   where c.id = p_connection_id and c.company_id = p_company_id for update;
  if not found then return false; end if;
  if v_connection.status <> 'disconnected' then
    raise exception 'praxa: transiciÃ³n de estado no permitida' using errcode = 'PX004';
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
  delete from public.ga4_traffic_daily x where x.connection_id = p_connection_id;
  delete from public.ga4_source_daily x where x.connection_id = p_connection_id;
  delete from public.ga4_funnel_daily x where x.connection_id = p_connection_id;
  delete from public.ga4_item_daily x where x.connection_id = p_connection_id;
  delete from public.ga4_campaign_daily x where x.connection_id = p_connection_id;
  delete from public.ga4_visitor_cohorts x where x.connection_id = p_connection_id;
  delete from public.ga4_report_quality x where x.connection_id = p_connection_id;
  delete from public.ga4_sync_status x where x.connection_id = p_connection_id;
  delete from private.ga4_item_rows x where x.connection_id = p_connection_id;
  delete from private.ga4_campaign_rows x where x.connection_id = p_connection_id;
  delete from private.ga4_item_keys x where x.connection_id = p_connection_id;
  delete from private.ga4_sync_runs x where x.connection_id = p_connection_id;
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

create function private.ga4_valid_quality(p_quality jsonb)
returns boolean
language plpgsql immutable set search_path = ''
as $$
declare v_item jsonb; v_pair jsonb;
begin
  if p_quality is null or jsonb_typeof(p_quality) <> 'object'
     or not p_quality ?& array['sampling_metadatas', 'subject_to_thresholding',
       'data_loss_from_other_row', 'data_truncation_reasons', 'restricted_metrics',
       'currency_code', 'time_zone']
     or exists (select 1 from jsonb_object_keys(p_quality) k
                 where k not in ('sampling_metadatas', 'subject_to_thresholding',
                   'data_loss_from_other_row', 'data_truncation_reasons',
                   'restricted_metrics', 'empty_reason', 'currency_code', 'time_zone'))
     or jsonb_typeof(p_quality->'sampling_metadatas') <> 'array'
     or jsonb_typeof(p_quality->'subject_to_thresholding') <> 'boolean'
     or jsonb_typeof(p_quality->'data_loss_from_other_row') <> 'boolean'
     or jsonb_typeof(p_quality->'data_truncation_reasons') <> 'array'
     or jsonb_typeof(p_quality->'restricted_metrics') <> 'array'
     or (p_quality->>'currency_code') !~ '^[A-Z]{3}$'
     or char_length(p_quality->>'time_zone') not between 1 and 100
     or (p_quality ? 'empty_reason' and jsonb_typeof(p_quality->'empty_reason') not in ('string', 'null'))
  then return false; end if;
  for v_item in select value from jsonb_array_elements(p_quality->'sampling_metadatas') loop
    if jsonb_typeof(v_item) <> 'object'
       or not v_item ?& array['samples_read_count', 'sampling_space_size']
       or (select count(*) from jsonb_object_keys(v_item)) <> 2
       or (v_item->>'samples_read_count') !~ '^[0-9]+$'
       or (v_item->>'sampling_space_size') !~ '^[0-9]+$'
    then return false; end if;
  end loop;
  for v_item in select value from jsonb_array_elements(p_quality->'restricted_metrics') loop
    if jsonb_typeof(v_item) <> 'object'
       or not v_item ?& array['metric_name', 'restricted_metric_types']
       or (select count(*) from jsonb_object_keys(v_item)) <> 2
       or char_length(v_item->>'metric_name') not between 1 and 100
       or jsonb_typeof(v_item->'restricted_metric_types') <> 'array'
    then return false; end if;
    for v_pair in select value from jsonb_array_elements(v_item->'restricted_metric_types') loop
      if jsonb_typeof(v_pair) <> 'string' or char_length(v_pair#>>'{}') not between 1 and 100
      then return false; end if;
    end loop;
  end loop;
  for v_item in select value from jsonb_array_elements(p_quality->'data_truncation_reasons') loop
    if jsonb_typeof(v_item) <> 'string' or char_length(v_item#>>'{}') not between 1 and 100
    then return false; end if;
  end loop;
  return true;
end;
$$;
revoke all on function private.ga4_valid_quality(jsonb)
  from public, anon, authenticated, service_role, praxa_integrations;

-- Una llamada publica una ventana completa: calidad y filas se reemplazan juntas.
-- Los IDs externos de ítems y campañas solo se insertan en tablas private.
create function worker_api.ga4_publish_report(
  p_actor_user_id uuid, p_company_id uuid, p_connection_id uuid,
  p_generation integer, p_run_id uuid, p_lease_token uuid,
  p_report_id text, p_report_version integer, p_window_from date, p_window_to date,
  p_quality jsonb, p_rows jsonb, p_checkpoint jsonb)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_run private.ga4_sync_runs;
  v_quality_id uuid;
  v_row jsonb;
  v_item_id text;
  v_item_ref uuid;
begin
  v_run := private.ga4_locked_run(
    p_actor_user_id, p_company_id, p_connection_id, p_generation, p_run_id, p_lease_token);
  if p_report_id is null or p_report_id not in ('ga4_trafico_dia', 'ga4_trafico_fuente',
      'ga4_cohortes', 'ga4_campanias', 'ga4_embudo', 'ga4_productos')
     or not p_report_id = any(v_run.target_reports)
     or p_report_version is null or p_report_version <> 1
     or p_window_from is null or p_window_to is null
     or p_window_to < p_window_from or p_rows is null or jsonb_typeof(p_rows) <> 'array'
     or jsonb_array_length(p_rows) > 25000
     or p_checkpoint is null or jsonb_typeof(p_checkpoint) <> 'object'
     or not private.ga4_valid_quality(p_quality)
     or (p_quality->>'currency_code') is distinct from
        (select s.currency_code from public.ga4_sync_status s where s.connection_id = p_connection_id)
     or (p_quality->>'time_zone') is distinct from
        (select s.time_zone from public.ga4_sync_status s where s.connection_id = p_connection_id)
  then raise exception 'praxa: argumento inválido' using errcode = '22023'; end if;
  for v_row in select value from jsonb_array_elements(p_rows) loop
    if jsonb_typeof(v_row) <> 'object' then
      raise exception 'praxa: argumento inválido' using errcode = '22023';
    end if;
    if p_report_id <> 'ga4_cohortes' and
       ((v_row->>'day') is null or (v_row->>'day')::date not between p_window_from and p_window_to) then
      raise exception 'praxa: argumento inválido' using errcode = '22023';
    end if;
  end loop;

  insert into public.ga4_report_quality as q
    (company_id, connection_id, report_id, report_version, window_from, window_to,
     fetched_at, row_count, sampling_metadatas, subject_to_thresholding, data_loss_from_other_row,
     data_truncation_reasons, restricted_metrics, empty_reason, currency_code, time_zone)
  values (p_company_id, p_connection_id, p_report_id, p_report_version,
    p_window_from, p_window_to, now(), jsonb_array_length(p_rows), p_quality->'sampling_metadatas',
    (p_quality->>'subject_to_thresholding')::boolean,
    (p_quality->>'data_loss_from_other_row')::boolean,
    array(select jsonb_array_elements_text(p_quality->'data_truncation_reasons')),
    p_quality->'restricted_metrics', p_quality->>'empty_reason',
    p_quality->>'currency_code', p_quality->>'time_zone')
  on conflict (connection_id, report_id, report_version, window_from, window_to)
  do update set fetched_at = excluded.fetched_at, row_count = excluded.row_count,
    sampling_metadatas = excluded.sampling_metadatas,
    subject_to_thresholding = excluded.subject_to_thresholding,
    data_loss_from_other_row = excluded.data_loss_from_other_row,
    data_truncation_reasons = excluded.data_truncation_reasons,
    restricted_metrics = excluded.restricted_metrics,
    empty_reason = excluded.empty_reason,
    currency_code = excluded.currency_code, time_zone = excluded.time_zone
  returning q.quality_id into v_quality_id;

  if p_report_id = 'ga4_trafico_dia' then
    delete from public.ga4_traffic_daily x where x.connection_id = p_connection_id
      and x.day between p_window_from and p_window_to;
    insert into public.ga4_traffic_daily
      (company_id, connection_id, day, sessions, active_users, new_users,
       meta_visits, provisional, traffic_quality_id, source_quality_id)
    select p_company_id, p_connection_id, x.day, x.sessions, x.active_users,
           x.new_users, null, x.provisional, v_quality_id, null
      from jsonb_to_recordset(p_rows) as x(day date, sessions bigint,
        active_users bigint, new_users bigint, provisional boolean);
  elsif p_report_id = 'ga4_trafico_fuente' then
    delete from public.ga4_source_daily x where x.connection_id = p_connection_id
      and x.day between p_window_from and p_window_to;
    insert into public.ga4_source_daily
      (company_id, connection_id, day, source, medium, sessions, quality_id)
    select p_company_id, p_connection_id, x.day, x.source,
           x.medium, x.sessions, v_quality_id
      from jsonb_to_recordset(p_rows) as x(day date, source text, medium text, sessions bigint);
    update public.ga4_traffic_daily t
       set meta_visits = coalesce((select sum(s.sessions) from public.ga4_source_daily s
            where s.connection_id = p_connection_id and s.day = t.day
              and lower(s.source) in ('facebook', 'fb', 'instagram', 'ig',
                'facebook.com', 'm.facebook.com', 'l.facebook.com', 'lm.facebook.com',
                'instagram.com', 'l.instagram.com')), 0),
           source_quality_id = v_quality_id
     where t.connection_id = p_connection_id and t.day between p_window_from and p_window_to;
  elsif p_report_id = 'ga4_embudo' then
    delete from public.ga4_funnel_daily x where x.connection_id = p_connection_id
      and x.day between p_window_from and p_window_to;
    insert into public.ga4_funnel_daily
      (company_id, connection_id, day, event_name, event_count, quality_id)
    select p_company_id, p_connection_id, x.day, x.event_name, x.event_count, v_quality_id
      from jsonb_to_recordset(p_rows) as x(day date, event_name text, event_count bigint);
  elsif p_report_id = 'ga4_productos' then
    delete from public.ga4_item_daily x where x.connection_id = p_connection_id
      and x.day between p_window_from and p_window_to;
    delete from private.ga4_item_rows x where x.connection_id = p_connection_id
      and x.day between p_window_from and p_window_to;
    for v_row in select value from jsonb_array_elements(p_rows) loop
      v_item_id := nullif(v_row->>'item_id', '');
      v_item_ref := null;
      if v_item_id is not null then
        insert into private.ga4_item_keys (company_id, connection_id, external_item_id)
        values (p_company_id, p_connection_id, v_item_id)
        on conflict (connection_id, external_item_id) do nothing;
        select k.item_ref into v_item_ref from private.ga4_item_keys k
         where k.connection_id = p_connection_id and k.external_item_id = v_item_id;
      end if;
      insert into private.ga4_item_rows
        (company_id, connection_id, day, external_item_id, item_ref, item_name,
         views, add_to_carts, purchases)
      values (p_company_id, p_connection_id, (v_row->>'day')::date, v_item_id,
        v_item_ref, nullif(v_row->>'item_name',''), (v_row->>'views')::bigint,
        (v_row->>'add_to_carts')::bigint, (v_row->>'purchases')::bigint)
      on conflict on constraint ga4_item_rows_key do update
        set views = ga4_item_rows.views + excluded.views,
            add_to_carts = ga4_item_rows.add_to_carts + excluded.add_to_carts,
            purchases = ga4_item_rows.purchases + excluded.purchases,
            item_name = case when ga4_item_rows.item_name is null then excluded.item_name
              when excluded.item_name is null then ga4_item_rows.item_name
              else least(ga4_item_rows.item_name, excluded.item_name) end;
      insert into public.ga4_item_daily
        (company_id, connection_id, day, item_ref, item_name,
         views, add_to_carts, purchases, quality_id)
      values (p_company_id, p_connection_id, (v_row->>'day')::date, v_item_ref,
        nullif(v_row->>'item_name',''), (v_row->>'views')::bigint,
        (v_row->>'add_to_carts')::bigint, (v_row->>'purchases')::bigint, v_quality_id)
      on conflict on constraint ga4_item_daily_key do update
        set views = ga4_item_daily.views + excluded.views,
            add_to_carts = ga4_item_daily.add_to_carts + excluded.add_to_carts,
            purchases = ga4_item_daily.purchases + excluded.purchases,
            item_name = case when ga4_item_daily.item_name is null then excluded.item_name
              when excluded.item_name is null then ga4_item_daily.item_name
              else least(ga4_item_daily.item_name, excluded.item_name) end;
    end loop;
  elsif p_report_id = 'ga4_campanias' then
    delete from public.ga4_campaign_daily x where x.connection_id = p_connection_id
      and x.day between p_window_from and p_window_to;
    delete from private.ga4_campaign_rows x where x.connection_id = p_connection_id
      and x.day between p_window_from and p_window_to;
    insert into private.ga4_campaign_rows
      (company_id, connection_id, day, external_campaign_id, sessions, quality_id)
    select p_company_id, p_connection_id, x.day, nullif(x.campaign_id,''), x.sessions, v_quality_id
      from jsonb_to_recordset(p_rows) as x(day date, campaign_id text, sessions bigint);
    insert into public.ga4_campaign_daily
      (company_id, connection_id, day, entity_ref, sessions, quality_id)
    select p_company_id, p_connection_id, x.day, null, sum(x.sessions), v_quality_id
      from private.ga4_campaign_rows x where x.connection_id = p_connection_id
        and x.day between p_window_from and p_window_to group by x.day;
  else
    delete from public.ga4_visitor_cohorts x where x.connection_id = p_connection_id;
    insert into public.ga4_visitor_cohorts
      (company_id, connection_id, cohort_month, month_offset, cohort_size, active,
       size_hidden, active_hidden, provisional, quality_id)
    select p_company_id, p_connection_id, x.cohort_month, x.month_offset,
      case when x.cohort_size >= 5 then x.cohort_size else null end,
      case when x.cohort_size >= 5 and x.active >= 5 then x.active else null end,
      x.cohort_size is null or x.cohort_size < 5,
      x.active is null or x.active < 5 or x.cohort_size is null or x.cohort_size < 5,
      x.provisional, v_quality_id
      from jsonb_to_recordset(p_rows) as x(cohort_month date, month_offset integer,
        cohort_size bigint, active bigint, provisional boolean);
  end if;
  update private.ga4_sync_runs r set checkpoint = p_checkpoint,
      report_id = p_report_id, window_from = p_window_from, window_to = p_window_to,
      pages_fetched = pages_fetched + 1, fetched_at = now()
   where r.id = p_run_id;
  update public.ga4_sync_status s set last_fetched_at = now(), updated_at = now()
   where s.connection_id = p_connection_id;
  return true;
end;
$$;

create function worker_api.ga4_finish_sync(
  p_actor_user_id uuid, p_company_id uuid, p_connection_id uuid,
  p_generation integer, p_run_id uuid, p_lease_token uuid,
  p_coverage_from date, p_coverage_through date)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_run private.ga4_sync_runs;
  v_tn_connection_id uuid;
  v_meta_connection_id uuid;
  v_rule text;
  v_total integer;
  v_matched integer;
  v_ambiguous integer;
begin
  v_run := private.ga4_locked_run(
    p_actor_user_id, p_company_id, p_connection_id, p_generation, p_run_id, p_lease_token);
  if p_coverage_from is null or p_coverage_through is null
     or p_coverage_through < p_coverage_from
     or not v_run.target_reports @> array['ga4_trafico_dia', 'ga4_trafico_fuente', 'ga4_cohortes']::text[]
     or jsonb_typeof(v_run.checkpoint->'completed_reports') <> 'array'
     or exists (select 1 from unnest(v_run.target_reports) r
                 where not (v_run.checkpoint->'completed_reports') ? r)
  then raise exception 'praxa: sincronización incompleta' using errcode = 'PX004'; end if;

  -- El mapeo se recalcula contra las conexiones vivas de la misma empresa,
  -- y todas las referencias anteriores se reescriben, incluso si la regla cambia.
  select c.id into v_tn_connection_id from public.integration_connections c
   where c.company_id = p_company_id and c.provider::text = 'tiendanube'
     and c.status in ('active', 'needs_reauth') limit 1;
  select c.id into v_meta_connection_id from public.integration_connections c
   where c.company_id = p_company_id and c.provider::text = 'meta'
     and c.status in ('active', 'needs_reauth') limit 1;
  v_rule := null;
  if v_tn_connection_id is not null then
    select count(*) into v_total from private.ga4_item_keys k
     where k.connection_id = p_connection_id;
    if v_total > 0 then
      for v_rule in select unnest(array['variant', 'product', 'sku']::text[]) loop
        if v_rule = 'variant' then
          select count(*) filter (where n = 1), count(*) filter (where n > 1)
            into v_matched, v_ambiguous from (
              select k.external_item_id, count(distinct v.product_id) n
                from private.ga4_item_keys k
                left join private.tn_product_variants v
                  on v.connection_id = v_tn_connection_id
                 and v.external_variant_id = k.external_item_id
               where k.connection_id = p_connection_id group by k.external_item_id) m;
        elsif v_rule = 'product' then
          select count(*) filter (where n = 1), count(*) filter (where n > 1)
            into v_matched, v_ambiguous from (
              select k.external_item_id, count(distinct p.id) n
                from private.ga4_item_keys k
                left join private.tn_products p
                  on p.connection_id = v_tn_connection_id
                 and p.external_product_id = k.external_item_id
               where k.connection_id = p_connection_id group by k.external_item_id) m;
        else
          select count(*) filter (where n = 1), count(*) filter (where n > 1)
            into v_matched, v_ambiguous from (
              select k.external_item_id, count(distinct v.product_id) n
                from private.ga4_item_keys k
                left join private.tn_product_variants v
                  on v.connection_id = v_tn_connection_id and v.sku = k.external_item_id
               where k.connection_id = p_connection_id group by k.external_item_id) m;
        end if;
        if v_ambiguous = 0 and v_matched * 100 >= v_total * 80 then exit; end if;
      end loop;
      if v_ambiguous <> 0 or v_matched * 100 < v_total * 80 then v_rule := null; end if;
    end if;
  end if;
  update public.ga4_item_daily d set tn_product_key = null
   where d.connection_id = p_connection_id;
  if v_rule = 'variant' then
    update public.ga4_item_daily d set tn_product_key = v.product_id
      from private.ga4_item_keys k
      join private.tn_product_variants v
        on v.connection_id = v_tn_connection_id and v.external_variant_id = k.external_item_id
     where d.connection_id = p_connection_id and d.item_ref = k.item_ref
       and k.connection_id = p_connection_id;
  elsif v_rule = 'product' then
    update public.ga4_item_daily d set tn_product_key = p.id
      from private.ga4_item_keys k
      join private.tn_products p
        on p.connection_id = v_tn_connection_id and p.external_product_id = k.external_item_id
     where d.connection_id = p_connection_id and d.item_ref = k.item_ref
       and k.connection_id = p_connection_id;
  elsif v_rule = 'sku' then
    update public.ga4_item_daily d set tn_product_key = v.product_id
      from private.ga4_item_keys k
      join private.tn_product_variants v
        on v.connection_id = v_tn_connection_id and v.sku = k.external_item_id
     where d.connection_id = p_connection_id and d.item_ref = k.item_ref
       and k.connection_id = p_connection_id;
  end if;

  delete from public.ga4_campaign_daily d where d.connection_id = p_connection_id;
  insert into public.ga4_campaign_daily
    (company_id, connection_id, day, entity_ref, sessions, quality_id)
  select p_company_id, p_connection_id, x.day, x.entity_ref,
         sum(x.sessions), x.quality_id
    from (
      select r.day, r.sessions, q.quality_id,
             (select case when count(*) = 1 then min(e.entity_ref::text)::uuid else null end
                from public.meta_entities e
               where e.connection_id = v_meta_connection_id and e.level = 'campaign'
                 and e.external_id = r.external_campaign_id) as entity_ref
        from private.ga4_campaign_rows r
        join public.ga4_report_quality q on q.quality_id = r.quality_id
          and q.connection_id = r.connection_id
       where r.connection_id = p_connection_id
    ) x group by x.day, x.entity_ref, x.quality_id;

  update private.ga4_sync_runs r set status = 'complete', finished_at = now()
   where r.id = p_run_id;
  update public.ga4_sync_status s
     set coverage_from = least(coalesce(s.coverage_from, p_coverage_from), p_coverage_from),
         coverage_through = greatest(coalesce(s.coverage_through, p_coverage_through), p_coverage_through),
         last_step_at = now(), last_step_status = 'complete', last_error_kind = null,
         item_mapping_rule = v_rule, item_mapping_connection_id = v_tn_connection_id,
         campaign_mapping_connection_id = v_meta_connection_id, updated_at = now()
   where s.connection_id = p_connection_id;
  return true;
end;
$$;

create function worker_api.ga4_fail_sync(
  p_actor_user_id uuid, p_company_id uuid, p_connection_id uuid,
  p_generation integer, p_run_id uuid, p_lease_token uuid,
  p_status text, p_error_kind text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.ga4_locked_run(
    p_actor_user_id, p_company_id, p_connection_id, p_generation, p_run_id, p_lease_token);
  if p_status is null or p_status not in ('incomplete', 'failed', 'superseded')
     or (p_status = 'failed' and p_error_kind is null)
     or (p_error_kind is not null and p_error_kind not in (
       'credencial_invalida', 'permiso_faltante', 'solicitud_invalida',
       'campo_invalido', 'cuota', 'transitorio', 'transporte',
       'no_encontrado', 'calidad_inconsistente', 'desconocido'))
  then raise exception 'praxa: argumento inválido' using errcode = '22023'; end if;
  update private.ga4_sync_runs r set status = p_status,
    error_kind = p_error_kind, finished_at = now() where r.id = p_run_id;
  update public.ga4_sync_status s set last_step_at = now(),
    last_step_status = p_status, last_error_kind = p_error_kind, updated_at = now()
    where s.connection_id = p_connection_id;
  return true;
end;
$$;

-- Lecturas invoker: las tablas públicas aplican su RLS a cada fila. La calidad
-- acompaña a su propia serie, sin inferir cero cuando falta el informe.
create function public.get_ga4_sync_status(p_connection_id uuid)
returns table (display_name text, phase text, coverage_from date, coverage_through date,
  last_step_at timestamptz, last_step_status text, last_error_kind text,
  last_fetched_at timestamptz, time_zone text, currency_code text,
  preflight jsonb, flags jsonb, item_mapping_rule text)
language sql stable security invoker set search_path = ''
as $$
  select s.display_name, s.phase, s.coverage_from, s.coverage_through,
    s.last_step_at, s.last_step_status, s.last_error_kind, s.last_fetched_at,
    s.time_zone, s.currency_code, s.preflight, s.flags,
    case when tn.status in ('active', 'needs_reauth') then s.item_mapping_rule else null end
  from public.ga4_sync_status s
  left join public.integration_connections tn on tn.id = s.item_mapping_connection_id
    and tn.company_id = s.company_id and tn.provider::text = 'tiendanube'
  where s.connection_id = p_connection_id
$$;

create function public.get_ga4_traffic(p_connection_id uuid, p_from date, p_to date)
returns table (day date, sessions bigint, active_users bigint, new_users bigint,
  meta_visits bigint, provisional boolean, traffic_quality jsonb, source_quality jsonb)
language sql stable security invoker set search_path = ''
as $$
  select t.day, t.sessions, t.active_users, t.new_users, t.meta_visits, t.provisional,
    to_jsonb(q) - 'company_id' - 'connection_id',
    to_jsonb(sq) - 'company_id' - 'connection_id'
  from public.ga4_traffic_daily t
  join public.ga4_report_quality q on q.quality_id = t.traffic_quality_id
    and q.connection_id = t.connection_id and q.company_id = t.company_id
  left join public.ga4_report_quality sq on sq.quality_id = t.source_quality_id
    and sq.connection_id = t.connection_id and sq.company_id = t.company_id
  where t.connection_id = p_connection_id and t.day between p_from and p_to
  union all
  select null::date, null::bigint, null::bigint, null::bigint,
    null::bigint, false,
    to_jsonb(q) - 'company_id' - 'connection_id',
    to_jsonb(sq) - 'company_id' - 'connection_id'
  from public.ga4_report_quality q
  left join public.ga4_report_quality sq on sq.connection_id = q.connection_id
    and sq.report_id = 'ga4_trafico_fuente' and sq.report_version = q.report_version
    and sq.window_from = q.window_from and sq.window_to = q.window_to
  where q.connection_id = p_connection_id and q.report_id = 'ga4_trafico_dia' and q.row_count = 0
    and q.window_from <= p_to and q.window_to >= p_from
    and not exists (select 1 from public.ga4_traffic_daily t
      where t.connection_id = q.connection_id and t.traffic_quality_id = q.quality_id
        and t.day between p_from and p_to)
  order by 1 nulls last
$$;

create function public.get_ga4_sources(p_connection_id uuid, p_from date, p_to date)
returns table (day date, source text, medium text, sessions bigint, quality jsonb)
language sql stable security invoker set search_path = ''
as $$
  select d.day, d.source, d.medium, d.sessions,
    to_jsonb(q) - 'company_id' - 'connection_id'
  from public.ga4_source_daily d
  join public.ga4_report_quality q on q.quality_id = d.quality_id
    and q.connection_id = d.connection_id and q.company_id = d.company_id
  where d.connection_id = p_connection_id and d.day between p_from and p_to
  union all
  select null::date, null::text, null::text, null::bigint,
    to_jsonb(q) - 'company_id' - 'connection_id'
  from public.ga4_report_quality q
  where q.connection_id = p_connection_id and q.report_id = 'ga4_trafico_fuente' and q.row_count = 0
    and q.window_from <= p_to and q.window_to >= p_from
    and not exists (select 1 from public.ga4_source_daily d
      where d.connection_id = q.connection_id and d.quality_id = q.quality_id
        and d.day between p_from and p_to)
  order by 1 nulls last, 2, 3
$$;

create function public.get_ga4_funnel(p_connection_id uuid, p_from date, p_to date)
returns table (day date, event_name text, event_count bigint, quality jsonb)
language sql stable security invoker set search_path = ''
as $$
  select d.day, d.event_name, d.event_count,
    to_jsonb(q) - 'company_id' - 'connection_id'
  from public.ga4_funnel_daily d
  join public.ga4_report_quality q on q.quality_id = d.quality_id
    and q.connection_id = d.connection_id and q.company_id = d.company_id
  where d.connection_id = p_connection_id and d.day between p_from and p_to
  union all
  select null::date, null::text, null::bigint,
    to_jsonb(q) - 'company_id' - 'connection_id'
  from public.ga4_report_quality q
  where q.connection_id = p_connection_id and q.report_id = 'ga4_embudo' and q.row_count = 0
    and q.window_from <= p_to and q.window_to >= p_from
    and not exists (select 1 from public.ga4_funnel_daily d
      where d.connection_id = q.connection_id and d.quality_id = q.quality_id
        and d.day between p_from and p_to)
  order by 1 nulls last, 2
$$;

create function public.get_ga4_items(p_connection_id uuid, p_from date, p_to date)
returns table (day date, item_ref uuid, product_key uuid, item_name text,
  views bigint, add_to_carts bigint, purchases bigint, tn_units bigint, quality jsonb)
language sql stable security invoker set search_path = ''
as $$
  with base as (
    select d.day, d.connection_id, d.company_id, d.quality_id,
      case when tn.status in ('active', 'needs_reauth') then d.tn_product_key else null end as product_key,
      case when tn.status in ('active', 'needs_reauth') and d.tn_product_key is not null
           then null::uuid else d.item_ref end as item_ref,
      d.item_name, d.views, d.add_to_carts, d.purchases,
      case when tn.status in ('active', 'needs_reauth') then tn.id else null end as tn_connection_id,
      tn.timezone as tn_time_zone
    from public.ga4_item_daily d
    left join public.ga4_sync_status s on s.connection_id = d.connection_id
    left join public.integration_connections tn on tn.id = s.item_mapping_connection_id
      and tn.company_id = d.company_id and tn.provider::text = 'tiendanube'
    where d.connection_id = p_connection_id and d.day between p_from and p_to
  ), daily as (
    select b.day, b.connection_id, b.company_id, b.quality_id,
      b.product_key, b.item_ref, min(b.item_name) as item_name,
      sum(b.views)::bigint as views, sum(b.add_to_carts)::bigint as add_to_carts,
      sum(b.purchases)::bigint as purchases, b.tn_connection_id, b.tn_time_zone
    from base b group by b.day, b.connection_id, b.company_id, b.quality_id,
      b.product_key, b.item_ref, b.tn_connection_id, b.tn_time_zone
  )
  select d.day, d.item_ref, d.product_key, d.item_name,
    d.views, d.add_to_carts, d.purchases,
    case when d.product_key is not null and ts.coverage_until >=
      ((d.day + 1)::timestamp at time zone d.tn_time_zone)
      then coalesce((select sum(u.units)::bigint from public.tn_product_units_daily u
        where u.connection_id = d.tn_connection_id and u.product_key = d.product_key
          and u.day = d.day), 0::bigint) else null end,
    to_jsonb(q) - 'company_id' - 'connection_id'
  from daily d
  join public.ga4_report_quality q on q.quality_id = d.quality_id
    and q.connection_id = d.connection_id and q.company_id = d.company_id
  left join public.tn_sync_status ts on ts.connection_id = d.tn_connection_id
  union all
  select null::date, null::uuid, null::uuid, null::text,
    null::bigint, null::bigint, null::bigint, null::bigint,
    to_jsonb(q) - 'company_id' - 'connection_id'
  from public.ga4_report_quality q
  where q.connection_id = p_connection_id and q.report_id = 'ga4_productos' and q.row_count = 0
    and q.window_from <= p_to and q.window_to >= p_from
    and not exists (select 1 from public.ga4_item_daily d
      where d.connection_id = q.connection_id and d.quality_id = q.quality_id
        and d.day between p_from and p_to)
  order by 1 nulls last, 5 desc, 2
$$;

create function public.get_ga4_campaigns(p_connection_id uuid, p_from date, p_to date)
returns table (day date, entity_ref uuid, sessions bigint, quality jsonb)
language sql stable security invoker set search_path = ''
as $$
  with daily as (
    select d.day, d.connection_id, d.company_id, d.quality_id,
      case when m.status in ('active', 'needs_reauth') then d.entity_ref else null end as mapped_ref,
      sum(d.sessions)::bigint as sessions
    from public.ga4_campaign_daily d
    left join public.ga4_sync_status s on s.connection_id = d.connection_id
    left join public.integration_connections m on m.id = s.campaign_mapping_connection_id
      and m.company_id = d.company_id and m.provider::text = 'meta'
    where d.connection_id = p_connection_id and d.day between p_from and p_to
    group by d.day, d.connection_id, d.company_id, d.quality_id,
      case when m.status in ('active', 'needs_reauth') then d.entity_ref else null end
  )
  select d.day, d.mapped_ref, d.sessions,
    to_jsonb(q) - 'company_id' - 'connection_id'
  from daily d join public.ga4_report_quality q on q.quality_id = d.quality_id
    and q.connection_id = d.connection_id and q.company_id = d.company_id
  union all
  select null::date, null::uuid, null::bigint,
    to_jsonb(q) - 'company_id' - 'connection_id'
  from public.ga4_report_quality q
  where q.connection_id = p_connection_id and q.report_id = 'ga4_campanias' and q.row_count = 0
    and q.window_from <= p_to and q.window_to >= p_from
    and not exists (select 1 from public.ga4_campaign_daily d
      where d.connection_id = q.connection_id and d.quality_id = q.quality_id
        and d.day between p_from and p_to)
  order by 1 nulls last, 3 desc
$$;

create function public.get_ga4_cohorts(p_connection_id uuid, p_from date, p_to date)
returns table (cohort_month date, month_offset integer, cohort_size bigint,
  active bigint, size_hidden boolean, active_hidden boolean, provisional boolean,
  quality jsonb)
language sql stable security invoker set search_path = ''
as $$
  select c.cohort_month, c.month_offset, c.cohort_size, c.active,
    c.size_hidden, c.active_hidden, c.provisional,
    to_jsonb(q) - 'company_id' - 'connection_id'
  from public.ga4_visitor_cohorts c
  join public.ga4_report_quality q on q.quality_id = c.quality_id
    and q.connection_id = c.connection_id and q.company_id = c.company_id
  where c.connection_id = p_connection_id and c.cohort_month between p_from and p_to
  union all
  select null::date, null::integer, null::bigint, null::bigint,
    false, false, false, to_jsonb(q) - 'company_id' - 'connection_id'
  from public.ga4_report_quality q
  where q.connection_id = p_connection_id and q.report_id = 'ga4_cohortes' and q.row_count = 0
    and q.window_from <= p_to and q.window_to >= p_from
    and not exists (select 1 from public.ga4_visitor_cohorts c
      where c.connection_id = q.connection_id and c.quality_id = q.quality_id
        and c.cohort_month between p_from and p_to)
  order by 1 nulls last, 2
$$;

revoke all on function public.get_ga4_sync_status(uuid)
  from public, anon, authenticated, service_role, praxa_integrations;
revoke all on function public.get_ga4_traffic(uuid, date, date)
  from public, anon, authenticated, service_role, praxa_integrations;
revoke all on function public.get_ga4_sources(uuid, date, date)
  from public, anon, authenticated, service_role, praxa_integrations;
revoke all on function public.get_ga4_funnel(uuid, date, date)
  from public, anon, authenticated, service_role, praxa_integrations;
revoke all on function public.get_ga4_items(uuid, date, date)
  from public, anon, authenticated, service_role, praxa_integrations;
revoke all on function public.get_ga4_campaigns(uuid, date, date)
  from public, anon, authenticated, service_role, praxa_integrations;
revoke all on function public.get_ga4_cohorts(uuid, date, date)
  from public, anon, authenticated, service_role, praxa_integrations;
grant execute on function public.get_ga4_sync_status(uuid) to authenticated;
grant execute on function public.get_ga4_traffic(uuid, date, date) to authenticated;
grant execute on function public.get_ga4_sources(uuid, date, date) to authenticated;
grant execute on function public.get_ga4_funnel(uuid, date, date) to authenticated;
grant execute on function public.get_ga4_items(uuid, date, date) to authenticated;
grant execute on function public.get_ga4_campaigns(uuid, date, date) to authenticated;
grant execute on function public.get_ga4_cohorts(uuid, date, date) to authenticated;

revoke all on function worker_api.ga4_start_sync(uuid, uuid, uuid, integer, uuid, uuid, timestamptz, text)
  from public, anon, authenticated, service_role, praxa_integrations;
revoke all on function worker_api.ga4_set_preflight(uuid, uuid, uuid, integer, uuid, uuid, text, text, text, jsonb, text[])
  from public, anon, authenticated, service_role, praxa_integrations;
revoke all on function worker_api.ga4_publish_report(uuid, uuid, uuid, integer, uuid, uuid, text, integer, date, date, jsonb, jsonb, jsonb)
  from public, anon, authenticated, service_role, praxa_integrations;
revoke all on function worker_api.ga4_finish_sync(uuid, uuid, uuid, integer, uuid, uuid, date, date)
  from public, anon, authenticated, service_role, praxa_integrations;
revoke all on function worker_api.ga4_fail_sync(uuid, uuid, uuid, integer, uuid, uuid, text, text)
  from public, anon, authenticated, service_role, praxa_integrations;
grant execute on function worker_api.ga4_start_sync(uuid, uuid, uuid, integer, uuid, uuid, timestamptz, text)
  to praxa_integrations;
grant execute on function worker_api.ga4_set_preflight(uuid, uuid, uuid, integer, uuid, uuid, text, text, text, jsonb, text[])
  to praxa_integrations;
grant execute on function worker_api.ga4_publish_report(uuid, uuid, uuid, integer, uuid, uuid, text, integer, date, date, jsonb, jsonb, jsonb)
  to praxa_integrations;
grant execute on function worker_api.ga4_finish_sync(uuid, uuid, uuid, integer, uuid, uuid, date, date)
  to praxa_integrations;
grant execute on function worker_api.ga4_fail_sync(uuid, uuid, uuid, integer, uuid, uuid, text, text)
  to praxa_integrations;

