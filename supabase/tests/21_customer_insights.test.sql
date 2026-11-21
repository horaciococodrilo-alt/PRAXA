-- PRAXA — M27a (0032): snapshot de RFM, cohortes y propuestas; privilegios, cálculo,
-- privacidad, invalidación y relectura.
--
-- M27a-T-01 (matriz y aislamiento), T-02 (RFM con oráculos escritos a mano), T-06 (cambios de
-- pago y reintento), T-07/T-08 (cohortes), T-09 (privacidad), T-12 (procedencia de catálogo y
-- líneas), T-13 (invalidación y relectura) y T-14 (privacidad y borrado). Todo es sintético:
-- empresas, tiendas, compradores, pedidos y montos inventados. Las funciones de worker_api se
-- llaman como `postgres`, su dueño; las lecturas se prueban con JWT de `authenticated`.

begin;

create extension if not exists pgtap with schema extensions;
select plan(92);

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

create function pg_temp.uid(n integer) returns uuid language sql immutable as
  $fn$ select format('aaaaaaaa-0000-4000-8000-%s', lpad((2100 + n)::text, 12, '0'))::uuid $fn$;
create function pg_temp.cid(n integer) returns uuid language sql immutable as
  $fn$ select format('c0a00000-0000-4000-8000-%s', lpad((2100 + n)::text, 12, '0'))::uuid $fn$;
create function pg_temp.kid(n integer) returns uuid language sql immutable as
  $fn$ select format('cc000000-0000-4000-8000-%s', lpad((2100 + n)::text, 12, '0'))::uuid $fn$;
create function pg_temp.run(n integer) returns uuid language sql immutable as
  $fn$ select format('d0000000-0000-4000-8000-%s', lpad((2100 + n)::text, 12, '0'))::uuid $fn$;
create function pg_temp.lease(n integer) returns uuid language sql immutable as
  $fn$ select format('e0000000-0000-4000-8000-%s', lpad((2100 + n)::text, 12, '0'))::uuid $fn$;

create function pg_temp.tz() returns text language sql immutable as
  $fn$ select 'America/Argentina/Buenos_Aires' $fn$;
-- Corte C: último día local completo cuando la cobertura llega a "ahora".
create function pg_temp.c() returns date language sql stable as
  $fn$ select (clock_timestamp() at time zone pg_temp.tz())::date - 1 $fn$;
create function pg_temp.gen(k integer) returns integer language sql stable as
  $fn$ select c.credential_generation from public.integration_connections c where c.id = pg_temp.kid(k) $fn$;

create function pg_temp.new_company(n integer) returns void language plpgsql as $fn$
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  values (pg_temp.uid(n), '00000000-0000-0000-0000-000000000000', 'authenticated',
          'authenticated', format('clientes.%s@praxa.test', n), 'x', now(), now(), now());
  insert into public.companies (id, name, owner_id)
  values (pg_temp.cid(n), format('Empresa clientes %s', n), pg_temp.uid(n));
end;
$fn$;

create function pg_temp.tn_connect(n integer, k integer, p_store text) returns void
language plpgsql as $fn$
begin
  perform worker_api.create_pending_connection(pg_temp.uid(n), pg_temp.cid(n), pg_temp.kid(k),
    'tiendanube', null, 'AAAA', 'AAAAAAAAAAAAAAAA', 'AAAAAAAAAAAAAAAAAAAAAA==', 1,
    'store_app_token', '12345', '{read_orders,read_customers,read_products}', null);
  perform worker_api.confirm_connection(pg_temp.uid(n), pg_temp.cid(n), pg_temp.kid(k),
    p_store, 'ARS', pg_temp.tz(), true);
end;
$fn$;

-- Pedido proyectado de M27a, pagado en el día local indicado.
create function pg_temp.mo(p_id text, p_customer text, p_day date, p_amount text,
                           p_payment text default 'paid', p_lines text default 'complete',
                           p_amount_status text default 'verified', p_currency text default 'ARS')
returns jsonb language sql stable as $fn$
  select jsonb_build_object(
    'id', p_id, 'customer_id', p_customer, 'status', 'closed', 'payment_status', p_payment,
    'created_at', (p_day::timestamp + interval '12 hours') at time zone pg_temp.tz(),
    'updated_at', (p_day::timestamp + interval '12 hours') at time zone pg_temp.tz(),
    'paid_at', (p_day::timestamp + interval '12 hours') at time zone pg_temp.tz(),
    'closed_at', null, 'cancelled_at', null, 'currency', p_currency,
    'subtotal', p_amount, 'discount', '0', 'total', p_amount, 'total_paid_by_customer', p_amount,
    'storefront', 'store', 'cancel_reason', null, 'is_subscription', false,
    'is_subscription_initial', false, 'refunded_amount', null,
    'insights_amount', case when p_amount_status = 'verified' then p_amount end,
    'insights_amount_status', p_amount_status,
    'insights_amount_definition', case when p_amount_status = 'verified' then 'tn_paid_current_observed_v1' end,
    'insights_identity_status', case when p_customer is null then 'absent' else 'verified' end,
    'insights_lines_status', p_lines)
$fn$;

create function pg_temp.ml(p_order text, p_no integer, p_product text, p_name text)
returns jsonb language sql immutable as $fn$
  select jsonb_build_object('order_id', p_order, 'line_no', p_no, 'product_id', p_product,
    'variant_id', null, 'name', p_name, 'price', '10.00', 'quantity', 1)
$fn$;

create function pg_temp.start(n integer, k integer, r integer) returns text language sql as $fn$
  select s.phase from worker_api.tn_start_sync(pg_temp.uid(n), pg_temp.cid(n), pg_temp.kid(k), pg_temp.gen(k),
    pg_temp.run(r), pg_temp.lease(r), clock_timestamp() + interval '4 minutes') s
$fn$;

create function pg_temp.pub(n integer, k integer, r integer, p_kind text, p_orders jsonb,
                            p_lines jsonb default '[]')
returns integer language sql as $fn$
  select x.orders_written from worker_api.tn_publish_orders(pg_temp.uid(n), pg_temp.cid(n),
    pg_temp.kid(k), pg_temp.gen(k), pg_temp.run(r), pg_temp.lease(r),
    case when p_kind = 'backfill'
         then jsonb_build_object('kind', 'backfill', 'window_from', '2020-01-01',
                                 'window_to', pg_temp.c()::text, 'last_page', false)
         else '{"kind":"incremental","last_page":false}'::jsonb end,
    p_orders, p_lines) x
$fn$;

create function pg_temp.catalog(n integer, k integer, r integer, p_products jsonb, p_next integer,
                                p_new boolean, p_omitted boolean, p_complete boolean)
returns void language sql as $fn$
  select null from worker_api.tn_publish_catalog(pg_temp.uid(n), pg_temp.cid(n), pg_temp.kid(k),
    pg_temp.gen(k), pg_temp.run(r), pg_temp.lease(r), p_products,
    jsonb_build_object('next_page', p_next, 'store', null, 'new_traversal', p_new,
                       'has_omitted_products', p_omitted), p_complete)
$fn$;

create function pg_temp.finish(n integer, k integer, r integer, p_complete boolean default true)
returns text language sql as $fn$
  select x.run_status from worker_api.tn_finish_sync(pg_temp.uid(n), pg_temp.cid(n), pg_temp.kid(k),
    pg_temp.gen(k), pg_temp.run(r), pg_temp.lease(r), clock_timestamp(), p_complete) x
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

create function pg_temp.snap(k integer, p_currency text default 'ARS') returns jsonb language sql stable as $fn$
  select i.payload from public.tn_customer_insights i where i.connection_id = pg_temp.kid(k) and i.currency = p_currency
$fn$;

create function pg_temp.seg(k integer, p_code text) returns jsonb language sql stable as $fn$
  select r from jsonb_array_elements(pg_temp.snap(k)->'segments'->'rows') r where r->>'code' = p_code
$fn$;

create function pg_temp.cell(k integer, p_month date, p_offset integer) returns jsonb language sql stable as $fn$
  select c from jsonb_array_elements(pg_temp.snap(k)->'cohorts'->'rows') r,
                jsonb_array_elements(r->'cells') c
   where r->>'cohortMonth' = to_char(p_month, 'YYYY-MM') and (c->>'offset')::int = p_offset
$fn$;

-- ---------------------------------------------------------------------------
-- T-01: estructura, RLS y matriz de privilegios
-- ---------------------------------------------------------------------------

select results_eq(
  $$select c.relrowsecurity, c.relforcerowsecurity from pg_class c
     where c.oid = 'public.tn_customer_insights'::regclass$$,
  $$values (true, true)$$, 'M27a-T-01: el snapshot existe con RLS habilitada y forzada');

select results_eq(
  $$select r.name, p.name from unnest(array['anon', 'authenticated', 'praxa_integrations', 'service_role']) r(name)
     cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) p(name)
     where has_table_privilege(r.name, 'public.tn_customer_insights', p.name) order by 1, 2$$,
  $$values ('authenticated', 'SELECT')$$,
  'M27a-T-01: solo authenticated lee el snapshot, y solo con SELECT');

select results_eq(
  $$select p.cmd::text, p.roles::text[] collate "default" from pg_policies p
     where p.tablename = 'tn_customer_insights'$$,
  $$values ('SELECT', array['authenticated'])$$, 'M27a-T-01: la única política es el SELECT por membresía');

select results_eq(
  $$select p.prosecdef, p.proconfig = array['search_path=""'] from pg_proc p
     where p.oid = 'public.get_tn_customer_insights(uuid, text)'::regprocedure$$,
  $$values (false, true)$$, 'M27a-T-01: el getter es INVOKER con search_path vacío');

select results_eq(
  $$select r.name from unnest(array['anon', 'authenticated', 'praxa_integrations', 'service_role']) r(name)
     where has_function_privilege(r.name, 'public.get_tn_customer_insights(uuid, text)', 'EXECUTE')$$,
  $$values ('authenticated')$$, 'M27a-T-01: solo authenticated ejecuta el getter');

select is_empty(
  $$select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace, aclexplode(p.proacl) a
     where n.nspname = 'private' and (p.proname like 'tn\_insights\_%' or p.proname like 'tn\_%customer\_insights%')
       and a.grantee <> p.proowner$$,
  'M27a-T-01: los helpers y triggers nuevos no tienen EXECUTE para otros roles');

select results_eq(
  $$select p.proname::text collate "default", p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private' and (p.proname like 'tn\_insights\_%' or p.proname like 'tn\_%customer\_insights%')
     order by 1$$,
  $$values ('tn_customer_insights_payload', false), ('tn_insights_customer_segments', false),
           ('tn_insights_decimal', false), ('tn_insights_metric', false),
           ('tn_insights_on_connection_change', true), ('tn_insights_on_order_delete', true),
           ('tn_insights_on_suppression', true), ('tn_invalidate_customer_insights', false),
           ('tn_refresh_customer_insights', false)$$,
  'M27a-T-01: solo las tres funciones de trigger son DEFINER');

select results_eq(
  $$select p.proname::text collate "default", pg_get_function_identity_arguments(p.oid)
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'worker_api' and p.proname in ('tn_start_sync', 'tn_publish_orders', 'tn_publish_catalog', 'tn_finish_sync')
       and has_function_privilege('praxa_integrations', p.oid, 'EXECUTE')
       and not has_function_privilege('authenticated', p.oid, 'EXECUTE') order by 1$$,
  $$values ('tn_finish_sync', 'p_actor_user_id uuid, p_company_id uuid, p_connection_id uuid, p_expected_generation integer, p_run_id uuid, p_lease_token uuid, p_fetched_at timestamp with time zone, p_complete boolean'),
           ('tn_publish_catalog', 'p_actor_user_id uuid, p_company_id uuid, p_connection_id uuid, p_expected_generation integer, p_run_id uuid, p_lease_token uuid, p_products jsonb, p_state jsonb, p_complete boolean'),
           ('tn_publish_orders', 'p_actor_user_id uuid, p_company_id uuid, p_connection_id uuid, p_expected_generation integer, p_run_id uuid, p_lease_token uuid, p_window jsonb, p_orders jsonb, p_lines jsonb'),
           ('tn_start_sync', 'p_actor_user_id uuid, p_company_id uuid, p_connection_id uuid, p_expected_generation integer, p_run_id uuid, p_lease_token uuid, p_lease_expires_at timestamp with time zone')$$,
  'M27a-T-16: las cuatro funciones reemplazadas conservan firma y grants');

-- ---------------------------------------------------------------------------
-- Semilla X (empresa 1): 21 compradores, 60 pedidos; bordes de R, F y M (T-02)
-- ---------------------------------------------------------------------------

select pg_temp.new_company(1);
select pg_temp.new_company(2);
select pg_temp.new_company(3);
select pg_temp.new_company(4);
select pg_temp.tn_connect(1, 1, '777101');
select pg_temp.tn_connect(2, 2, '777102');
select pg_temp.tn_connect(3, 3, '777103');
select pg_temp.tn_connect(4, 4, '777104');

create temp table x_orders (cust text, days integer, amount text);
insert into x_orders values
  ('1001', 30, '10'), ('1002', 31, '10'), ('1003', 60, '5'), ('1003', 100, '5'),
  ('1004', 61, '5'), ('1004', 70, '5'), ('1004', 80, '5'),
  ('1005', 90, '100'), ('1005', 100, '100'), ('1005', 110, '100'), ('1005', 120, '100'),
  ('1006', 91, '20'), ('1006', 101, '20'), ('1006', 111, '20'), ('1006', 121, '20'), ('1006', 131, '20'),
  ('1007', 180, '10'), ('1007', 190, '10'), ('1007', 200, '10'), ('1007', 210, '10'), ('1007', 220, '10'),
  ('1007', 230, '10'), ('1007', 240, '10'), ('1007', 250, '10'), ('1007', 260, '10'),
  ('1008', 181, '10'), ('1008', 191, '10'), ('1008', 201, '10'), ('1008', 211, '10'), ('1008', 221, '10'),
  ('1008', 231, '10'), ('1008', 241, '10'), ('1008', 251, '10'), ('1008', 261, '10'), ('1008', 271, '10'),
  ('1009', 0, '250'), ('1009', 5, '250'), ('1010', 10, '600'), ('1011', 45, '150'), ('1011', 50, '150'),
  ('1012', 20, '5'), ('1012', 25, '5'), ('1012', 30, '10'), ('1013', 364, '5'), ('1013', 400, '999'),
  ('1014', 200, '25'), ('1014', 210, '25'), ('1015', 100, '40'), ('1016', 89, '200'), ('1016', 95, '200'),
  ('1017', 15, '100'), ('1017', 16, '100'), ('1017', 17, '100'), ('1018', 5, '10'), ('1018', 6, '15'),
  ('1019', 30, '30'), ('1019', 31, '30'), ('1020', 91, '10'), ('1021', 500, '50'), (null, 12, '70');

select is((select count(*)::int from x_orders), 60, 'M27a-T-02: el fixture X tiene 60 pedidos');

select is(pg_temp.start(1, 1, 1), 'backfill', 'M27a-T-02: X arranca en backfill');
select is(pg_temp.pub(1, 1, 1, 'backfill',
  (select jsonb_agg(pg_temp.mo((5000 + n)::text, cust, pg_temp.c() - days, amount,
                               p_lines => case when cust is null then 'source_omitted' else 'complete' end))
     from (select row_number() over () as n, * from x_orders) t)), 60, 'M27a-T-02: X publica sus 60 pedidos');
select is(pg_temp.finish(1, 1, 1), 'complete', 'M27a-T-02: X cierra el backfill');
select is((select count(*)::int from public.tn_customer_insights where connection_id = pg_temp.kid(1)), 0,
  'M27a-T-13: un backfill completo no publica snapshot');
select is(pg_temp.start(1, 1, 2), 'incremental', 'M27a-T-02: X pasa a incremental');
select is(pg_temp.finish(1, 1, 2), 'complete', 'M27a-T-02: X cierra el incremental');

select results_eq(
  $$select customer_id, recency, frequency, monetary, r_score, f_score, m_score, segment
      from private.tn_insights_customer_segments(pg_temp.kid(1), 'ARS', pg_temp.c()) order by 1$$,
  $$values ('1001', 30, 1, 10::numeric, 5, 1, 1, 'nuevos'), ('1002', 31, 1, 10, 4, 1, 1, 'potencial'),
           ('1003', 60, 2, 10, 4, 2, 1, 'potencial'), ('1004', 61, 3, 15, 3, 3, 1, 'frecuentes'),
           ('1005', 90, 4, 400, 3, 3, 4, 'alto_valor'), ('1006', 91, 5, 100, 2, 4, 3, 'riesgo'),
           ('1007', 180, 9, 90, 2, 4, 3, 'riesgo'), ('1008', 181, 10, 100, 1, 5, 3, 'inactivos'),
           ('1009', 0, 2, 500, 5, 2, 4, 'alto_valor'), ('1010', 10, 1, 600, 5, 1, 4, 'nuevos'),
           ('1011', 45, 2, 300, 4, 2, 3, 'potencial'), ('1012', 20, 3, 20, 5, 3, 1, 'frecuentes'),
           ('1013', 364, 1, 5, 1, 1, 1, 'inactivos'), ('1014', 200, 2, 50, 1, 2, 2, 'inactivos'),
           ('1015', 100, 1, 40, 2, 1, 2, 'riesgo'), ('1016', 89, 2, 400, 3, 2, 4, 'alto_valor'),
           ('1017', 15, 3, 300, 5, 3, 3, 'frecuentes'), ('1018', 5, 2, 25, 5, 2, 2, 'potencial'),
           ('1019', 30, 2, 60, 5, 2, 3, 'potencial'), ('1020', 91, 1, 10, 2, 1, 1, 'riesgo')$$,
  'M27a-T-02: R, F, M, puntajes y segmento coinciden con el oráculo escrito a mano (bordes y empates)');

select is(
  (select array_agg(row(customer_id, segment)::text order by customer_id)
     from private.tn_insights_customer_segments(pg_temp.kid(1), 'ARS', pg_temp.c())),
  (select array_agg(row(customer_id, segment)::text order by customer_id)
     from private.tn_insights_customer_segments(pg_temp.kid(1), 'ARS', pg_temp.c())),
  'M27a-T-02: la misma entrada, corte y reglas producen la misma clasificación');

select is(pg_temp.snap(1)->'segments',
  '{"status":"unavailable","absence":"privacidad","definition":"segment_partition_v1"}'::jsonb,
  'M27a-T-09: con un segmento de 1–4 compradores se oculta toda la distribución de la moneda');

select results_eq(
  $$select pg_temp.snap(1)->'quality'->>'identity', pg_temp.snap(1)->'quality'->>'orderLines',
           pg_temp.snap(1)->'quality'->>'catalog', pg_temp.snap(1)->'quality'->'monetary'->>'status',
           pg_temp.snap(1)->'productEvidence'->'crossSell'->>'absence'$$,
  $$values ('incompleta', 'incompletas', 'incompleto', 'verified', 'dato_incompleto')$$,
  'M27a-T-12: un pedido sin comprador ni líneas y un catálogo sin recorrer dejan calidad incompleta y sin venta cruzada');

select results_eq(
  $$select pg_temp.snap(1)->>'asOfDay', pg_temp.snap(1)->>'rfmFrom', pg_temp.snap(1)->>'currency',
           pg_temp.snap(1)->>'timezone', pg_temp.snap(1)->>'firstPurchaseBasis'$$,
  $$select pg_temp.c()::text, (pg_temp.c() - 364)::text, 'ARS', pg_temp.tz(), 'observada'$$,
  'M27a-T-03: corte, ventana inclusiva de 365 días, moneda, zona y primera compra observada explícitos');

select is_empty(
  $$select g from generate_series(1001, 1021) g where pg_temp.snap(1)::text like '%"' || g || '"%'
    union all select g from generate_series(5001, 5060) g where pg_temp.snap(1)::text like '%"' || g || '"%'$$,
  'M27a-T-09: el payload no contiene IDs de compradores ni de pedidos');

-- ---------------------------------------------------------------------------
-- Semilla Y (empresa 2): segmentos publicables y venta cruzada
-- ---------------------------------------------------------------------------

create temp table y_orders (oid text, cust text, days integer);
insert into y_orders
select (6000 + g)::text, (2000 + g)::text, 199 + g from generate_series(1, 5) g;
insert into y_orders
select (6100 + 3 * g + j)::text, (2010 + g)::text, 9 + g + j from generate_series(1, 10) g, generate_series(0, 2) j;

select is(pg_temp.start(2, 2, 21), 'backfill', 'M27a-T-02: Y arranca en backfill');
select pg_temp.catalog(2, 2, 21,
  '[{"id":"501","name":"Taza sintética","visibility":"visible","variants":[]},
    {"id":"502","name":"Plato sintético","visibility":"visible","variants":[]}]', null, true, false, true);
select is(pg_temp.pub(2, 2, 21, 'backfill',
  (select jsonb_agg(pg_temp.mo(oid, cust, pg_temp.c() - days, '10')) from y_orders),
  (select jsonb_agg(l) from (
     select pg_temp.ml((6100 + 3 * g)::text, 1, '501', 'Taza sintética') l from generate_series(1, 10) g
     union all
     select pg_temp.ml((6100 + 3 * g + 1)::text, 1, '502', 'Plato sintético') from generate_series(1, 5) g) x)),
  35, 'M27a-T-02: Y publica 35 pedidos con líneas');
select is(pg_temp.finish(2, 2, 21), 'complete', 'M27a-T-02: Y cierra el backfill');
select is(pg_temp.start(2, 2, 22), 'incremental', 'M27a-T-02: Y pasa a incremental');
select is(pg_temp.finish(2, 2, 22), 'complete', 'M27a-T-02: Y cierra el incremental');

select is(pg_temp.snap(2)->'quality',
  jsonb_build_object('coverage', jsonb_build_object('fromDay', null, 'throughDay', pg_temp.c()::text, 'complete', true),
    'identity', 'completa', 'monetary', '{"status":"verified","definition":"tn_paid_current_observed_v1"}'::jsonb,
    'catalog', 'completo', 'orderLines', 'completas'),
  'M27a-T-02: Y tiene calidad completa y Monetary verificado');

select is(pg_temp.snap(2)->'segments'->'totalCustomers',
  '{"value":"15","absence":null,"unit":"customers","definition":"segment_total_customers_v1"}'::jsonb,
  'M27a-T-02: total de compradores divulgable de Y');
select is(pg_temp.snap(2)->'segments'->'excludedBeforeWindow'->>'absence', 'privacidad',
  'M27a-T-09: cero excluidos se oculta como grupo protegido');

select results_eq(
  $$select r->>'code', r->'customers'->>'value', r->'orders'->>'value', r->'monetary'->>'value',
           r->'monetaryPerCustomer'->>'value', r->'monetaryPerOrder'->>'value',
           r->'recencyMedianDays'->>'value', r->'frequencyMean'->>'value',
           r->'monetaryPerCustomer'->>'absence'
      from jsonb_array_elements(pg_temp.snap(2)->'segments'->'rows') with ordinality t(r, i) order by i$$,
  $$values ('inactivos', '5', '5', '50', '10', '10', '202', '1', null),
           ('riesgo', '0', '0', '0', null, null, null, null, 'sin_denominador'),
           ('nuevos', '0', '0', '0', null, null, null, null, 'sin_denominador'),
           ('alto_valor', '0', '0', '0', null, null, null, null, 'sin_denominador'),
           ('frecuentes', '10', '30', '300', '30', '10', '14.5', '3', null),
           ('potencial', '0', '0', '0', null, null, null, null, 'sin_denominador')$$,
  'M27a-T-02: segmentos de Y en orden de prioridad, con mediana (no promedio) y denominadores explícitos');

select is(pg_temp.snap(2)->'productEvidence'->'crossSell',
  '{"status":"available","sourceSegment":"frecuentes","productAName":"Taza sintética","productBName":"Plato sintético",
    "coPurchaseSufficient":true,"targetSufficient":true,"identifiedCustomers":null,
    "identifiedCustomersAbsence":"privacidad","definition":"cross_sell_pair_v1"}'::jsonb,
  'M27a-T-12: par seguro (co-compra 5 y A sin B 5) sin conteos ni claves');

select ok(pg_temp.snap(2)::text !~ '"50[12]"', 'M27a-T-12: el payload no lleva IDs de producto');

-- T-06: cambio de pago, reintento y pérdida de elegibilidad (C-05, C-12)
select is(pg_temp.start(2, 2, 23), 'incremental', 'M27a-T-06: Y abre otro incremental');
select is((select count(*)::int from public.tn_customer_insights where connection_id = pg_temp.kid(2)), 0,
  'M27a-T-13: iniciar una sincronización invalida el snapshot');
select is(pg_temp.pub(2, 2, 23, 'incremental',
  jsonb_build_array(pg_temp.mo('6103', '2011', pg_temp.c() - 10, '4', 'partially_refunded'))), 1,
  'M27a-T-06: el pedido pasa a parcialmente reembolsado con 4 validado');
select is(pg_temp.finish(2, 2, 23), 'complete', 'M27a-T-06: Y cierra el incremental');
select results_eq(
  $$select pg_temp.seg(2, 'frecuentes')->'orders'->>'value', pg_temp.seg(2, 'frecuentes')->'monetary'->>'value',
           pg_temp.seg(2, 'frecuentes')->'monetaryPerCustomer'->>'value',
           pg_temp.seg(2, 'frecuentes')->'monetaryPerOrder'->>'value'$$,
  $$values ('30', '294', '29.4', '9.8')$$,
  'M27a-T-06: parcialmente reembolsado sigue elegible con su monto vigente, sin doble descuento');

select pg_temp.start(2, 2, 24);
select pg_temp.pub(2, 2, 24, 'incremental',
  jsonb_build_array(pg_temp.mo('6103', '2011', pg_temp.c() - 10, '4', 'partially_refunded')));
select pg_temp.pub(2, 2, 24, 'incremental',
  jsonb_build_array(pg_temp.mo('6103', '2011', pg_temp.c() - 10, '4', 'partially_refunded')));
select pg_temp.finish(2, 2, 24);
select is(pg_temp.seg(2, 'frecuentes')->'monetary'->>'value', '294',
  'M27a-T-06: reintentar la misma ventana no suma dos veces');

select pg_temp.start(2, 2, 25);
select pg_temp.pub(2, 2, 25, 'incremental',
  jsonb_build_array(pg_temp.mo('6103', '2011', pg_temp.c() - 10, '4', 'refunded', p_amount_status => 'verified')));
select pg_temp.finish(2, 2, 25);
select is(
  (select frequency from private.tn_insights_customer_segments(pg_temp.kid(2), 'ARS', pg_temp.c())
    where customer_id = '2011'), 2,
  'M27a-T-06: un pedido reembolsado deja de ser elegible');

-- ---------------------------------------------------------------------------
-- Semilla Z (empresa 3): cohortes con oráculo (T-07, T-08)
-- ---------------------------------------------------------------------------

create function pg_temp.m0() returns date language sql stable as
  $fn$ select (date_trunc('month', pg_temp.c()) - interval '4 months')::date $fn$;
create function pg_temp.w0() returns date language sql stable as
  $fn$ select (pg_temp.m0() - interval '1 month')::date $fn$;
create function pg_temp.mday(p_month date, p_add integer, p_day integer) returns date language sql stable as
  $fn$ select (p_month + make_interval(months => p_add))::date + (p_day - 1) $fn$;

create temp table z_orders (oid text, cust text, day date, amount text);
insert into z_orders
select (7000 + g)::text, (3000 + g)::text, pg_temp.mday(pg_temp.m0(), 0, 1), '10' from generate_series(1, 10) g;
insert into z_orders
select (7020 + g)::text, (3000 + g)::text, pg_temp.mday(pg_temp.m0(), 0, 5), '20' from generate_series(1, 2) g;
insert into z_orders
select (7040 + g)::text, (3000 + g)::text, pg_temp.mday(pg_temp.m0(), 1, 10), '30' from generate_series(1, 6) g;
insert into z_orders
select (7060 + g)::text, (3000 + g)::text, pg_temp.mday(pg_temp.m0(), 2, 10), '30' from generate_series(1, 4) g;
insert into z_orders
select (7100 + g)::text, (3100 + g)::text, pg_temp.mday(pg_temp.w0(), 0, 1), '10' from generate_series(1, 5) g;
insert into z_orders
select (7120 + g)::text, (3100 + g)::text, pg_temp.mday(pg_temp.w0(), 1, 3), '10' from generate_series(1, 5) g;
insert into z_orders values ('7140', '3101', pg_temp.mday(pg_temp.w0(), 2, 3), '10');

select pg_temp.start(3, 3, 31);
select pg_temp.pub(3, 3, 31, 'backfill', (select jsonb_agg(pg_temp.mo(oid, cust, day, amount)) from z_orders));
select pg_temp.finish(3, 3, 31);
select pg_temp.start(3, 3, 32);
select is(pg_temp.finish(3, 3, 32), 'complete', 'M27a-T-07: Z publica su snapshot');

select is(
  (select r->'size'->>'value' from jsonb_array_elements(pg_temp.snap(3)->'cohorts'->'rows') r
    where r->>'cohortMonth' = to_char(pg_temp.m0(), 'YYYY-MM')), '10',
  'M27a-T-07: la cohorte del mes 0 tiene 10 compradores');

select results_eq(
  $$select pg_temp.cell(3, pg_temp.m0(), 0)->'activeCustomers'->>'value',
           pg_temp.cell(3, pg_temp.m0(), 0)->'retention'->>'value',
           pg_temp.cell(3, pg_temp.m0(), 0)->'repeatPurchaseCumulative'->>'absence',
           pg_temp.cell(3, pg_temp.m0(), 0)->'observedValue'->>'value',
           pg_temp.cell(3, pg_temp.m0(), 0)->'ticket'->>'value',
           pg_temp.cell(3, pg_temp.m0(), 0)->'observedValuePerCustomerCumulative'->>'value',
           pg_temp.cell(3, pg_temp.m0(), 0)->'repeatCustomers'->>'absence'$$,
  $$values ('10', '1', 'privacidad', '140', '11.666667', '14', 'privacidad')$$,
  'M27a-T-07/T-08: mes 0 con dos pedidos de 2 compradores: recompra 2 oculta, valor y ticket exactos');

select results_eq(
  $$select pg_temp.cell(3, pg_temp.m0(), 1)->'activeCustomers'->>'value',
           pg_temp.cell(3, pg_temp.m0(), 1)->'retention'->>'value',
           pg_temp.cell(3, pg_temp.m0(), 1)->'repeatPurchaseCumulative'->>'value',
           pg_temp.cell(3, pg_temp.m0(), 1)->'observedValue'->>'value',
           pg_temp.cell(3, pg_temp.m0(), 1)->'ticket'->>'value',
           pg_temp.cell(3, pg_temp.m0(), 1)->'observedValuePerCustomerCumulative'->>'value',
           pg_temp.cell(3, pg_temp.m0(), 1)->'repeatCustomers'->>'value',
           pg_temp.cell(3, pg_temp.m0(), 1)->'purchaseIntervals'->>'value',
           pg_temp.cell(3, pg_temp.m0(), 1)->'meanDaysBetweenPurchases'->>'value'$$,
  $$select '6', '0.6', '0.6', '180', '30', '32', '6', '8',
           trim_scale(round(0.75 * (pg_temp.mday(pg_temp.m0(), 1, 10) - pg_temp.m0()), 6))::text$$,
  'M27a-T-07/T-08: mes 1 con 6 activos; recompra acumulada, intervalos (media sobre 8) y valor acumulado exactos');

select results_eq(
  $$select pg_temp.cell(3, pg_temp.m0(), k)->'activeCustomers'->>'absence',
           pg_temp.cell(3, pg_temp.m0(), k)->'activeCustomers'->>'value',
           pg_temp.cell(3, pg_temp.m0(), k)->'ticket'->>'value'
      from unnest(array[2, 3, 5]) k$$,
  $$values ('privacidad', null::text, null::text), ('privacidad', null, null), ('periodo_abierto', null, null)$$,
  'M27a-T-07: 4 y 0 activos son privacidad sin valor; un mes abierto o futuro es periodo_abierto');

select results_eq(
  $$select pg_temp.cell(3, pg_temp.w0(), 1)->'activeCustomers'->>'value',
           pg_temp.cell(3, pg_temp.w0(), 1)->'retention'->>'value',
           pg_temp.cell(3, pg_temp.w0(), 2)->'activeCustomers'->>'absence'$$,
  $$values ('5', '1', 'privacidad')$$,
  'M27a-T-07: 5 activos se divulgan; 1 activo es privacidad');

select ok(
  (select bool_and(c->'activeCustomers'->>'value' is not null or
                   not exists (select 1 from jsonb_each(c) e
                                where jsonb_typeof(e.value) = 'object' and e.value->>'value' is not null))
     from jsonb_array_elements(pg_temp.snap(3)->'cohorts'->'rows') r, jsonb_array_elements(r->'cells') c),
  'M27a-T-09: ninguna celda oculta deja una métrica visible que la reconstruya');

-- Moneda separada: un pedido en USD no se suma al ARS (T-03, T-08)
select pg_temp.start(3, 3, 33);
select pg_temp.pub(3, 3, 33, 'incremental',
  jsonb_build_array(pg_temp.mo('7200', '3001', pg_temp.c() - 2, '99', p_currency => 'USD')));
select pg_temp.finish(3, 3, 33);
select results_eq(
  $$select currency from public.tn_customer_insights where connection_id = pg_temp.kid(3) order by 1$$,
  $$values ('ARS'), ('USD')$$, 'M27a-T-03: un snapshot por moneda, ordenado');
select is(pg_temp.cell(3, pg_temp.m0(), 1)->'observedValue'->>'value', '180',
  'M27a-T-08: el monto en otra moneda no se suma');

-- Monetary sin validar: segmentos y dinero ausentes con su motivo (C-04)
select pg_temp.start(3, 3, 34);
select pg_temp.pub(3, 3, 34, 'incremental',
  jsonb_build_array(pg_temp.mo('7001', '3001', pg_temp.mday(pg_temp.m0(), 0, 1), '10', p_amount_status => 'unverified')));
select pg_temp.finish(3, 3, 34);
select results_eq(
  $$select pg_temp.snap(3)->'quality'->'monetary'->>'status', pg_temp.snap(3)->'segments'->>'absence',
           pg_temp.cell(3, pg_temp.m0(), 1)->'observedValue'->>'absence',
           pg_temp.cell(3, pg_temp.m0(), 1)->'activeCustomers'->>'value'$$,
  $$values ('unverified', 'monetario_no_validado', 'monetario_no_validado', '6')$$,
  'M27a-C-04: un pedido sin validar deja M y dinero indisponibles, las cohortes no monetarias siguen');

select pg_temp.start(3, 3, 35);
select pg_temp.pub(3, 3, 35, 'incremental',
  jsonb_build_array(pg_temp.mo('7001', '3001', pg_temp.mday(pg_temp.m0(), 0, 1), '10', p_amount_status => 'incomplete')));
select pg_temp.finish(3, 3, 35);
select is(pg_temp.snap(3)->'segments'->>'absence', 'dato_incompleto',
  'M27a-T-15: incomplete no se colapsa en monetario_no_validado');

-- ---------------------------------------------------------------------------
-- T-01: aislamiento con JWT
-- ---------------------------------------------------------------------------

select pg_temp.login(1);
select results_eq($$select currency from public.tn_customer_insights$$, $$values ('ARS')$$,
  'M27a-T-01: el dueño de X ve solo su snapshot');
select is((select count(*)::int from public.get_tn_customer_insights(pg_temp.kid(1), 'ARS')), 1,
  'M27a-T-01: el getter devuelve su fila');
select is((select count(*)::int from public.get_tn_customer_insights(pg_temp.kid(2), 'ARS')), 0,
  'M27a-T-01: una conexión ajena devuelve cero filas');
select is(pg_temp.state_of($$select * from public.get_tn_customer_insights(pg_temp.kid(1), 'ars')$$),
  '22023', 'M27a-T-03: moneda malformada → 22023');
select is(pg_temp.state_of($$select * from public.get_tn_customer_insights(null, 'ARS')$$),
  '22023', 'M27a-T-01: conexión nula → 22023');
select is(pg_temp.state_of($$insert into public.tn_customer_insights select * from public.tn_customer_insights$$),
  '42501', 'M27a-T-01: authenticated no escribe el snapshot');
select is(pg_temp.state_of($$update public.tn_customer_insights set payload = '{}'$$),
  '42501', 'M27a-T-01: authenticated no modifica el snapshot');
select is(pg_temp.state_of($$select insights_amount from private.tn_orders$$),
  '42501', 'M27a-T-01: authenticated no lee las columnas privadas');
select is((select count(*)::int from public.tn_customer_insights where company_id = pg_temp.cid(2)), 0,
  'M27a-T-01: filtrar por otra empresa no revela filas');
select pg_temp.logout();

select is(pg_temp.state_of($$set local role anon; select * from public.tn_customer_insights$$),
  '42501', 'M27a-T-01: anon no lee el snapshot');
reset role;

-- ---------------------------------------------------------------------------
-- T-12: procedencia del catálogo entre páginas (empresa 4)
-- ---------------------------------------------------------------------------

create function pg_temp.cat_status(k integer) returns text language sql stable as
  $fn$ select s.insights_catalog_status from public.tn_sync_status s where s.connection_id = pg_temp.kid(k) $fn$;

select pg_temp.start(4, 4, 41);
select is(pg_temp.state_of($$select pg_temp.catalog(4, 4, 41, '[]', null, false, false, true)$$), '22023',
  'M27a-T-12: la página 1 sin new_traversal → 22023');
select pg_temp.catalog(4, 4, 41, '[{"id":"601","name":"Producto sintético","visibility":"visible","variants":[]}]',
  2, true, false, false);
select is(pg_temp.cat_status(4), 'cycle_incomplete', 'M27a-T-12: un recorrido a medias es cycle_incomplete');
select is(pg_temp.state_of($$select pg_temp.catalog(4, 4, 41, '[]', null, true, false, true)$$), '22023',
  'M27a-T-12: new_traversal a mitad de recorrido → 22023');
select pg_temp.catalog(4, 4, 41, '[]', null, false, true, true);
select is(pg_temp.cat_status(4), 'omitted_items', 'M27a-T-12: omisiones de una página previa se conservan al cerrar');
select pg_temp.catalog(4, 4, 41, '[]', null, true, false, true);
select is(pg_temp.cat_status(4), 'complete', 'M27a-T-12: un recorrido nuevo sin omisiones queda complete');
select pg_temp.catalog(4, 4, 41, '[]', 2, true, false, false);
select pg_temp.finish(4, 4, 41, false);
update public.integration_connections set credential_generation = credential_generation + 1 where id = pg_temp.kid(4);
select results_eq(
  $$select s.insights_catalog_status, s.insights_rebuild_pending, s.catalog_next_page
      from public.tn_sync_status s where s.connection_id = pg_temp.kid(4)$$,
  $$values ('unknown', true, null::integer)$$,
  'M27a-T-12/T-13: un cambio de generación vuelve el catálogo a unknown y pide relectura');

select is(pg_temp.state_of($$select worker_api.tn_publish_orders(pg_temp.uid(4), pg_temp.cid(4), pg_temp.kid(4),
    pg_temp.gen(4), pg_temp.run(42), pg_temp.lease(42), '{"kind":"incremental","last_page":false}',
    jsonb_build_array(pg_temp.mo('8001', '4001', pg_temp.c(), '10') - 'insights_lines_status'), '[]')$$),
  '22023', 'M27a-T-05: un pedido sin las claves nuevas → 22023');
select pg_temp.start(4, 4, 42);
select is(pg_temp.state_of($$select pg_temp.pub(4, 4, 42, 'backfill',
    jsonb_build_array(pg_temp.mo('8001', '4001', pg_temp.c(), '10') || '{"insights_amount_status":"unverified"}'))$$),
  '22023', 'M27a-T-05: monto con estado incoherente → 22023');
select is(pg_temp.state_of($$select pg_temp.pub(4, 4, 42, 'backfill',
    jsonb_build_array(pg_temp.mo('8001', '4001', pg_temp.c(), '10') || '{"insights_amount":1.5}'))$$),
  '22023', 'M27a-T-05: un monto numérico JSON → 22023');
select is(pg_temp.state_of($$select pg_temp.pub(4, 4, 42, 'backfill',
    jsonb_build_array(pg_temp.mo('8001', '4001', pg_temp.c(), '10') || '{"insights_identity_status":"unverified"}'))$$),
  '22023', 'M27a-T-05: el cliente no puede declarar identidad unverified');
select is(pg_temp.state_of($$select pg_temp.pub(4, 4, 42, 'backfill',
    jsonb_build_array(pg_temp.mo('8001', null, pg_temp.c(), '10') || '{"insights_identity_status":"verified"}'))$$),
  '22023', 'M27a-T-05: identidad verificada sin comprador → 22023');
select is(pg_temp.state_of($$select pg_temp.pub(4, 4, 42, 'backfill',
    jsonb_build_array(pg_temp.mo('8001', '4001', pg_temp.c(), '10') || '{"extra":1}'))$$),
  '22023', 'M27a-T-05: una clave extra → 22023');
select pg_temp.finish(4, 4, 42, false);

-- ---------------------------------------------------------------------------
-- T-13: relectura completa sin borrar cobertura ni el dataset de M16e
-- ---------------------------------------------------------------------------

create temp table y_before as
  select s.coverage_until, (select count(*) from public.tn_sales_daily d where d.connection_id = pg_temp.kid(2)) as sales
    from public.tn_sync_status s where s.connection_id = pg_temp.kid(2);
update public.tn_sync_status set insights_rebuild_pending = true where connection_id = pg_temp.kid(2);

select is(pg_temp.start(2, 2, 26), 'backfill', 'M27a-T-13: con relectura pendiente el paso es un backfill');
select results_eq(
  $$select s.phase, s.backfill_next, s.insights_rebuild_started, s.coverage_until = b.coverage_until
      from public.tn_sync_status s, y_before b where s.connection_id = pg_temp.kid(2)$$,
  $$values ('incremental', null::date, true, true)$$,
  'M27a-T-13: la relectura arranca desde historyStart y conserva fase y cobertura');
select is(pg_temp.finish(2, 2, 26, false), 'incomplete', 'M27a-T-13: un corte deja la relectura incompleta');
select is(pg_temp.start(2, 2, 27), 'backfill', 'M27a-T-13: el siguiente paso reanuda el backfill');
select is((select count(*)::int from public.tn_customer_insights where connection_id = pg_temp.kid(2)), 0,
  'M27a-T-13: un backfill interrumpido no publica snapshot');
select pg_temp.pub(2, 2, 27, 'backfill',
  (select jsonb_agg(pg_temp.mo(oid, cust, pg_temp.c() - days, '10')) from y_orders where oid <> '6103'));
select pg_temp.finish(2, 2, 27);
select results_eq(
  $$select s.phase, s.insights_rebuild_pending, s.insights_rebuild_started, s.coverage_until = b.coverage_until,
           (select count(*) from public.tn_sales_daily d where d.connection_id = pg_temp.kid(2)) = b.sales
      from public.tn_sync_status s, y_before b where s.connection_id = pg_temp.kid(2)$$,
  $$values ('incremental', false, false, true, true)$$,
  'M27a-T-13: la relectura completa limpia sus marcas sin borrar cobertura ni ventas');
select is((select count(*)::int from public.tn_customer_insights where connection_id = pg_temp.kid(2)), 0,
  'M27a-T-13: tras la relectura el snapshot espera el siguiente incremental');
select pg_temp.start(2, 2, 28);
select pg_temp.finish(2, 2, 28);
select is((select count(*)::int from public.tn_customer_insights where connection_id = pg_temp.kid(2)), 1,
  'M27a-T-13: el siguiente incremental completo publica el snapshot');

-- ---------------------------------------------------------------------------
-- T-14: privacidad, desconexión, generación, zona y borrado
-- ---------------------------------------------------------------------------

select is(worker_api.tn_privacy_customer_redact('777102', '2012', '{}'), 'marked',
  'M27a-T-14: customer/redact marca los pedidos');
select is((select count(*)::int from public.tn_customer_insights where connection_id = pg_temp.kid(2)), 0,
  'M27a-T-14: la marca invalida el snapshot antes del borrado');
select pg_temp.start(2, 2, 29);
select pg_temp.finish(2, 2, 29);
select is((select count(*)::int from private.tn_insights_customer_segments(pg_temp.kid(2), 'ARS', pg_temp.c())
            where customer_id = '2012'), 0,
  'M27a-T-14: el comprador suprimido no vuelve al cálculo');
select is(pg_temp.seg(2, 'frecuentes'), null,
  'M27a-T-14: sin el comprador, el grupo chico oculta la distribución (no se reconstruye por diferencia)');

select is(worker_api.tn_privacy_customer_redact('777102', '2013', '{}'), 'marked', 'M27a-T-14: otra marca');
select pg_temp.start(2, 2, 30);
select is(worker_api.tn_privacy_customer_redact('777102', '2014', '{}'), 'marked',
  'M27a-T-14: una marca durante una sincronización en curso');
select pg_temp.finish(2, 2, 30);
select is((select count(*)::int from private.tn_insights_customer_segments(pg_temp.kid(2), 'ARS', pg_temp.c())
            where customer_id = '2014'), 0,
  'M27a-T-14: la sincronización concurrente filtra la supresión aún no borrada');

select pg_temp.start(1, 1, 3);
select pg_temp.finish(1, 1, 3);
update public.integration_connections set timezone = 'America/Sao_Paulo' where id = pg_temp.kid(1);
select results_eq(
  $$select (select count(*)::int from public.tn_customer_insights where connection_id = pg_temp.kid(1)),
           (select s.insights_rebuild_pending from public.tn_sync_status s where s.connection_id = pg_temp.kid(1))$$,
  $$values (0, true)$$, 'M27a-T-14: cambiar la zona invalida y pide relectura');

update public.integration_connections set status = 'disconnected', purge_requested_at = now()
 where id = pg_temp.kid(3);
select is((select count(*)::int from public.tn_customer_insights where connection_id = pg_temp.kid(3)), 0,
  'M27a-T-14: desconectar no deja payload');

select is(worker_api.tn_privacy_store_redact('777102', 5000), 'marked', 'M27a-T-14: store_redact marca la tienda');
select is((select count(*)::int from public.tn_customer_insights where connection_id = pg_temp.kid(2)), 0,
  'M27a-T-14: store_redact no deja payload');

select pg_temp.start(4, 4, 43);
select pg_temp.finish(4, 4, 43);
delete from public.companies where id = pg_temp.cid(4);
select is((select count(*)::int from public.tn_customer_insights where company_id = pg_temp.cid(4)), 0,
  'M27a-T-14: borrar la empresa no deja huérfanos');

select * from finish();
rollback;
