-- PRAXA — Tiendanube (0023, M16e etapa .1): coexistencia con Meta, privilegios, agregados,
-- regla de cinco, posesión, purga y privacidad.
--
-- M16e-T-01 (matriz y coexistencia), T-05 (fixture con valores esperados escritos), T-06
-- (privacidad en SQL), T-07 (aislamiento, cascada, regla de cinco). Todo es sintético: tiendas,
-- pedidos y clientes con IDs inventados. Las funciones de worker_api se llaman como
-- `postgres`, su dueño; el privilegio del rol de C se prueba con `pg_temp.state_as`.

begin;

create extension if not exists pgtap with schema extensions;
select plan(85);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function pg_temp.state_of(p_sql text)
returns text language plpgsql as $fn$
begin
  execute p_sql;
  return null;
exception when others then
  return sqlstate;
end;
$fn$;

create function pg_temp.state_as(p_role text, p_sql text)
returns text language plpgsql as $fn$
begin
  execute format('set local role %I', p_role);
  execute p_sql;
  execute 'reset role';
  return null;
exception when others then
  return sqlstate;
end;
$fn$;

create function pg_temp.uid(n integer) returns uuid language sql immutable as
  $fn$ select format('aaaaaaaa-0000-4000-8000-%s', lpad((1800 + n)::text, 12, '0'))::uuid $fn$;
create function pg_temp.cid(n integer) returns uuid language sql immutable as
  $fn$ select format('c0a00000-0000-4000-8000-%s', lpad((1800 + n)::text, 12, '0'))::uuid $fn$;
-- Conexión: 1x de Tiendanube, 5x de Meta.
create function pg_temp.kid(n integer) returns uuid language sql immutable as
  $fn$ select format('cc000000-0000-4000-8000-%s', lpad((1800 + n)::text, 12, '0'))::uuid $fn$;
create function pg_temp.run(n integer) returns uuid language sql immutable as
  $fn$ select format('d0000000-0000-4000-8000-%s', lpad((1800 + n)::text, 12, '0'))::uuid $fn$;
create function pg_temp.lease(n integer) returns uuid language sql immutable as
  $fn$ select format('e0000000-0000-4000-8000-%s', lpad((1800 + n)::text, 12, '0'))::uuid $fn$;

create function pg_temp.new_company(n integer) returns void language plpgsql as $fn$
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  values (pg_temp.uid(n), '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', format('tienda.%s@praxa.test', n), 'x', now(), now(), now());
  insert into public.companies (id, name, owner_id)
  values (pg_temp.cid(n), format('Empresa tienda %s', n), pg_temp.uid(n));
end;
$fn$;

-- Conexión de Tiendanube activa de la empresa n, con la tienda indicada.
create function pg_temp.tn_connect(n integer, k integer, p_store text) returns void
language plpgsql as $fn$
begin
  perform worker_api.create_pending_connection(pg_temp.uid(n), pg_temp.cid(n), pg_temp.kid(k),
    'tiendanube', null, 'AAAA', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', 1,
    'store_app_token', '12345', '{read_orders,read_customers,read_products}', null);
  perform worker_api.confirm_connection(pg_temp.uid(n), pg_temp.cid(n), pg_temp.kid(k),
    p_store, 'ARS', 'America/Argentina/Buenos_Aires', true);
end;
$fn$;

create function pg_temp.meta_connect(n integer, k integer) returns void language plpgsql as $fn$
begin
  perform worker_api.create_pending_connection(pg_temp.uid(n), pg_temp.cid(n), pg_temp.kid(k),
    'meta', 'negocio_sintetico', 'AAAA', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', 1,
    'system_user', 'app_sintetica', '{ads_read}', null);
  perform worker_api.confirm_connection(pg_temp.uid(n), pg_temp.cid(n), pg_temp.kid(k),
    format('act_%s', 900000 + k), 'USD', 'UTC', true);
end;
$fn$;

create function pg_temp.start(n integer, k integer, r integer) returns void language plpgsql as $fn$
begin
  perform worker_api.tn_start_sync(pg_temp.uid(n), pg_temp.cid(n), pg_temp.kid(k),
    (select c.credential_generation from public.integration_connections c where c.id = pg_temp.kid(k)),
    pg_temp.run(r), pg_temp.lease(r), clock_timestamp() + interval '4 minutes');
end;
$fn$;

-- Pedido proyectado. `paid_at` solo si el estado de pago lo implica.
create function pg_temp.o(p_id text, p_customer text, p_status text, p_payment text,
                          p_at timestamptz, p_currency text default 'ARS',
                          p_total numeric default 100, p_refunded numeric default null)
returns jsonb language sql immutable as $fn$
  select jsonb_build_object(
    'id', p_id, 'customer_id', p_customer, 'status', p_status, 'payment_status', p_payment,
    'created_at', p_at, 'updated_at', p_at,
    'paid_at', case when p_payment in ('paid', 'partially_refunded', 'refunded', 'partially_paid')
                    then p_at end,
    'closed_at', null, 'cancelled_at', case when p_status = 'cancelled' then p_at end,
    'currency', p_currency, 'subtotal', p_total::text, 'discount', '0', 'total', p_total::text,
    'total_paid_by_customer', p_total::text, 'storefront', 'store', 'cancel_reason', null,
    'is_subscription', false, 'is_subscription_initial', false,
    'refunded_amount', p_refunded::text)
$fn$;

create function pg_temp.l(p_order text, p_no integer, p_product text, p_variant text,
                          p_name text, p_qty integer)
returns jsonb language sql immutable as $fn$
  select jsonb_build_object('order_id', p_order, 'line_no', p_no, 'product_id', p_product,
    'variant_id', p_variant, 'name', p_name, 'price', '10.00', 'quantity', p_qty)
$fn$;

create function pg_temp.pub(n integer, k integer, r integer, p_orders jsonb,
                            p_lines jsonb default '[]')
returns integer language sql as $fn$
  select x.orders_suppressed from worker_api.tn_publish_orders(pg_temp.uid(n), pg_temp.cid(n),
    pg_temp.kid(k), (select c.credential_generation from public.integration_connections c
                      where c.id = pg_temp.kid(k)),
    pg_temp.run(r), pg_temp.lease(r),
    '{"kind":"backfill","window_from":"2025-12-01","window_to":"2026-03-31","last_page":false}',
    p_orders, p_lines) x
$fn$;

create function pg_temp.login(n integer) returns void language plpgsql as $fn$
begin
  perform set_config('request.jwt.claims',
    format('{"sub":"%s","role":"authenticated"}', pg_temp.uid(n)), true);
  execute 'set local role authenticated';
end;
$fn$;

create function pg_temp.logout() returns void language plpgsql as $fn$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', null, true);
end;
$fn$;

-- Filas de Tiendanube que quedan de una conexión, en las once tablas.
create function pg_temp.tn_rows(k integer) returns integer language sql as $fn$
  select (select count(*) from private.tn_sync_runs where connection_id = pg_temp.kid(k))
       + (select count(*) from private.tn_orders where connection_id = pg_temp.kid(k))
       + (select count(*) from private.tn_order_lines where connection_id = pg_temp.kid(k))
       + (select count(*) from private.tn_customers where connection_id = pg_temp.kid(k))
       + (select count(*) from private.tn_products where connection_id = pg_temp.kid(k))
       + (select count(*) from private.tn_product_variants where connection_id = pg_temp.kid(k))
       + (select count(*) from private.tn_redaction_suppressions where connection_id = pg_temp.kid(k))
       + (select count(*) from public.tn_sync_status where connection_id = pg_temp.kid(k))
       + (select count(*) from public.tn_sales_daily where connection_id = pg_temp.kid(k))
       + (select count(*) from public.tn_product_units_daily where connection_id = pg_temp.kid(k))
       + (select count(*) from public.tn_cohort_cells where connection_id = pg_temp.kid(k))
       + (select count(*) from public.integration_connections where id = pg_temp.kid(k))
       + (select count(*) from private.integration_credentials where connection_id = pg_temp.kid(k))
$fn$;

-- ---------------------------------------------------------------------------
-- T-01: estructura, RLS y matriz de privilegios
-- ---------------------------------------------------------------------------

select results_eq(
  $$select n.nspname::text collate "default", c.relname::text collate "default",
           c.relrowsecurity, c.relforcerowsecurity
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where c.relkind = 'r' and c.relname like 'tn\_%' order by 1, 2$$,
  $$values ('private', 'tn_customers', true, true), ('private', 'tn_order_lines', true, true),
           ('private', 'tn_orders', true, true), ('private', 'tn_product_variants', true, true),
           ('private', 'tn_products', true, true), ('private', 'tn_redaction_suppressions', true, true),
           ('private', 'tn_sync_runs', true, true), ('public', 'tn_cohort_cells', true, true),
           ('public', 'tn_product_units_daily', true, true), ('public', 'tn_sales_daily', true, true),
           ('public', 'tn_sync_status', true, true)$$,
  'M16e-T-01: las once tablas existen con RLS habilitada y forzada');

create function pg_temp.tn_table_privileges(p_role text)
returns table (table_name text, privilege text) language sql as $fn$
  select t.name, p.name
    from unnest(array['private.tn_sync_runs', 'private.tn_orders', 'private.tn_order_lines',
                      'private.tn_customers', 'private.tn_products', 'private.tn_product_variants',
                      'private.tn_redaction_suppressions', 'public.tn_sync_status',
                      'public.tn_sales_daily', 'public.tn_product_units_daily',
                      'public.tn_cohort_cells']) as t(name)
   cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES',
                           'TRIGGER']) as p(name)
   where has_table_privilege(p_role, t.name, p.name)
   order by 1, 2
$fn$;

select is_empty($$select * from pg_temp.tn_table_privileges('anon')$$,
  'M16e-T-01: anon no tiene privilegios sobre las tablas de Tiendanube');
select results_eq($$select * from pg_temp.tn_table_privileges('authenticated')$$,
  $$values ('public.tn_cohort_cells', 'SELECT'), ('public.tn_product_units_daily', 'SELECT'),
           ('public.tn_sales_daily', 'SELECT'), ('public.tn_sync_status', 'SELECT')$$,
  'M16e-T-01: authenticated solo tiene SELECT sobre los cuatro agregados');
select is_empty($$select * from pg_temp.tn_table_privileges('praxa_integrations')$$,
  'M16e-T-01: el rol de C no tiene grants directos sobre tablas');
select is_empty($$select * from pg_temp.tn_table_privileges('service_role')$$,
  'M16e-T-01: service_role no tiene privilegios sobre las tablas de Tiendanube');

select results_eq(
  $$select p.tablename::text collate "default", p.cmd::text, p.roles::text[] collate "default"
      from pg_policies p where p.tablename like 'tn\_%' order by 1$$,
  $$values ('tn_cohort_cells', 'SELECT', array['authenticated']),
           ('tn_product_units_daily', 'SELECT', array['authenticated']),
           ('tn_sales_daily', 'SELECT', array['authenticated']),
           ('tn_sync_status', 'SELECT', array['authenticated'])$$,
  'M16e-T-01: las únicas políticas son el SELECT de los cuatro agregados');

select results_eq(
  $$select p.proname::text collate "default", p.prosecdef, p.proconfig = array['search_path=""']
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname like 'get\_tn\_%' order by 1$$,
  $$values ('get_tn_cohorts', false, true), ('get_tn_product_units', false, true),
           ('get_tn_sales', false, true), ('get_tn_sync_status', false, true)$$,
  'M16e-T-01: las cuatro lecturas son INVOKER y con search_path vacío');

select results_eq(
  $$select p.proname::text collate "default", r.name
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     cross join unnest(array['anon', 'authenticated', 'praxa_integrations', 'service_role']) as r(name)
     where n.nspname = 'public' and p.proname like 'get\_tn\_%'
       and has_function_privilege(r.name, p.oid, 'EXECUTE') order by 1, 2$$,
  $$values ('get_tn_cohorts', 'authenticated'), ('get_tn_product_units', 'authenticated'),
           ('get_tn_sales', 'authenticated'), ('get_tn_sync_status', 'authenticated')$$,
  'M16e-T-01: solo authenticated ejecuta las lecturas');

select results_eq(
  $$select p.proname::text collate "default", r.name
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     cross join unnest(array['anon', 'authenticated', 'praxa_integrations', 'service_role']) as r(name)
     where n.nspname = 'worker_api' and p.proname like 'tn\_%'
       and has_function_privilege(r.name, p.oid, 'EXECUTE') order by 1, 2$$,
  $$values ('tn_fail_sync', 'praxa_integrations'), ('tn_finish_sync', 'praxa_integrations'),
           ('tn_privacy_customer_redact', 'praxa_integrations'),
           ('tn_privacy_store_redact', 'praxa_integrations'),
           ('tn_publish_catalog', 'praxa_integrations'), ('tn_publish_orders', 'praxa_integrations'),
           ('tn_start_sync', 'praxa_integrations')$$,
  'M16e-T-01: solo el rol de C ejecuta las siete funciones de Tiendanube');

select is_empty(
  $$select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace,
           aclexplode(p.proacl) a
     where n.nspname = 'private'
       and (p.proname like 'tn\_%' or p.proname in ('valid_provider_scopes', 'meta_assert_meta_connection'))
       and a.grantee <> p.proowner$$,
  'M16e-T-01: los helpers privados nuevos no tienen EXECUTE para otros roles');

select ok(
  (select count(*) = 4 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'worker_api'
      and p.proname in ('create_oauth_attempt', 'consume_oauth_attempt',
                        'create_pending_connection', 'list_pending_purges'))
  and (select bool_and(pg_catalog.format_type(p.proargtypes[2], null) = 'integration_provider')
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'worker_api' and p.proname in ('create_oauth_attempt', 'consume_oauth_attempt'))
  and (select pg_catalog.format_type(p.proargtypes[3], null) = 'integration_provider'
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'worker_api' and p.proname = 'create_pending_connection'),
  'M16e-T-01: las firmas viejas se retiraron y las nuevas reciben el proveedor en su lugar');

select is(
  (select count(*)::int from pg_attrdef d
    where d.adrelid in ('public.integration_connections'::regclass, 'public.oauth_attempts'::regclass)
      and d.adnum in (select a.attnum from pg_attribute a
                       where a.attrelid = d.adrelid and a.attname = 'provider')),
  0, 'M16e-T-01: el proveedor ya no tiene default: ningún flujo nuevo se guarda como Meta');

-- ---------------------------------------------------------------------------
-- Semilla: A con Meta y Tiendanube; B con la misma tienda; C con otra
-- ---------------------------------------------------------------------------

select pg_temp.new_company(1);
select pg_temp.new_company(2);
select pg_temp.new_company(3);
select pg_temp.meta_connect(1, 51);
select pg_temp.tn_connect(1, 11, '777001');

-- ---------------------------------------------------------------------------
-- T-01: coexistencia y discriminación por proveedor (C-01)
-- ---------------------------------------------------------------------------

select results_eq(
  $$select c.provider::text, c.status::text from public.integration_connections c
     where c.company_id = pg_temp.cid(1) order by 1$$,
  $$values ('meta', 'active'), ('tiendanube', 'active')$$,
  'M16e-T-01: Meta y Tiendanube conviven vivas en la misma empresa');

select is(pg_temp.state_of($$select worker_api.create_pending_connection(pg_temp.uid(1),
    pg_temp.cid(1), pg_temp.kid(12), 'tiendanube', null, 'AAAA', 'AAAAAAAAAAAAAAAA',
    'AAAAAAAAAAAAAAAAAAAAAA==', 1, 'store_app_token', '12345',
    '{read_orders,read_customers,read_products}', null)$$),
  'PX003', 'M16e-T-01: una segunda conexión viva de Tiendanube → PX003');

select is(pg_temp.state_of($$insert into public.integration_connections
    (provider, id, company_id, status, pending_expires_at)
    values ('tiendanube', gen_random_uuid(), pg_temp.cid(1), 'pending_selection', now() + interval '30 minutes')$$),
  '23505', 'M16e-T-01: el índice por (empresa, proveedor) rechaza la segunda viva aun por fuera de worker_api');

select is(pg_temp.state_of($$select worker_api.create_oauth_attempt(pg_temp.uid(1), pg_temp.cid(1),
    'tiendanube', 'initial', repeat('1', 64), repeat('2', 64), '/app/integraciones',
    now() + interval '5 minutes')$$),
  'PX003', 'M16e-T-01: intento initial de Tiendanube con una conexión viva de Tiendanube → PX003');

select is(pg_temp.state_of($$select worker_api.create_oauth_attempt(pg_temp.uid(2), pg_temp.cid(2),
    'tiendanube', 'initial', repeat('3', 64), repeat('4', 64), '/app/integraciones',
    now() + interval '5 minutes')$$),
  null, 'M16e-T-01: B crea un intento initial de Tiendanube');

select is(pg_temp.state_of($$select worker_api.consume_oauth_attempt(pg_temp.uid(2), pg_temp.cid(2),
    'meta', repeat('3', 64), repeat('4', 64))$$),
  'PX002', 'M16e-T-02: consumir con otro proveedor → PX002 (A-14)');

select is(
  (select consumed_at from public.oauth_attempts where state_hash = repeat('3', 64)),
  null, 'M16e-T-02: el intento de Tiendanube sigue sin consumir');

select is(pg_temp.state_of($$select worker_api.create_oauth_attempt(pg_temp.uid(1), pg_temp.cid(1),
    'meta', 'reauth', repeat('5', 64), repeat('6', 64), '/app/integraciones',
    now() + interval '5 minutes', pg_temp.kid(11))$$),
  'PX001', 'M16e-T-02: reauth de Meta apuntando a la conexión de Tiendanube → PX001');

select is(pg_temp.state_of($$select worker_api.create_pending_connection(pg_temp.uid(3),
    pg_temp.cid(3), pg_temp.kid(13), 'tiendanube', null, 'AAAA', 'AAAAAAAAAAAAAAAA',
    'AAAAAAAAAAAAAAAAAAAAAA==', 1, 'system_user', '12345',
    '{read_orders,read_customers,read_products}', null)$$),
  '22023', 'M16e-T-01: Tiendanube con token system_user → 22023 (CA-11c)');

select is(pg_temp.state_of($$select worker_api.create_pending_connection(pg_temp.uid(3),
    pg_temp.cid(3), pg_temp.kid(13), 'tiendanube', null, 'AAAA', 'AAAAAAAAAAAAAAAA',
    'AAAAAAAAAAAAAAAAAAAAAA==', 1, 'store_app_token', '12345',
    '{read_orders,read_customers,read_products,write_orders}', null)$$),
  '22023', 'M16e-T-01: Tiendanube con un scope de más → 22023');

select is(pg_temp.state_of($$select worker_api.create_pending_connection(pg_temp.uid(3),
    pg_temp.cid(3), pg_temp.kid(13), 'tiendanube', null, 'AAAA', 'AAAAAAAAAAAAAAAA',
    'AAAAAAAAAAAAAAAAAAAAAA==', 1, 'store_app_token', '12345',
    '{read_orders,read_customers,read_products}', now() + interval '1 day')$$),
  '22023', 'M16e-T-01: Tiendanube con vencimiento → 22023');

select is(pg_temp.state_of($$select worker_api.create_pending_connection(pg_temp.uid(3),
    pg_temp.cid(3), pg_temp.kid(13), 'meta', 'negocio_sintetico', 'AAAA', 'AAAAAAAAAAAAAAAA',
    'AAAAAAAAAAAAAAAAAAAAAA==', 1, 'store_app_token', 'app_sintetica', '{ads_read}', null)$$),
  '22023', 'M16e-T-01: Meta con token de tienda → 22023');

select is(pg_temp.state_of($$update private.integration_credentials
       set provider = 'meta', token_type = 'system_user', granted_scopes = '{ads_read}'
     where connection_id = pg_temp.kid(11)$$),
  '23503', 'M16e-T-01: una credencial de Meta no puede colgar de la conexión de Tiendanube');

select results_eq(
  $$select k.provider::text, k.token_type, k.expires_at is null from private.integration_credentials k
     where k.company_id = pg_temp.cid(1) order by 1$$,
  $$values ('meta', 'system_user', true), ('tiendanube', 'store_app_token', true)$$,
  'M16e-T-01: cada credencial guarda su proveedor y su tipo de token');

select pg_temp.new_company(4);
select worker_api.create_pending_connection(pg_temp.uid(4), pg_temp.cid(4), pg_temp.kid(14),
  'tiendanube', null, 'AAAA', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', 1,
  'store_app_token', '12345', '{read_orders,read_customers,read_products}', null);
select is(pg_temp.state_of($$select worker_api.confirm_connection(pg_temp.uid(4), pg_temp.cid(4),
    pg_temp.kid(14), 'tienda_no_numerica', 'ARS', 'America/Argentina/Buenos_Aires', true)$$),
  '22023', 'M16e-T-02: la cuenta de Tiendanube tiene que ser el ID numérico de la tienda');

select results_eq(
  $$select l.provider, l.status, l.has_credential
      from worker_api.list_pending_purges(pg_temp.uid(4), pg_temp.cid(4)) l$$,
  $$select 'x'::text, 'x'::text, true where false$$,
  'M16e-T-03: la pendiente vigente no figura en la purga');

select is(pg_temp.state_of($$insert into public.meta_sync_runs (id, company_id, connection_id,
      credential_generation, ownership_token, started_at, lease_expires_at, finished_at,
      window_from, window_to, status, limits)
    values (gen_random_uuid(), pg_temp.cid(1), pg_temp.kid(11), 0, repeat('a', 64), now(),
            now() + interval '1 minute', now(), current_date, current_date, 'failed', '{}')$$),
  'PX001', 'M16e-T-01: la sincronización de Meta no acepta la conexión de Tiendanube');

select is(pg_temp.state_of($$select worker_api.tn_start_sync(pg_temp.uid(1), pg_temp.cid(1),
    pg_temp.kid(51), 0, gen_random_uuid(), gen_random_uuid(), clock_timestamp() + interval '1 minute')$$),
  'PX001', 'M16e-T-01: la sincronización de Tiendanube no acepta la conexión de Meta');

-- ---------------------------------------------------------------------------
-- T-05: fixture con valores esperados escritos (C-05, C-07)
-- ---------------------------------------------------------------------------

select pg_temp.start(1, 11, 1);

-- Ciclo de vida de un pedido: pendiente → pagado → reembolsado parcial → cancelado.
select pg_temp.pub(1, 11, 1, jsonb_build_array(
  pg_temp.o('9001', '3001', 'open', 'pending', '2026-01-15T15:00:00Z')));
select is((select count(*)::int from public.tn_sales_daily where connection_id = pg_temp.kid(11)),
  0, 'M16e-T-05: un pedido pendiente no cuenta como venta');

select pg_temp.pub(1, 11, 1, jsonb_build_array(
  pg_temp.o('9001', '3001', 'open', 'paid', '2026-01-15T15:00:00Z')));
select results_eq(
  $$select day, currency, paid_orders, paid_amount, refunded_amount from public.tn_sales_daily
     where connection_id = pg_temp.kid(11)$$,
  $$values ('2026-01-15'::date, 'ARS', 1, 100::numeric, 0::numeric)$$,
  'M16e-T-05: pagado → una venta del día local');

select pg_temp.pub(1, 11, 1, jsonb_build_array(
  pg_temp.o('9001', '3001', 'open', 'partially_refunded', '2026-01-15T15:00:00Z', 'ARS', 100, 30)));
select results_eq(
  $$select paid_orders, paid_amount, refunded_amount from public.tn_sales_daily
     where connection_id = pg_temp.kid(11)$$,
  $$values (1, 100::numeric, 30::numeric)$$,
  'M16e-T-05: reembolso parcial verificado → sigue elegible, con el reembolso aparte');

select pg_temp.pub(1, 11, 1, jsonb_build_array(
  pg_temp.o('9001', '3001', 'cancelled', 'partially_refunded', '2026-01-15T15:00:00Z', 'ARS', 100, 30)));
select is((select count(*)::int from public.tn_sales_daily where connection_id = pg_temp.kid(11)),
  0, 'M16e-T-05: cancelado → deja de contar, sin duplicar estados (solo el vigente)');
select is((select count(*)::int from private.tn_orders where connection_id = pg_temp.kid(11)),
  1, 'M16e-T-05: el pedido republicado tres veces es una sola fila');

-- Cohortes: enero con seis clientes, febrero con tres; un invitado, un pago parcial, otra
-- moneda y un pago a las 23:30 del último día del mes en la zona de la tienda.
select pg_temp.pub(1, 11, 1, (
  select jsonb_agg(pg_temp.o(id, cust, 'closed', 'paid', at::timestamptz))
    from (values
      ('10011', '1001', '2026-01-10T15:00:00Z'), ('10021', '1002', '2026-01-10T15:00:00Z'),
      ('10031', '1003', '2026-01-10T15:00:00Z'), ('10041', '1004', '2026-01-10T15:00:00Z'),
      ('10051', '1005', '2026-01-10T15:00:00Z'),
      ('10012', '1001', '2026-02-10T15:00:00Z'), ('10022', '1002', '2026-02-10T15:00:00Z'),
      ('10032', '1003', '2026-02-10T15:00:00Z'), ('10042', '1004', '2026-02-10T15:00:00Z'),
      ('10052', '1005', '2026-02-10T15:00:00Z'),
      ('20011', '2001', '2026-02-10T15:00:00Z'), ('20021', '2002', '2026-02-10T15:00:00Z'),
      ('20031', '2003', '2026-02-10T15:00:00Z'),
      ('10013', '1001', '2026-03-10T15:00:00Z'), ('10023', '1002', '2026-03-10T15:00:00Z'))
      as x(id, cust, at)) || jsonb_build_array(
  pg_temp.o('9002', null, 'closed', 'paid', '2026-01-20T15:00:00Z'),
  pg_temp.o('9003', '3002', 'open', 'partially_paid', '2026-01-20T15:00:00Z'),
  pg_temp.o('9006', null, 'open', 'paid', '2026-01-20T15:00:00Z', 'USD', 50),
  pg_temp.o('9005', null, 'closed', 'paid', '2026-02-01T02:30:00Z')));

-- Línea editada: primero 2 unidades de un producto; después 3 y otro producto.
select pg_temp.pub(1, 11, 1,
  jsonb_build_array(pg_temp.o('9004', '1006', 'closed', 'paid', '2026-01-10T15:00:00Z')),
  jsonb_build_array(pg_temp.l('9004', 1, '501', '601', 'Remera', 2)));
select pg_temp.pub(1, 11, 1,
  jsonb_build_array(pg_temp.o('9004', '1006', 'closed', 'paid', '2026-01-10T15:00:00Z')),
  jsonb_build_array(pg_temp.l('9004', 1, '501', '601', 'Remera', 3),
                    pg_temp.l('9004', 2, '502', '602', 'Gorra', 1)));

select results_eq(
  $$select day, currency, paid_orders, paid_orders_without_customer, partially_paid_orders
      from public.tn_sales_daily where connection_id = pg_temp.kid(11)
       and day in ('2026-01-20', '2026-01-31') order by 1, 2$$,
  $$values ('2026-01-20'::date, 'ARS', 1, 1, 1), ('2026-01-20'::date, 'USD', 1, 1, 0),
           ('2026-01-31'::date, 'ARS', 1, 1, 0)$$,
  'M16e-T-05/T-14: invitado y pago parcial aparte, monedas sin sumar y 23:30 local en el mes correcto');

select results_eq(
  $$select name, units from public.tn_product_units_daily
     where connection_id = pg_temp.kid(11) order by units desc$$,
  $$values ('Remera', 3::bigint), ('Gorra', 1::bigint)$$,
  'M16e-T-05: la línea editada reemplaza a la anterior (3 y 1, no 5 y 1)');

select results_eq(
  $$select cohort_month, month_offset, cohort_size, active, size_hidden, active_hidden, partial
      from public.tn_cohort_cells where connection_id = pg_temp.kid(11)
     order by 1, 2$$,
  $$values ('2026-01-01'::date, 0, 6, 6, false, false, true),
           ('2026-01-01'::date, 1, 6, 5, false, false, true),
           ('2026-01-01'::date, 2, 6, null, false, true, true),
           ('2026-02-01'::date, 0, null, null, true, true, true),
           ('2026-02-01'::date, 1, null, null, true, true, true)$$,
  'M16e-T-05/T-07: cohortes exactas; menos de cinco se guarda nulo; todo parcial sin cobertura');

select is(
  (select count(*)::int from public.tn_cohort_cells
    where (cohort_size is not null and cohort_size < 5) or (active is not null and active < 5)),
  0, 'M16e-T-07: ninguna celda guarda un conteo menor que cinco');

select is(pg_temp.state_of($$insert into public.tn_cohort_cells
    (company_id, connection_id, cohort_month, month_offset, cohort_size, active,
     size_hidden, active_hidden, partial)
    values (pg_temp.cid(1), pg_temp.kid(11), '2025-01-01', 0, 3, 3, false, false, true)$$),
  '23514', 'M16e-T-07: la tabla rechaza un tamaño de cohorte de tres');

-- Catálogo completo sin el producto 502: queda «eliminado»; el nombre se toma del catálogo.
select worker_api.tn_publish_catalog(pg_temp.uid(1), pg_temp.cid(1), pg_temp.kid(11), 0,
  pg_temp.run(1), pg_temp.lease(1),
  '[{"id":"501","name":"Remera azul","visibility":"visible","variants":[{"id":"601","sku":"REM-1"}]}]',
  '{"next_page":null,"store":{"original_domain":"tienda-sintetica.mitiendanube.com","country":"AR"}}',
  true);
select results_eq(
  $$select name, sku, deleted, units from public.tn_product_units_daily
     where connection_id = pg_temp.kid(11) order by units desc$$,
  $$values ('Remera azul', 'REM-1', false, 3::bigint), ('Gorra', null::text, true, 1::bigint)$$,
  'M16e-T-05: producto borrado del catálogo conserva sus unidades como eliminado');

select is(
  (select store_domain from public.tn_sync_status where connection_id = pg_temp.kid(11)),
  'tienda-sintetica.mitiendanube.com', 'M16e-T-05: el dominio de la tienda queda en el estado');

-- Posesión
select is(pg_temp.state_of($$select worker_api.tn_publish_orders(pg_temp.uid(1), pg_temp.cid(1),
    pg_temp.kid(11), 0, pg_temp.run(1), gen_random_uuid(),
    '{"kind":"backfill","window_from":"2025-12-01","window_to":"2026-03-31","last_page":false}',
    '[]', '[]')$$),
  'PX010', 'M16e-T-03: un lease ajeno no publica (PX010)');
select is(pg_temp.state_of($$select worker_api.tn_publish_orders(pg_temp.uid(1), pg_temp.cid(1),
    pg_temp.kid(11), 0, pg_temp.run(1), pg_temp.lease(1),
    '{"kind":"incremental","last_page":false}', '[]', '[]')$$),
  '22023', 'M16e-T-04: una ventana de otra fase se rechaza');
select is(pg_temp.state_of($$select worker_api.tn_publish_orders(pg_temp.uid(1), pg_temp.cid(1),
    pg_temp.kid(11), 0, pg_temp.run(1), pg_temp.lease(1),
    '{"kind":"backfill","window_from":"2025-12-01","window_to":"2026-03-31","last_page":false}',
    jsonb_build_array(pg_temp.o('9100', null, 'open', 'paid', '2026-01-01T00:00:00Z') || '{"email":"x@y.z"}'),
    '[]')$$),
  '22023', 'M16e-T-10: un pedido con un campo fuera de la proyección se rechaza (no se persiste PII)');
select is(pg_temp.state_of($$select worker_api.tn_start_sync(pg_temp.uid(1), pg_temp.cid(1),
    pg_temp.kid(11), 0, gen_random_uuid(), gen_random_uuid(), clock_timestamp() + interval '1 minute')$$),
  'PX009', 'M16e-T-04: con un paso vigente, otro paso → PX009');

-- Cursor del backfill: avanza solo con la última página de la ventana.
select is(
  (select x.backfill_next from worker_api.tn_publish_orders(pg_temp.uid(1), pg_temp.cid(1),
     pg_temp.kid(11), 0, pg_temp.run(1), pg_temp.lease(1),
     '{"kind":"backfill","window_from":"2025-12-01","window_to":"2025-12-31","last_page":true}',
     '[]', '[]') x),
  '2026-01-01'::date, 'M16e-T-04: la última página de la ventana avanza el checkpoint');
select is(pg_temp.state_of($$select worker_api.tn_publish_orders(pg_temp.uid(1), pg_temp.cid(1),
    pg_temp.kid(11), 0, pg_temp.run(1), pg_temp.lease(1),
    '{"kind":"backfill","window_from":"2025-12-01","window_to":"2025-12-31","last_page":true}',
    '[]', '[]')$$),
  '22023', 'M16e-T-04: una ventana que no empieza en el checkpoint se rechaza');

-- Fin del backfill e incremental: la cobertura llega recién con el primer incremental.
select results_eq(
  $$select x.phase, x.coverage_until is null, x.run_status from worker_api.tn_finish_sync(
      pg_temp.uid(1), pg_temp.cid(1), pg_temp.kid(11), 0, pg_temp.run(1), pg_temp.lease(1),
      clock_timestamp(), true) x$$,
  $$values ('incremental', true, 'complete')$$,
  'M16e-T-04: terminar el backfill pasa a incremental sin declarar cobertura');

select pg_temp.start(1, 11, 2);
select results_eq(
  $$select x.phase, x.coverage_until is not null from worker_api.tn_finish_sync(
      pg_temp.uid(1), pg_temp.cid(1), pg_temp.kid(11), 0, pg_temp.run(2), pg_temp.lease(2),
      clock_timestamp(), true) x$$,
  $$values ('incremental', true)$$,
  'M16e-T-04: el primer incremental completo declara cobertura');
select is(
  (select count(*)::int from public.tn_cohort_cells where connection_id = pg_temp.kid(11) and partial),
  0, 'M16e-T-07: con cobertura, los meses viejos dejan de ser parciales');

-- ---------------------------------------------------------------------------
-- T-07: aislamiento por RLS y lecturas (C-08)
-- ---------------------------------------------------------------------------

select pg_temp.login(1);
select results_eq(
  $$select period_start, currency, paid_orders, covered
      from public.get_tn_sales(pg_temp.kid(11), '2026-01-20', '2026-01-21', 'day')$$,
  $$values ('2026-01-20'::date, 'ARS', 1, true), ('2026-01-20'::date, 'USD', 1, true),
           ('2026-01-21'::date, null::text, 0, true)$$,
  'M16e-T-07: A lee sus ventas; un día sin pedidos es cero cubierto, no ausencia');
select results_eq(
  $$select rank, name, units from public.get_tn_product_units(pg_temp.kid(11), '2026-01-01', '2026-01-31', 10)$$,
  $$values (1, 'Remera azul', 3::bigint), (2, 'Gorra', 1::bigint)$$,
  'M16e-T-05: ranking por unidades');
select results_eq(
  $$select cohort_month, month_offset, cohort_size, active, retention
      from public.get_tn_cohorts(pg_temp.kid(11), '2026-01-01', '2026-01-01', 2)$$,
  $$values ('2026-01-01'::date, 0, 6, 6, 1.0000::numeric), ('2026-01-01'::date, 1, 6, 5, 0.8333::numeric),
           ('2026-01-01'::date, 2, 6, null, null::numeric)$$,
  'M16e-T-05: retención con la regla de cinco');
select is(pg_temp.state_of($$select 1 from private.tn_orders$$), '42501',
  'M16e-T-07: authenticated no lee pedidos (42501)');
select pg_temp.logout();

select pg_temp.login(2);
select is_empty($$select 1 from public.get_tn_sales(pg_temp.kid(11), '2026-01-01', '2026-03-31', 'month')$$,
  'M16e-T-07: B no lee las ventas de A');
select is_empty($$select 1 from public.tn_cohort_cells$$, 'M16e-T-07: B no ve cohortes de A');
select is_empty($$select 1 from public.get_tn_sync_status(pg_temp.kid(11))$$,
  'M16e-T-07: B no ve el estado de A');
select pg_temp.logout();

select is(pg_temp.state_as('anon', $$select 1 from public.get_tn_sales(
    'cc000000-0000-4000-8000-000000001811', '2026-01-01', '2026-01-31', 'day')$$),
  '42501', 'M16e-T-07: anon no ejecuta las lecturas');

-- ---------------------------------------------------------------------------
-- T-06: customer/redact (C-06)
-- ---------------------------------------------------------------------------

select is(worker_api.tn_privacy_customer_redact('777001', '1001', '{10011}'), 'marked',
  'M16e-T-06: primer paso de customer/redact marca');
select is(
  (select count(*)::int from private.tn_redaction_suppressions where connection_id = pg_temp.kid(11)),
  3, 'M16e-T-06: marca los pedidos listados y los demás pedidos locales del cliente (D-M16e-30)');
select is(worker_api.tn_privacy_customer_redact('777001', '1001', '{10011}'), 'done',
  'M16e-T-06: segundo paso borra');
select is(
  (select count(*)::int from private.tn_orders where connection_id = pg_temp.kid(11)
      and external_customer_id = '1001')
  + (select count(*)::int from private.tn_customers where connection_id = pg_temp.kid(11)
      and external_customer_id = '1001'),
  0, 'M16e-T-06: sin pedidos ni fila del cliente');
select results_eq(
  $$select month_offset, cohort_size, active from public.tn_cohort_cells
     where connection_id = pg_temp.kid(11) and cohort_month = '2026-01-01' order by 1$$,
  $$values (0, 5, 5), (1, 5, null::integer), (2, 5, null::integer)$$,
  'M16e-T-06: las cohortes se recalculan sin el cliente');
select is(worker_api.tn_privacy_customer_redact('777001', '1001', '{10011}'), 'done',
  'M16e-T-06: un duplicado no tiene efecto adicional');

select pg_temp.start(1, 11, 3);
select is(
  (select x.orders_suppressed from worker_api.tn_publish_orders(pg_temp.uid(1), pg_temp.cid(1),
     pg_temp.kid(11), 0, pg_temp.run(3), pg_temp.lease(3), '{"kind":"incremental","last_page":false}',
     jsonb_build_array(pg_temp.o('10011', '1001', 'closed', 'paid', '2026-01-10T15:00:00Z'),
                       pg_temp.o('10014', '1001', 'closed', 'paid', '2026-04-10T15:00:00Z')), '[]') x),
  1, 'M16e-T-06: la publicación no reimporta el pedido suprimido');
select results_eq(
  $$select external_order_id from private.tn_orders
     where connection_id = pg_temp.kid(11) and external_customer_id = '1001'$$,
  $$values ('10014')$$,
  'M16e-T-06: una compra posterior del mismo cliente se importa');

-- Paso 2 fallido: la marca queda y el pedido sigue; el siguiente paso de sincronización lo borra.
insert into private.tn_redaction_suppressions (company_id, connection_id, external_customer_id, external_order_id)
values (pg_temp.cid(1), pg_temp.kid(11), '2001', '20011');
select worker_api.tn_finish_sync(pg_temp.uid(1), pg_temp.cid(1), pg_temp.kid(11), 0,
  pg_temp.run(3), pg_temp.lease(3), clock_timestamp(), false);
select pg_temp.start(1, 11, 4);
select is(
  (select count(*)::int from private.tn_orders where connection_id = pg_temp.kid(11)
      and external_order_id = '20011'),
  0, 'M16e-T-06: el primer paso de sincronización borra el pedido marcado antes de leer');

-- ---------------------------------------------------------------------------
-- T-06: store_redact en todas las conexiones de la tienda (C-06, C-08)
-- ---------------------------------------------------------------------------

select pg_temp.tn_connect(2, 12, '777001');
select pg_temp.start(2, 12, 5);
select pg_temp.pub(2, 12, 5, jsonb_build_array(
  pg_temp.o('50001', '5001', 'closed', 'paid', '2026-01-10T15:00:00Z')),
  jsonb_build_array(pg_temp.l('50001', 1, '501', '601', 'Remera', 1)));
select pg_temp.tn_connect(3, 13, '888001');

select is(worker_api.tn_privacy_store_redact('999999', 100), 'done',
  'M16e-T-06: tienda desconocida → done sin escribir');

select is(worker_api.tn_privacy_store_redact('777001', 10), 'marked',
  'M16e-T-06: la primera llamada marca');
select results_eq(
  $$select c.company_id, c.status::text, c.purge_requested_at is not null,
           (select count(*)::int from private.integration_credentials k where k.connection_id = c.id)
      from public.integration_connections c
     where c.provider = 'tiendanube' and c.external_account_id = '777001' order by 1$$,
  $$values (pg_temp.cid(1), 'disconnected', true, 0), (pg_temp.cid(2), 'disconnected', true, 0)$$,
  'M16e-T-06: las conexiones de la tienda en las dos empresas quedan desconectadas y sin credencial');
select is(pg_temp.state_of($$select worker_api.tn_publish_orders(pg_temp.uid(1), pg_temp.cid(1),
    pg_temp.kid(11), 1, pg_temp.run(4), pg_temp.lease(4),
    '{"kind":"incremental","last_page":false}', '[]', '[]')$$),
  'PX004', 'M16e-T-06: una sincronización en vuelo pierde la posesión y no escribe');

select pg_temp.login(1);
select is_empty($$select 1 from public.tn_sales_daily$$,
  'M16e-T-06: después de la marca, los datos ya no se leen');
select pg_temp.logout();

create temp table redact_calls (n integer, result text);
do $fn$
declare v_result text; v_n integer := 0;
begin
  loop
    v_n := v_n + 1;
    v_result := worker_api.tn_privacy_store_redact('777001', 10);
    insert into redact_calls values (v_n, v_result);
    exit when v_result <> 'more' or v_n >= 200;
  end loop;
end;
$fn$;

select ok(
  (select count(*) > 1 from redact_calls where result = 'more')
  and (select result from redact_calls order by n desc limit 1) = 'done',
  'M16e-T-06: el borrado avanza por tandas (more) hasta done');
select is(pg_temp.tn_rows(11) + pg_temp.tn_rows(12), 0,
  'M16e-T-06: cero filas de la tienda en las dos empresas, conexiones incluidas');
select is(
  (select count(*)::int from public.integration_connections where id in (pg_temp.kid(51), pg_temp.kid(13))),
  2, 'M16e-T-06: la conexión de Meta y la de otra tienda quedan intactas');
select is(worker_api.tn_privacy_store_redact('777001', 10), 'done',
  'M16e-T-06: un duplicado después del borrado → done sin efecto');

-- ---------------------------------------------------------------------------
-- Purga por desconexión (C-08, CA-38)
-- ---------------------------------------------------------------------------

select pg_temp.start(3, 13, 6);
select pg_temp.pub(3, 13, 6, jsonb_build_array(
  pg_temp.o('60001', '6001', 'closed', 'paid', '2026-01-10T15:00:00Z')));
select results_eq(
  $$select l.provider, l.reason from worker_api.list_pending_purges(pg_temp.uid(3), pg_temp.cid(3)) l$$,
  $$select 'x'::text, 'x'::text where false$$,
  'M16e-T-03: sin desconexión no hay purga pendiente');
select worker_api.begin_disconnect(pg_temp.uid(3), pg_temp.cid(3), pg_temp.kid(13));
select results_eq(
  $$select l.provider, l.reason, l.has_credential
      from worker_api.list_pending_purges(pg_temp.uid(3), pg_temp.cid(3)) l$$,
  $$values ('tiendanube', 'disconnect_requested', true)$$,
  'M16e-T-03: la purga pendiente informa el proveedor (A-13)');
select is(worker_api.purge_connection(pg_temp.uid(3), pg_temp.cid(3), pg_temp.kid(13)), true,
  'M16e-T-03: purge_connection purga la conexión de Tiendanube');
select is(pg_temp.tn_rows(13), 0, 'M16e-T-07: la purga deja cero filas de la tienda');
select is(worker_api.purge_connection(pg_temp.uid(3), pg_temp.cid(3), pg_temp.kid(13)), false,
  'M16e-T-03: la purga repetida es segura');

-- Cierre del piloto: borrar la empresa no deja huérfanos de Tiendanube.
select pg_temp.new_company(5);
select pg_temp.tn_connect(5, 15, '888002');
select pg_temp.start(5, 15, 7);
select pg_temp.pub(5, 15, 7, jsonb_build_array(
  pg_temp.o('70001', '7001', 'closed', 'paid', '2026-01-10T15:00:00Z')),
  jsonb_build_array(pg_temp.l('70001', 1, '701', '801', 'Taza', 2)));
delete from public.companies where id = pg_temp.cid(5);
select is(pg_temp.tn_rows(15), 0, 'M16e-T-07: el cierre de la empresa no deja filas de Tiendanube');

-- Validación de la entrada de privacidad
select is(pg_temp.state_of($$select worker_api.tn_privacy_store_redact('abc', 10)$$), '22023',
  'M16e-T-06: ID de tienda inválido → 22023');
select is(pg_temp.state_of($$select worker_api.tn_privacy_customer_redact('777001', '1', '{x}')$$),
  '22023', 'M16e-T-06: pedido inválido en customer/redact → 22023');

select * from finish();
rollback;
