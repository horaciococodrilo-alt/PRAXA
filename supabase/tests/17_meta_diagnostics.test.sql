-- PRAXA — Diagnóstico de Meta Ads (M26a, 0022). Datos sintéticos.
--
-- Cubre M26a-T-02 (privilegios y RLS), T-03 (elegibilidad y su orden), T-06 (publicación
-- atómica e inmutable), T-07 (el plazo cuenta solo desde la publicación), T-12 (reglas de
-- cálculo), T-13 (resultado del objetivo y activity_status), T-14 (desgloses) y T-22
-- (informe retenido y oculto tras desconectar). La cascada desde companies está en 10.
--
-- Fechas: D = current_date - 1 (cerrado en UTC). Cada caso usa su propia ventana de 28 días:
--   actual D-27..D · previa D-55..D-28 · Z (cero) D-90..D-63 · E (vacía) D-125..D-98
--   N (sin cobertura) D-160..D-133 · P (parcial) D-195..D-168 · U (atribución desconocida)
--   D-230..D-203 · A2 (dos atribuciones) D-265..D-238 · M (monedas) D-300..D-273.

begin;
create extension if not exists pgtap with schema extensions;
select plan(127);

create function pg_temp.sqlstate_of(p_sql text) returns text language plpgsql as $f$
begin execute p_sql; return null;
exception when others then return sqlstate;
end $f$;

create function pg_temp.sqlstate_as(p_role text, p_sql text) returns text language plpgsql as $f$
begin
  execute format('set local role %I', p_role);
  execute p_sql;
  execute 'reset role';
  return null;
exception when others then return sqlstate;
end $f$;

-- Ejecuta p_sql (que devuelve un jsonb) como authenticated con los claims de p_user.
create function pg_temp.as_user(p_user uuid, p_sql text) returns jsonb language plpgsql as $f$
declare v_result jsonb;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub',p_user,'role','authenticated')::text,true);
  execute 'set local role authenticated';
  execute p_sql into v_result;
  execute 'reset role';
  perform set_config('request.jwt.claims',null,true);
  return v_result;
exception when others then
  execute 'reset role';
  perform set_config('request.jwt.claims',null,true);
  raise;
end $f$;

create function pg_temp.d() returns date language sql as $f$ select current_date - 1 $f$;

-- ---------------------------------------------------------------------------
-- Semilla: tres empresas. C1 activa con datos; C2 activa sin sincronización; C3 pendiente.
-- ---------------------------------------------------------------------------

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
select ('aaaaaaaa-0000-4000-8000-00000000017'||n)::uuid, '00000000-0000-0000-0000-000000000000',
       'authenticated','authenticated','diagnostico.'||n||'@praxa.test','x',now(),now(),now()
  from generate_series(1,3) n;
insert into public.companies (id,name,owner_id)
select ('c0a00000-0000-4000-8000-00000000017'||n)::uuid,'Diagnóstico sintético '||n,
       ('aaaaaaaa-0000-4000-8000-00000000017'||n)::uuid
  from generate_series(1,3) n;

select 1 from generate_series(1,3) n, lateral worker_api.create_pending_connection(
  ('aaaaaaaa-0000-4000-8000-00000000017'||n)::uuid,('c0a00000-0000-4000-8000-00000000017'||n)::uuid,
  ('cc000000-0000-4000-8000-00000000017'||n)::uuid,'negocio_sintetico','AAAA','AAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAA==',1,'system_user','app_sintetica','{ads_read}',null) x;
select 1 from generate_series(1,2) n, lateral worker_api.confirm_connection(
  ('aaaaaaaa-0000-4000-8000-00000000017'||n)::uuid,('c0a00000-0000-4000-8000-00000000017'||n)::uuid,
  ('cc000000-0000-4000-8000-00000000017'||n)::uuid,'act_9000017'||n,'USD','UTC',true) x;

select 1 from worker_api.start_sync_run(
  'aaaaaaaa-0000-4000-8000-000000000171','c0a00000-0000-4000-8000-000000000171',
  'cc000000-0000-4000-8000-000000000171',0,'e0000000-0000-4000-8000-000000000171',repeat('e',64),
  current_date-27,current_date,
  '{"lookbackDays":28,"maxWindowDays":28,"maxPagesPerLevel":1,"maxMetadataPages":1,"maxEntities":1,"maxPayloadBytes":100000,"maxDurationMs":1000,"finalizationReserveMs":1000,"leaseSeconds":2,"maxRetries":2,"retryDelayMs":500}');

insert into public.meta_insight_snapshots (id,company_id,connection_id,sync_run_id,level,fetched_at,
  window_from,window_to,currency,timezone,pages,validated_pages,complete,result,failure_reason,
  error_class,parameters,duration_ms,request_payload)
select ('5a000000-0000-4000-8000-0000000171'||lpad(v.n::text,2,'0'))::uuid,
  'c0a00000-0000-4000-8000-000000000171','cc000000-0000-4000-8000-000000000171',
  'e0000000-0000-4000-8000-000000000171',v.lvl,now(),current_date-320,current_date,'USD','UTC',
  1,1,true,'complete',null,null,'{}'::jsonb,1,'{}'::jsonb
  from (values (0,'account'),(1,'campaign'),(2,'adset'),(3,'ad')) v(n,lvl);

insert into public.meta_entities (entity_ref,company_id,connection_id,level,external_id,parent_ref) values
  ('ae000000-0000-4000-8000-000000000171','c0a00000-0000-4000-8000-000000000171',
   'cc000000-0000-4000-8000-000000000171','account','act_90000171',null);
insert into public.meta_entities (entity_ref,company_id,connection_id,level,external_id,parent_ref)
select ('ca000000-0000-4000-8000-00000000000'||n)::uuid,'c0a00000-0000-4000-8000-000000000171',
  'cc000000-0000-4000-8000-000000000171','campaign','k'||n,'ae000000-0000-4000-8000-000000000171'
  from generate_series(1,4) n;
insert into public.meta_entities (entity_ref,company_id,connection_id,level,external_id,parent_ref) values
  ('5e000000-0000-4000-8000-000000000001','c0a00000-0000-4000-8000-000000000171',
   'cc000000-0000-4000-8000-000000000171','adset','s1','ca000000-0000-4000-8000-000000000001');
insert into public.meta_entities (entity_ref,company_id,connection_id,level,external_id,parent_ref) values
  ('ad000000-0000-4000-8000-000000000001','c0a00000-0000-4000-8000-000000000171',
   'cc000000-0000-4000-8000-000000000171','ad','a1','5e000000-0000-4000-8000-000000000001');

create function pg_temp.unknown_attr() returns jsonb language sql as $f$
  select '{"known":false,"report_time":"impression","unified":true,"settings":[]}'::jsonb $f$;
create function pg_temp.attr(p_days int) returns jsonb language sql as $f$
  select jsonb_build_object('known',true,'report_time','impression','unified',true,'settings',
    jsonb_build_array(jsonb_build_object('adset_ref','x','windows',
      jsonb_build_array(jsonb_build_object('event_type','click','days',p_days))))) $f$;
create function pg_temp.ent(p_ref uuid, p_level text, p_parent uuid, p_name text,
  p_status text default 'ACTIVE') returns jsonb language sql as $f$
  select jsonb_build_object('entity_ref',p_ref,'level',p_level,'parent_ref',p_parent,'name',p_name,
    'effective_status',p_status,'objective',case when p_level='campaign' then 'OUTCOME_SALES' end,
    'metadata_fetched_at',to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'attribution',pg_temp.unknown_attr()) $f$;
-- La tasa informada por Meta (ctr) difiere a propósito de la recalculada (T-12 b).
create function pg_temp.r(p_ref uuid, p_spend text, p_imp text, p_clicks text, p_link text,
  p_actions jsonb default '[]'::jsonb, p_attr jsonb default null) returns jsonb language sql as $f$
  select jsonb_build_object('entity_ref',p_ref,'spend',p_spend,'impressions',p_imp,'reach','5',
    'clicks',p_clicks,'inline_link_clicks',p_link,'ctr','99.9','cpc','77','cpm','88',
    'frequency','1.5','actions',p_actions,'attribution',coalesce(p_attr,pg_temp.unknown_attr())) $f$;
-- Compras con su variante principal más otra variante y otro tipo que no deben sumarse.
create function pg_temp.buy(p_count text, p_value text) returns jsonb language sql as $f$
  select jsonb_build_array(
    jsonb_build_object('action_type','purchase','variant','value','count',p_count,'value',p_value),
    jsonb_build_object('action_type','purchase','variant','d1_view','count','50','value','500'),
    jsonb_build_object('action_type','lead','variant','value','count','3','value',null)) $f$;
create function pg_temp.cov(p_level text, p_day date, p_entities jsonb, p_rows jsonb,
  p_currency text default 'USD', p_partial boolean default false,
  p_conn uuid default 'cc000000-0000-4000-8000-000000000171') returns void language sql as $f$
  insert into public.meta_daily_coverage (connection_id,level,date,company_id,snapshot_id,fetched_at,
    captured_before_day_end,currency,timezone,entities,rows)
  select p_conn,p_level,p_day,s.company_id,s.id,now(),p_partial,p_currency,'UTC',p_entities,p_rows
    from public.meta_insight_snapshots s where s.connection_id = p_conn and s.level = p_level
  on conflict (connection_id,level,date) do update
    set entities = excluded.entities, rows = excluded.rows, currency = excluded.currency,
        captured_before_day_end = excluded.captured_before_day_end $f$;

create function pg_temp.acct_ent() returns jsonb language sql as $f$
  select jsonb_build_array(pg_temp.ent('ae000000-0000-4000-8000-000000000171','account',null,'Cuenta sintética',null)) $f$;
create function pg_temp.a() returns uuid language sql as $f$ select 'ae000000-0000-4000-8000-000000000171'::uuid $f$;

-- Nivel cuenta.
select pg_temp.cov('account',pg_temp.d()-i,pg_temp.acct_ent(),
  jsonb_build_array(pg_temp.r(pg_temp.a(),'10.50','1000','20','15',pg_temp.buy('2','30.00'))))
  from generate_series(0,27) i;
select pg_temp.cov('account',pg_temp.d()-i,pg_temp.acct_ent(),
  jsonb_build_array(pg_temp.r(pg_temp.a(),'5','500','10','5',pg_temp.buy('1','10'))))
  from generate_series(28,55) i;
select pg_temp.cov('account',pg_temp.d()-i,pg_temp.acct_ent(),
  case when i >= 71 then jsonb_build_array(pg_temp.r(pg_temp.a(),'0','0','0','0')) else '[]'::jsonb end)
  from generate_series(63,90) i;
select pg_temp.cov('account',pg_temp.d()-i,pg_temp.acct_ent(),'[]'::jsonb)
  from generate_series(98,125) i;
select pg_temp.cov('account',pg_temp.d()-i,pg_temp.acct_ent(),'[]'::jsonb)
  from generate_series(151,160) i;
select pg_temp.cov('account',pg_temp.d()-i,pg_temp.acct_ent(),
  jsonb_build_array(pg_temp.r(pg_temp.a(),'1','10','1','1')))
  from generate_series(182,195) i;
select pg_temp.cov('account',pg_temp.d()-i,pg_temp.acct_ent(),
  jsonb_build_array(pg_temp.r(pg_temp.a(),'1','10','1','1',pg_temp.buy('1','2'),
    case when i >= 217 then pg_temp.attr(7) else null end)))
  from generate_series(203,230) i;
select pg_temp.cov('account',pg_temp.d()-i,pg_temp.acct_ent(),
  jsonb_build_array(pg_temp.r(pg_temp.a(),'1','10','1','1',pg_temp.buy('1','2'),
    case when i >= 252 then pg_temp.attr(7) else pg_temp.attr(1) end)))
  from generate_series(238,265) i;
select pg_temp.cov('account',pg_temp.d()-i,pg_temp.acct_ent(),
  jsonb_build_array(pg_temp.r(pg_temp.a(),'1','10','1','1')),
  case when i >= 287 then 'EUR' else 'USD' end)
  from generate_series(273,300) i;

-- Campañas: K1 activa (cambia de nombre), K2 pausada con actividad, K3 sin fila, K4 en cero.
select pg_temp.cov('campaign',pg_temp.d()-i,jsonb_build_array(
    pg_temp.ent('ca000000-0000-4000-8000-000000000001','campaign','ae000000-0000-4000-8000-000000000171',
      case when i <= 13 then 'Campaña Uno' else 'Campaña vieja' end),
    pg_temp.ent('ca000000-0000-4000-8000-000000000002','campaign','ae000000-0000-4000-8000-000000000171','Campaña pausada','PAUSED'),
    pg_temp.ent('ca000000-0000-4000-8000-000000000003','campaign','ae000000-0000-4000-8000-000000000171','Campaña sin actividad'),
    pg_temp.ent('ca000000-0000-4000-8000-000000000004','campaign','ae000000-0000-4000-8000-000000000171','Campaña en cero')),
  jsonb_build_array(
    pg_temp.r('ca000000-0000-4000-8000-000000000001','3','300','6','4',pg_temp.buy('1','9')),
    pg_temp.r('ca000000-0000-4000-8000-000000000004','0','0','0','0'))
  || case when i <= 4 then jsonb_build_array(
    pg_temp.r('ca000000-0000-4000-8000-000000000002','1','100','1','1')) else '[]'::jsonb end)
  from generate_series(0,27) i;
select pg_temp.cov('campaign',pg_temp.d()-i,jsonb_build_array(
    pg_temp.ent('ca000000-0000-4000-8000-000000000001','campaign','ae000000-0000-4000-8000-000000000171','Campaña vieja')),
  jsonb_build_array(pg_temp.r('ca000000-0000-4000-8000-000000000001','2','200','4','2',pg_temp.buy('1','4'))))
  from generate_series(28,55) i;
-- Conjunto con el mismo nombre que K1 (lección de H-E1-231) y un anuncio.
select pg_temp.cov('adset',pg_temp.d()-i,jsonb_build_array(
    pg_temp.ent('5e000000-0000-4000-8000-000000000001','adset','ca000000-0000-4000-8000-000000000001','Campaña Uno')),
  jsonb_build_array(pg_temp.r('5e000000-0000-4000-8000-000000000001','2','200','2','2')))
  from generate_series(0,27) i;
select pg_temp.cov('ad',pg_temp.d()-i,jsonb_build_array(
    pg_temp.ent('ad000000-0000-4000-8000-000000000001','ad','5e000000-0000-4000-8000-000000000001','Anuncio uno')),
  jsonb_build_array(pg_temp.r('ad000000-0000-4000-8000-000000000001','1','50','1','1')))
  from generate_series(0,27) i;

-- Desgloses de cuenta: país y edad/género completos; región con días en EUR y último intento fallido.
insert into public.meta_breakdown_snapshots (id,company_id,connection_id,sync_run_id,level,dimension,
  fetched_at,window_from,window_to,currency,timezone,pages,duration_ms,request_hash)
select ('5b000000-0000-4000-8000-0000000171'||lpad(v.n::text,2,'0'))::uuid,
  'c0a00000-0000-4000-8000-000000000171','cc000000-0000-4000-8000-000000000171',
  'e0000000-0000-4000-8000-000000000171','account',v.dim,now(),current_date-60,current_date,'USD','UTC',
  1,1,repeat('a',64)
  from (values (0,'country'),(1,'region'),(2,'age_gender')) v(n,dim);
insert into public.meta_breakdown_coverage (connection_id,level,dimension,date,company_id,snapshot_id,
  fetched_at,captured_before_day_end,currency,timezone)
select s.connection_id,'account',s.dimension,pg_temp.d()-i,s.company_id,s.id,now(),false,
  case when s.dimension = 'region' and i >= 14 then 'EUR' else 'USD' end,'UTC'
  from public.meta_breakdown_snapshots s cross join generate_series(0,27) i
 where s.connection_id = 'cc000000-0000-4000-8000-000000000171';
insert into public.meta_breakdown_rows (snapshot_id,entity_ref,date,segment_primary,segment_secondary,
  company_id,connection_id,spend,impressions,clicks,inline_link_clicks,ctr,cpc,cpm,actions)
select s.id,pg_temp.a(),pg_temp.d()-i,v.p,v.s,s.company_id,s.connection_id,v.spend,v.imp,v.clicks,1,
  9,9,9,v.actions
  from public.meta_breakdown_snapshots s
  cross join generate_series(0,27) i
  join (values
    ('country','AR','',2::numeric,100::bigint,4::bigint,
      '[{"action_type":"purchase","variant":"value","count":"1","value":"5"}]'::jsonb),
    ('region','Buenos Aires','',1,10,1,'[]'::jsonb),
    ('age_gender','25-34','female',1,20,2,
      '[{"action_type":"purchase","variant":"value","count":"1","value":"5"}]'::jsonb)
  ) v(dim,p,s,spend,imp,clicks,actions) on v.dim = s.dimension
 where s.connection_id = 'cc000000-0000-4000-8000-000000000171';
insert into public.meta_breakdown_rows (snapshot_id,entity_ref,date,segment_primary,segment_secondary,
  company_id,connection_id,spend,impressions,clicks,inline_link_clicks,ctr,cpc,cpm,actions)
select s.id,pg_temp.a(),pg_temp.d()-i,'UY','',s.company_id,s.connection_id,1,10,1,1,null,null,null,'[]'::jsonb
  from public.meta_breakdown_snapshots s cross join generate_series(0,2) i
 where s.connection_id = 'cc000000-0000-4000-8000-000000000171' and s.dimension = 'country';
insert into public.meta_breakdown_status (connection_id,level,dimension,company_id,last_result,last_reason,last_attempt_at)
values ('cc000000-0000-4000-8000-000000000171','account','country','c0a00000-0000-4000-8000-000000000171','complete',null,now()),
       ('cc000000-0000-4000-8000-000000000171','account','age_gender','c0a00000-0000-4000-8000-000000000171','complete',null,now()),
       ('cc000000-0000-4000-8000-000000000171','account','region','c0a00000-0000-4000-8000-000000000171','failed','meta_error',now());

-- Resumen de la última sincronización, reemplazado a mano para recorrer cada estado (H-10).
create function pg_temp.summary(p_status text, p_finished timestamptz, p_lease timestamptz,
  p_account text default 'complete', p_conn uuid default 'cc000000-0000-4000-8000-000000000171')
returns void language sql as $f$
  update public.integration_connections c set meta_sync_summary = jsonb_build_object(
    'version',1,'credential_generation',c.credential_generation,
    'window_from',(pg_temp.d()-27)::text,'window_to',pg_temp.d()::text,'max_window_days',28,
    'started_at',private.meta_iso(now() - interval '2 days'),
    'lease_expires_at',private.meta_iso(p_lease),
    'finished_at',case when p_finished is null then null else private.meta_iso(p_finished) end,
    'status',p_status,
    'levels',jsonb_build_object(
      'account',case when p_account = 'complete' then jsonb_build_object('status','complete','reason','complete',
          'fetched_at',private.meta_iso(now() - interval '2 days'),'finished_at',private.meta_iso(now() - interval '2 days'))
        when p_account = 'pending' then '{"status":"pending","reason":null,"fetched_at":null,"finished_at":null}'::jsonb
        else jsonb_build_object('status','incomplete','reason','page_limit',
          'fetched_at',private.meta_iso(now() - interval '2 days'),'finished_at',private.meta_iso(now() - interval '2 days')) end,
      'campaign','{"status":"pending","reason":null,"fetched_at":null,"finished_at":null}'::jsonb,
      'adset','{"status":"pending","reason":null,"fetched_at":null,"finished_at":null}'::jsonb,
      'ad','{"status":"pending","reason":null,"fetched_at":null,"finished_at":null}'::jsonb))
   where c.id = p_conn $f$;

create function pg_temp.elig(p_user uuid default 'aaaaaaaa-0000-4000-8000-000000000171',
  p_conn uuid default 'cc000000-0000-4000-8000-000000000171') returns jsonb language sql as $f$
  select pg_temp.as_user(p_user, format(
    $q$select to_jsonb(e) from public.meta_diagnostic_eligibility(%L) e$q$, p_conn)) $f$;
create function pg_temp.reserve(p_req uuid, p_finished text default null, p_gen integer default 0,
  p_conn uuid default 'cc000000-0000-4000-8000-000000000171') returns text language sql as $f$
  select worker_api.reserve_diagnostic('aaaaaaaa-0000-4000-8000-000000000171',
    'c0a00000-0000-4000-8000-000000000171',p_req,p_conn,p_gen,
    coalesce(p_finished, (select meta_sync_summary->>'finished_at' from public.integration_connections
                          where id = p_conn))::timestamptz,300) $f$;
create function pg_temp.reservations() returns integer language sql as $f$
  select count(*)::int from private.meta_diagnostic_reservations
   where company_id = 'c0a00000-0000-4000-8000-000000000171' $f$;
create function pg_temp.report(p_req uuid, p_generated timestamptz,
  p_conn uuid default 'cc000000-0000-4000-8000-000000000171') returns void language sql as $f$
  insert into public.diagnostic_reports (company_id,connection_id,credential_generation,request_id,
    generated_at,window_from,window_to,prev_from,prev_to,sync_finished_at,schema_version,
    methodology_version,settings,evidence,output,web_sources,model_requested,model_reported,usage)
  values ('c0a00000-0000-4000-8000-000000000171',p_conn,0,p_req,p_generated,pg_temp.d()-27,pg_temp.d(),
    null,null,p_generated,1,'meta-diag-1','{"goal_kind":"purchase","metric_ref":"actions:purchase"}'::jsonb,
    '{"items":[],"totals":{},"manifest":{}}'::jsonb,'{}'::jsonb,'[]'::jsonb,'modelo_sintetico',
    'modelo_sintetico','{"calls":1,"batches":0,"steps":[]}'::jsonb) $f$;
create function pg_temp.payload(p_marker text default 'a') returns jsonb language sql as $f$
  select jsonb_build_object('schema_version',1,'methodology_version','meta-diag-1',
    'window',jsonb_build_object('from',(pg_temp.d()-27)::text,'to',pg_temp.d()::text,
      'prev_from',(pg_temp.d()-55)::text,'prev_to',(pg_temp.d()-28)::text),
    'settings',jsonb_build_object('goal_kind','purchase','metric_ref','actions:purchase'),
    'sync_finished_at',(select meta_sync_summary->>'finished_at' from public.integration_connections
                         where id = 'cc000000-0000-4000-8000-000000000171'),
    'evidence',jsonb_build_object('items','[]'::jsonb,'totals','{}'::jsonb,'manifest','{}'::jsonb),
    'output',jsonb_build_object('marker',p_marker),'web_sources','[]'::jsonb,
    'model_requested','modelo_sintetico','model_reported','modelo_sintetico',
    'usage',jsonb_build_object('calls',1,'batches',0,'steps','[]'::jsonb)) $f$;
create function pg_temp.publish(p_req uuid, p_payload jsonb, p_gen integer default 0) returns text
language sql as $f$
  select worker_api.publish_diagnostic('aaaaaaaa-0000-4000-8000-000000000171',
    'c0a00000-0000-4000-8000-000000000171',p_req,'cc000000-0000-4000-8000-000000000171',p_gen,p_payload) $f$;
create function pg_temp.current_report() returns text language sql as $f$
  select md5(r::text) from public.diagnostic_reports r
   where r.company_id = 'c0a00000-0000-4000-8000-000000000171' $f$;

-- ===========================================================================
-- T-02: tablas, RLS, privilegios y funciones
-- ===========================================================================

select results_eq(
  $$select n.nspname::text collate "default", c.relname::text collate "default",
           c.relrowsecurity, c.relforcerowsecurity
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where (n.nspname, c.relname) in (('public','diagnostic_settings'),('public','diagnostic_reports'),
                                      ('private','meta_diagnostic_reservations'))
     order by 1, 2$$,
  $$values ('private','meta_diagnostic_reservations',true,true),
           ('public','diagnostic_reports',true,true),('public','diagnostic_settings',true,true)$$,
  'T-02: las tres tablas existen con RLS habilitada y forzada');

create function pg_temp.diag_privileges(p_role text) returns table (table_name text, privilege text)
language sql as $fn$
  select t.name, p.name
    from unnest(array['public.diagnostic_settings','public.diagnostic_reports',
                      'private.meta_diagnostic_reservations']) as t(name)
   cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) as p(name)
   where has_table_privilege(p_role, t.name, p.name)
   order by 1, 2
$fn$;
select results_eq($$select * from pg_temp.diag_privileges('authenticated')$$,
  $$values ('public.diagnostic_reports','SELECT'),('public.diagnostic_settings','SELECT')$$,
  'T-02: authenticated solo tiene SELECT sobre objetivo e informe');
select is_empty($$select * from pg_temp.diag_privileges('anon')$$,
  'T-02: anon no tiene privilegios sobre las tablas del diagnóstico');
select is_empty($$select * from pg_temp.diag_privileges('service_role')$$,
  'T-02: service_role no tiene privilegios sobre las tablas del diagnóstico');
select is_empty($$select * from pg_temp.diag_privileges('praxa_integrations')$$,
  'T-02: el rol de C no tiene grants directos sobre las tablas del diagnóstico');

select results_eq(
  $$select p.tablename::text collate "default", p.cmd::text, p.roles::text[] collate "default"
      from pg_policies p
     where (p.schemaname, p.tablename) in (('public','diagnostic_settings'),('public','diagnostic_reports'),
                                           ('private','meta_diagnostic_reservations'))
     order by 1$$,
  $$values ('diagnostic_reports','SELECT',array['authenticated']),
           ('diagnostic_settings','SELECT',array['authenticated'])$$,
  'T-02: una política SELECT por tabla pública y ninguna en reservas');

select results_eq(
  $$select c.conrelid::regclass::text collate "default", c.confrelid::regclass::text collate "default",
           c.confdeltype::text
      from pg_constraint c
     where c.contype = 'f' and c.conrelid in ('public.diagnostic_settings'::regclass,
       'public.diagnostic_reports'::regclass,'private.meta_diagnostic_reservations'::regclass)
     order by 1, 2$$,
  $$values ('diagnostic_reports','companies','c'),('diagnostic_settings','companies','c'),
           ('private.meta_diagnostic_reservations','companies','c')$$,
  'T-02/T-22: las tres tablas solo referencian companies, en cascada (el informe no tiene FK a la conexión)');

select has_function('worker_api','save_diagnostic_settings',array['uuid','uuid','text','text'],
  'T-02: save_diagnostic_settings existe');
select has_function('worker_api','reserve_diagnostic',
  array['uuid','uuid','uuid','uuid','integer','timestamp with time zone','integer'],
  'T-02: reserve_diagnostic existe');
select has_function('worker_api','release_diagnostic',array['uuid','uuid','uuid'],
  'T-02: release_diagnostic existe');
select has_function('worker_api','publish_diagnostic',array['uuid','uuid','uuid','uuid','integer','jsonb'],
  'T-02: publish_diagnostic existe');

select results_eq(
  $$select p.proname::text collate "default", p.prosecdef, p.proconfig = array['search_path=""']
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname like 'meta\_diagnostic\_%'
     order by 1$$,
  $$values ('meta_diagnostic_account_metrics',false,true),('meta_diagnostic_action_types',false,true),
           ('meta_diagnostic_breakdown_metrics',false,true),('meta_diagnostic_eligibility',false,true),
           ('meta_diagnostic_entity_metrics',false,true)$$,
  'T-02: las cinco lecturas públicas existen, son INVOKER y fijan search_path vacío');
select is_empty(
  $$select p.proname, r.name from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     cross join unnest(array['anon','praxa_integrations','service_role']) as r(name)
     where n.nspname = 'public' and p.proname like 'meta\_diagnostic\_%'
       and has_function_privilege(r.name, p.oid, 'EXECUTE')$$,
  'T-02: anon, el rol de C y service_role no ejecutan las lecturas');
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'meta\_diagnostic\_%'
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')),
  5, 'T-02: authenticated ejecuta las cinco lecturas');

select results_eq(
  $$select p.prosecdef, has_function_privilege('authenticated', p.oid, 'EXECUTE'),
           has_function_privilege('anon', p.oid, 'EXECUTE'),
           has_function_privilege('service_role', p.oid, 'EXECUTE'),
           has_function_privilege('praxa_integrations', p.oid, 'EXECUTE')
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private' and p.proname = 'meta_diagnostic_eligibility_core'$$,
  $$values (false, true, false, false, false)$$,
  'T-02: la elegibilidad privada es INVOKER y solo authenticated la ejecuta');

select is(pg_temp.sqlstate_as('anon',$$select 1 from public.diagnostic_reports$$),'42501',
  'T-02: anon no lee informes');
select is(pg_temp.sqlstate_as('anon',$$select 1 from public.diagnostic_settings$$),'42501',
  'T-02: anon no lee objetivos');
select is(pg_temp.sqlstate_as('authenticated',
  $$insert into public.diagnostic_settings (company_id,goal_kind,metric_ref,updated_by)
    values ('c0a00000-0000-4000-8000-000000000171','traffic','inline_link_clicks',
            'aaaaaaaa-0000-4000-8000-000000000171')$$),'42501',
  'T-02: authenticated no inserta objetivos directamente');
select is(pg_temp.sqlstate_as('authenticated',
  $$delete from public.diagnostic_reports$$),'42501',
  'T-02: authenticated no borra informes');
select is(pg_temp.sqlstate_as('anon',
  $$select * from public.meta_diagnostic_eligibility('cc000000-0000-4000-8000-000000000171')$$),'42501',
  'T-02: anon no ejecuta la elegibilidad');

-- ===========================================================================
-- Objetivo (C-01)
-- ===========================================================================

select is(worker_api.save_diagnostic_settings('aaaaaaaa-0000-4000-8000-000000000172',
  'c0a00000-0000-4000-8000-000000000172','traffic','inline_link_clicks'),'saved',
  'C-01: traffic con clics al enlace se guarda');
select is(pg_temp.sqlstate_of($$select worker_api.save_diagnostic_settings(
  'aaaaaaaa-0000-4000-8000-000000000172','c0a00000-0000-4000-8000-000000000172',
  'traffic','actions:purchase')$$),'22023','C-01: traffic con una acción se rechaza');
select is(pg_temp.sqlstate_of($$select worker_api.save_diagnostic_settings(
  'aaaaaaaa-0000-4000-8000-000000000172','c0a00000-0000-4000-8000-000000000172',
  'purchase','inline_link_clicks')$$),'22023','C-01: purchase sin acción se rechaza');
select is(pg_temp.sqlstate_of($$select worker_api.save_diagnostic_settings(
  'aaaaaaaa-0000-4000-8000-000000000172','c0a00000-0000-4000-8000-000000000172',
  'ventas','actions:purchase')$$),'22023','C-01: objetivo fuera de lista se rechaza');
select is(pg_temp.sqlstate_of($$select worker_api.save_diagnostic_settings(
  'aaaaaaaa-0000-4000-8000-000000000172','c0a00000-0000-4000-8000-000000000172',
  'purchase','actions:compra con espacio')$$),'22023','C-01: tipo de acción con forma inválida se rechaza');
select is(pg_temp.sqlstate_of($$select worker_api.save_diagnostic_settings(
  'aaaaaaaa-0000-4000-8000-000000000171','c0a00000-0000-4000-8000-000000000172',
  'traffic','inline_link_clicks')$$),'PX001','C-01/C-15: un actor ajeno no cambia el objetivo de otra empresa');
select is(pg_temp.as_user('aaaaaaaa-0000-4000-8000-000000000171',
  $$select count(*)::text::jsonb from public.diagnostic_settings$$),'0'::jsonb,
  'C-01/C-15: otro tenant no lee el objetivo ajeno');

-- ===========================================================================
-- T-03: elegibilidad, en el orden definido y con el reloj de la base
-- ===========================================================================

select is(pg_temp.elig()->>'reason','no_settings','T-03: 1 sin objetivo, no_settings');
select is(pg_temp.reserve('d1a00000-0000-4000-8000-000000000001',
  private.meta_iso(now())),'no_settings','T-03: la reserva devuelve no_settings');
select is(worker_api.save_diagnostic_settings('aaaaaaaa-0000-4000-8000-000000000171',
  'c0a00000-0000-4000-8000-000000000171','purchase','actions:purchase'),'saved',
  'C-01: el objetivo de compras se guarda');
select is(worker_api.save_diagnostic_settings('aaaaaaaa-0000-4000-8000-000000000171',
  'c0a00000-0000-4000-8000-000000000171','purchase','actions:purchase'),'saved',
  'C-01: repetir la misma llamada da el mismo resultado (idempotente)');
select is((select count(*)::int from public.diagnostic_settings
  where company_id = 'c0a00000-0000-4000-8000-000000000171'),1,'C-01: una sola fila por empresa');

select 1 from worker_api.save_diagnostic_settings('aaaaaaaa-0000-4000-8000-000000000173',
  'c0a00000-0000-4000-8000-000000000173','traffic','inline_link_clicks');
select is(pg_temp.elig('aaaaaaaa-0000-4000-8000-000000000173','cc000000-0000-4000-8000-000000000173')->>'reason',
  'connection_not_active','T-03: 2 conexión pendiente, connection_not_active');
select is(pg_temp.elig('aaaaaaaa-0000-4000-8000-000000000172','cc000000-0000-4000-8000-000000000172')->>'reason',
  'sync_missing','T-03: 3 sin resumen de sincronización, sync_missing');
select is(pg_temp.elig('aaaaaaaa-0000-4000-8000-000000000172','cc000000-0000-4000-8000-000000000171')->>'reason',
  'connection_not_active','T-03/C-15: la conexión de otro tenant no es visible');

select pg_temp.summary('running',null,now() + interval '5 minutes','pending');
select is(pg_temp.elig()->>'reason','sync_running','T-03: 4 sincronización en curso con lease vigente');
select is(pg_temp.reserve('d1a00000-0000-4000-8000-000000000001',private.meta_iso(now())),'sync_running',
  'T-03: la reserva devuelve sync_running antes de comparar finished_at');
select pg_temp.summary('running',null,now() - interval '1 minute','pending');
select is(pg_temp.elig()->>'reason','sync_not_usable','T-03: 5 running con lease vencido');
select pg_temp.summary('failed',now() - interval '1 hour',now() - interval '1 hour','complete');
select is(pg_temp.elig()->>'reason','sync_not_usable','T-03: 5 último intento failed');
select is(pg_temp.reserve('d1a00000-0000-4000-8000-000000000001'),'sync_not_usable',
  'T-03: la reserva devuelve sync_not_usable');
select pg_temp.summary('partial',now() - interval '1 hour',now() - interval '1 hour','incomplete');
select is(pg_temp.elig()->>'reason','sync_not_usable','T-03: 5 partial con nivel cuenta incompleto');
select pg_temp.summary('partial',now() - interval '1 hour',now() - interval '1 hour','complete');
select is(pg_temp.elig()->>'eligible','true','T-03: partial con nivel cuenta completo habilita');
select pg_temp.summary('completed',now() - interval '25 hours',now() - interval '25 hours');
select is(pg_temp.elig()->>'reason','sync_stale','T-03: 6 sincronización de hace más de 24 h');
select is(pg_temp.reserve('d1a00000-0000-4000-8000-000000000001'),'sync_stale',
  'T-03: la reserva devuelve sync_stale');
select is(pg_temp.reservations(),0,'T-03/T-04: ningún motivo deja fila de reserva');

select pg_temp.summary('completed',now() - interval '2 hours',now() - interval '2 hours');
select pg_temp.report('d1a00000-0000-4000-8000-0000000000a1',now() - interval '1 hour');
select is(pg_temp.elig()->>'reason','sync_not_after_report','T-03: 7 sincronización no posterior al informe');
select pg_temp.summary('completed',now() - interval '30 minutes',now() - interval '30 minutes');
select is(pg_temp.elig()->>'reason','too_soon','T-03: 8 no pasaron 24 h desde el informe');
select is((pg_temp.elig()->>'available_at')::timestamptz,
  (select generated_at + interval '24 hours' from public.diagnostic_reports
    where request_id = 'd1a00000-0000-4000-8000-0000000000a1'),
  'T-03: available_at es generated_at + 24 h, calculado por la base');
select is(pg_temp.reserve('d1a00000-0000-4000-8000-000000000001'),'too_soon',
  'T-03: la reserva devuelve too_soon');

-- T-07: un informe de otra conexión (oculto) no bloquea.
update public.diagnostic_reports set connection_id = 'cc000000-0000-4000-8000-0000000001ff'
 where request_id = 'd1a00000-0000-4000-8000-0000000000a1';
select is(pg_temp.elig()->>'eligible','true','T-07: un informe de otra conexión no bloquea');
update public.diagnostic_reports set connection_id = 'cc000000-0000-4000-8000-000000000171',
  generated_at = now() - interval '25 hours'
 where request_id = 'd1a00000-0000-4000-8000-0000000000a1';
select is(pg_temp.elig()->>'eligible','true','T-03: informe de hace 25 h y sincronización posterior habilita');
select is(pg_temp.elig()->>'window_to',pg_temp.d()::text,'T-03: window_to sale del resumen');
select is(pg_temp.elig()->>'sync_finished_at',
  (select meta_sync_summary->>'finished_at' from public.integration_connections
    where id = 'cc000000-0000-4000-8000-000000000171'),
  'T-03: sync_finished_at viaja como texto ISO con microsegundos');

-- ===========================================================================
-- T-05 (base) y T-06: reserva, concurrencia y publicación atómica
-- ===========================================================================

select is(pg_temp.reserve('d1a00000-0000-4000-8000-000000000001',
  private.meta_iso(now() - interval '3 hours')),'sync_changed',
  'T-05: finished_at distinto del leído da sync_changed');
select is(pg_temp.reservations(),0,'T-05: sync_changed no deja reserva');
select is(pg_temp.reserve('d1a00000-0000-4000-8000-000000000001',null,1),'connection_changed',
  'T-05: generación distinta da connection_changed');
select is(pg_temp.reservations(),0,'T-05: connection_changed no deja reserva');
select is(pg_temp.reserve('d1a00000-0000-4000-8000-000000000001'),'reserved',
  'T-05: el mismo finished_at reenviado como texto ISO reserva');
select is(pg_temp.reserve('d1a00000-0000-4000-8000-000000000001'),'already_reserved',
  'T-05: reintento con el mismo request_id, already_reserved');
select is(pg_temp.reserve('d1a00000-0000-4000-8000-000000000002'),'in_progress',
  'T-05: otro request_id con reserva vigente, in_progress');
select is(pg_temp.reservations(),1,'T-05: una sola reserva por empresa');

-- T-07: liberar no cambia la elegibilidad ni consume plazo.
select is(worker_api.release_diagnostic('aaaaaaaa-0000-4000-8000-000000000171',
  'c0a00000-0000-4000-8000-000000000171','d1a00000-0000-4000-8000-000000000001'),true,
  'T-07: release borra la reserva propia');
select is(worker_api.release_diagnostic('aaaaaaaa-0000-4000-8000-000000000171',
  'c0a00000-0000-4000-8000-000000000171','d1a00000-0000-4000-8000-000000000001'),false,
  'T-07: release repetido es idempotente');
select is(pg_temp.elig()->>'eligible','true','T-07: tras liberar sigue elegible (no consume plazo)');

select is(pg_temp.reserve('d1a00000-0000-4000-8000-000000000002'),'reserved','T-06: nueva reserva');
update private.meta_diagnostic_reservations set started_at = now() - interval '10 minutes', expires_at = now() - interval '1 second'
 where company_id = 'c0a00000-0000-4000-8000-000000000171';
select is(pg_temp.publish('d1a00000-0000-4000-8000-000000000002',pg_temp.payload()),'reservation_lost',
  'T-06: publicar con la reserva vencida se rechaza');
select is(pg_temp.reserve('d1a00000-0000-4000-8000-000000000003'),'reserved',
  'T-06: una reserva vencida se reemplaza');
select is((select request_id from private.meta_diagnostic_reservations
  where company_id = 'c0a00000-0000-4000-8000-000000000171'),
  'd1a00000-0000-4000-8000-000000000003'::uuid,'T-06: la reserva nueva reemplazó a la vencida');

create temp table before_publish as select pg_temp.current_report() as md5;
select is(pg_temp.sqlstate_of($$select pg_temp.publish('d1a00000-0000-4000-8000-000000000003',
  pg_temp.payload() - 'usage')$$),'22023','T-06: forma persistida con claves faltantes se rechaza');
select is(pg_temp.sqlstate_of($$select pg_temp.publish('d1a00000-0000-4000-8000-000000000003',
  pg_temp.payload() || '{"extra":1}'::jsonb)$$),'22023','T-06: clave extra se rechaza');
select is(pg_temp.sqlstate_of($$select pg_temp.publish('d1a00000-0000-4000-8000-000000000003',
  jsonb_set(pg_temp.payload(),'{output}',jsonb_build_object('x',repeat('a',1100000))))$$),'22023',
  'T-06: un informe de más de 1 MB se rechaza');
select is(pg_temp.sqlstate_of($$select pg_temp.publish('d1a00000-0000-4000-8000-000000000003',
  jsonb_set(pg_temp.payload(),'{window,to}',to_jsonb((pg_temp.d()-1)::text)))$$),'22023',
  'T-06: una ventana distinta de la del resumen se rechaza');
-- Error forzado en la inserción, después del borrado: request_id ya usado por otra empresa.
insert into public.diagnostic_reports (company_id,connection_id,credential_generation,request_id,
  generated_at,window_from,window_to,sync_finished_at,schema_version,methodology_version,settings,
  evidence,output,web_sources,model_requested,model_reported,usage)
values ('c0a00000-0000-4000-8000-000000000172','cc000000-0000-4000-8000-000000000172',0,
  'd1a00000-0000-4000-8000-0000000000b2',now(),pg_temp.d()-27,pg_temp.d(),now(),1,'meta-diag-1',
  '{"goal_kind":"traffic","metric_ref":"inline_link_clicks"}','{"items":[],"totals":{},"manifest":{}}',
  '{}','[]','modelo_sintetico','modelo_sintetico','{"calls":1,"batches":0,"steps":[]}');
update private.meta_diagnostic_reservations set request_id = 'd1a00000-0000-4000-8000-0000000000b2'
 where company_id = 'c0a00000-0000-4000-8000-000000000171';
select isnt(pg_temp.sqlstate_of($$select pg_temp.publish('d1a00000-0000-4000-8000-0000000000b2',
  pg_temp.payload())$$),null,'T-06: un error en la inserción aborta la publicación');
update private.meta_diagnostic_reservations set request_id = 'd1a00000-0000-4000-8000-000000000003'
 where company_id = 'c0a00000-0000-4000-8000-000000000171';
select is(pg_temp.current_report(),(select md5 from before_publish),
  'T-06: tras cada fallo el informe anterior queda byte a byte');

-- Cambio de generación y de sincronización entre reserva y publicación.
update public.integration_connections set credential_generation = credential_generation + 1
 where id = 'cc000000-0000-4000-8000-000000000171';
select is(pg_temp.publish('d1a00000-0000-4000-8000-000000000003',pg_temp.payload()),'connection_changed',
  'T-06/T-23: cambio de generación entre reserva y publicación, connection_changed');
update public.integration_connections set credential_generation = credential_generation - 1
 where id = 'cc000000-0000-4000-8000-000000000171';
create temp table saved_summary as select meta_sync_summary from public.integration_connections
 where id = 'cc000000-0000-4000-8000-000000000171';
select pg_temp.summary('completed',now() - interval '10 minutes',now() - interval '10 minutes');
select is(pg_temp.publish('d1a00000-0000-4000-8000-000000000003',pg_temp.payload()),'sync_changed',
  'T-06: una sincronización que termina entre reserva y publicación, sync_changed');
select is(pg_temp.current_report(),(select md5 from before_publish),
  'T-06: con sync_changed el informe anterior queda intacto');
update public.integration_connections set meta_sync_summary = (select meta_sync_summary from saved_summary)
 where id = 'cc000000-0000-4000-8000-000000000171';

select is(pg_temp.publish('d1a00000-0000-4000-8000-000000000003',pg_temp.payload('nuevo')),'published',
  'T-06: la publicación válida reemplaza al anterior');
select is((select count(*)::int from public.diagnostic_reports
  where company_id = 'c0a00000-0000-4000-8000-000000000171'),1,'T-06: queda un solo informe');
select is((select output->>'marker' from public.diagnostic_reports
  where company_id = 'c0a00000-0000-4000-8000-000000000171'),'nuevo','T-06: el vigente es el nuevo');
select is(pg_temp.reservations(),0,'T-06: la publicación borra la reserva');
select is(pg_temp.publish('d1a00000-0000-4000-8000-000000000003',pg_temp.payload('otro')),
  'already_published','T-06: reintento con el mismo request_id, already_published');
select is((select output->>'marker' from public.diagnostic_reports
  where company_id = 'c0a00000-0000-4000-8000-000000000171'),'nuevo',
  'T-06: el reintento no cambia el informe');
select is(pg_temp.elig()->>'reason','sync_not_after_report',
  'T-07: el plazo y la sincronización cuentan desde la publicación');

-- Inmutabilidad: una sincronización nueva no cambia el informe publicado.
create temp table published as select evidence::text as e, output::text as o
  from public.diagnostic_reports where company_id = 'c0a00000-0000-4000-8000-000000000171';
select pg_temp.cov('account',pg_temp.d()-i,pg_temp.acct_ent(),
  jsonb_build_array(pg_temp.r(pg_temp.a(),'999','1','1','1')))
  from generate_series(0,1) i;
select is((select evidence::text || output::text from public.diagnostic_reports
  where company_id = 'c0a00000-0000-4000-8000-000000000171'),(select e || o from published),
  'T-06: el informe publicado no cambia con una lectura posterior');
select pg_temp.cov('account',pg_temp.d()-i,pg_temp.acct_ent(),
  jsonb_build_array(pg_temp.r(pg_temp.a(),'10.50','1000','20','15',pg_temp.buy('2','30.00'))))
  from generate_series(0,1) i;

select is(pg_temp.as_user('aaaaaaaa-0000-4000-8000-000000000171',
  $$select count(*)::text::jsonb from public.diagnostic_reports$$),'1'::jsonb,
  'C-15: el dueño ve su informe');
select is(pg_temp.as_user('aaaaaaaa-0000-4000-8000-000000000172',
  $$select count(*)::text::jsonb from public.diagnostic_reports
     where company_id = 'c0a00000-0000-4000-8000-000000000171'$$),'0'::jsonb,
  'C-15: otro tenant no ve el informe ajeno');

-- ===========================================================================
-- T-12 y T-13: cifras de cuenta
-- ===========================================================================

create function pg_temp.acct(p_from date, p_to date, p_prev_from date default null,
  p_prev_to date default null, p_metric text default 'actions:purchase') returns jsonb
language sql as $f$
  select pg_temp.as_user('aaaaaaaa-0000-4000-8000-000000000171', format(
    $q$select jsonb_object_agg(m.period, to_jsonb(m)) from public.meta_diagnostic_account_metrics(
      'cc000000-0000-4000-8000-000000000171',%L,%L,%L,%L,%L) m$q$,
    p_from,p_to,p_prev_from,p_prev_to,p_metric)) $f$;
create temp table cur as select pg_temp.acct(pg_temp.d()-27,pg_temp.d(),pg_temp.d()-55,pg_temp.d()-28) as j;

select results_eq(
  $$select j#>>'{current,spend}', j#>>'{current,impressions}', j#>>'{current,clicks}',
           j#>>'{current,link_clicks}', j#>>'{current,result_count}', j#>>'{current,result_value}'
      from cur$$,
  $$values ('294.00','28000','560','420','56','840.00')$$,
  'T-12/T-13: totales aditivos del nivel cuenta; solo cuenta purchase con variant value');
select results_eq(
  $$select j#>>'{current,ctr}', j#>>'{current,cpc}', j#>>'{current,cpm}',
           j#>>'{current,cost_per_result}', j#>>'{current,attributed_return}' from cur$$,
  $$values ('2.000000','0.525000','10.500000','5.250000','2.857143')$$,
  'T-12: tasas, costo por resultado y retorno recalculados desde las bases (no la tasa informada)');
select results_eq(
  $$select j#>>'{previous,spend}', j#>>'{previous,result_count}', j#>>'{previous,result_value}',
           j#>>'{current,currency}', j#>>'{current,attribution}', j#>>'{current,activity_status}'
      from cur$$,
  $$values ('140','28','280','USD','unknown','active')$$,
  'T-12: la ventana previa se calcula aparte; moneda y atribución de la ventana actual');
select results_eq(
  $$select (j#>>'{current,days_with_data}')::int, (j#>>'{current,days_no_row}')::int,
           (j#>>'{current,days_not_observed}')::int, (j#>>'{current,days_open}')::int,
           (j#>>'{current,days_partial}')::int from cur$$,
  $$values (28,0,0,0,0)$$,
  'T-12: cobertura completa de la ventana actual');
select ok((select (j->'current') ? 'fetched_at_min' and (j->'current') ? 'fetched_at_max' from cur),
  'T-12: la fila trae fetched_at mínimo y máximo para la procedencia');
select ok((select not ((j->'current') ? 'reach') and not ((j->'current') ? 'frequency') from cur),
  'T-12: reach y frequency no se agregan');

select results_eq(
  $$select pg_temp.acct(pg_temp.d()-27,pg_temp.d(),null,null,'inline_link_clicks')
     #>> '{current,result_count}',
           pg_temp.acct(pg_temp.d()-27,pg_temp.d(),null,null,'inline_link_clicks')
     #>> '{current,result_value}',
           pg_temp.acct(pg_temp.d()-27,pg_temp.d(),null,null,'inline_link_clicks')
     #>> '{current,attributed_return}',
           pg_temp.acct(pg_temp.d()-27,pg_temp.d(),null,null,'inline_link_clicks')
     #>> '{current,cost_per_result}'$$,
  $$values ('420', null::text, null::text, '0.700000')$$,
  'T-13: traffic usa clics al enlace y no calcula retorno');
select is((select count(*)::int from jsonb_object_keys(pg_temp.acct(pg_temp.d()-27,pg_temp.d()))),1,
  'T-12: sin ventana previa solo hay fila actual');

select results_eq(
  $$select x#>>'{current,activity_status}', x#>>'{current,spend}', x#>>'{current,ctr}',
           x#>>'{current,cpc}', x#>>'{current,cpm}', (x#>>'{current,days_no_row}')::int
      from (select pg_temp.acct(pg_temp.d()-90,pg_temp.d()-63) x) s$$,
  $$values ('zero','0',null::text,null::text,null::text,8)$$,
  'T-13: cero medido y días sin fila es zero; denominador cero no es calculable');
select results_eq(
  $$select x#>>'{current,activity_status}', (x#>>'{current,days_no_row}')::int, x#>>'{current,spend}'
      from (select pg_temp.acct(pg_temp.d()-125,pg_temp.d()-98) x) s$$,
  $$values ('zero',28,null::text)$$,
  'T-13: una ventana entera de días cubiertos sin fila (H-E1-185) es zero, sin inventar un cero');
select results_eq(
  $$select x#>>'{current,activity_status}', (x#>>'{current,days_not_observed}')::int
      from (select pg_temp.acct(pg_temp.d()-160,pg_temp.d()-133) x) s$$,
  $$values ('no_coverage',18)$$,
  'T-13: días no observados sin actividad en los cubiertos es no_coverage, no cero');
select results_eq(
  $$select x#>>'{current,activity_status}', (x#>>'{current,days_not_observed}')::int, x#>>'{current,spend}'
      from (select pg_temp.acct(pg_temp.d()-195,pg_temp.d()-168) x) s$$,
  $$values ('active',14,'14')$$,
  'T-13: cobertura parcial con actividad es active');
select results_eq(
  $$select x#>>'{current,attribution}', x#>>'{current,result_count}'
      from (select pg_temp.acct(pg_temp.d()-230,pg_temp.d()-203) x) s$$,
  $$values ('unknown','28')$$,
  'T-12: una atribución desconocida se suma y queda rotulada unknown');
select results_eq(
  $$select x#>>'{current,attribution}', x#>>'{current,result_count}', x#>>'{current,cost_per_result}',
           x#>>'{current,attributed_return}', x#>>'{current,spend}'
      from (select pg_temp.acct(pg_temp.d()-265,pg_temp.d()-238) x) s$$,
  $$values ('mixed',null::text,null::text,null::text,'28')$$,
  'T-12: dos atribuciones conocidas distintas no se mezclan');
select results_eq(
  $$select x#>>'{current,currency}', x#>>'{current,spend}', x#>>'{current,cpc}', x#>>'{current,cpm}',
           x#>>'{current,ctr}'
      from (select pg_temp.acct(pg_temp.d()-300,pg_temp.d()-273) x) s$$,
  $$values ('mixed',null::text,null::text,null::text,'10.000000')$$,
  'T-12: moneda mixta deja el dinero no calculable; la tasa sin dinero sí se calcula');

select pg_temp.cov('account',current_date,pg_temp.acct_ent(),
  jsonb_build_array(pg_temp.r(pg_temp.a(),'1','1','1','1')),'USD',true);
select results_eq(
  $$select (x#>>'{current,days_open}')::int, (x#>>'{current,days_partial}')::int,
           x#>'{current,open_dates}' = to_jsonb(array[current_date])
      from (select pg_temp.acct(current_date-27,current_date) x) s$$,
  $$values (1,1,true)$$,
  'C-06: el día abierto y la captura parcial se cuentan y se listan');
delete from public.meta_daily_coverage where connection_id = 'cc000000-0000-4000-8000-000000000171'
  and level = 'account' and date = current_date;

select is(pg_temp.sqlstate_of($$select * from public.meta_diagnostic_account_metrics(
  'cc000000-0000-4000-8000-000000000171',current_date-28,current_date,null,null,'actions:purchase')$$),
  '22023','C-06: una ventana de 29 días se rechaza');
select is(pg_temp.sqlstate_of($$select * from public.meta_diagnostic_account_metrics(
  'cc000000-0000-4000-8000-000000000171',current_date-27,current_date,null,null,'reach')$$),
  '22023','T-12: una métrica fuera de la lista se rechaza');

select is(pg_temp.as_user('aaaaaaaa-0000-4000-8000-000000000172', format(
  $q$select coalesce(jsonb_agg(m),'[]') from public.meta_diagnostic_account_metrics(
    'cc000000-0000-4000-8000-000000000171',%L,%L,null,null,'actions:purchase') m
    where m.days_with_data > 0$q$, pg_temp.d()-27, pg_temp.d())),'[]'::jsonb,
  'C-15: otro tenant no lee cifras ajenas');

select results_eq(
  $$select x->>'action_type', (x->>'observed_days')::int, x->>'total_count'
      from jsonb_array_elements(pg_temp.as_user('aaaaaaaa-0000-4000-8000-000000000171', format(
        $q$select jsonb_agg(t order by t.action_type) from public.meta_diagnostic_action_types(
          'cc000000-0000-4000-8000-000000000171',%L,%L) t$q$, pg_temp.d()-27, pg_temp.d()))) x$$,
  $$values ('lead',28,'84'),('purchase',28,'56')$$,
  'C-01: catálogo observado del nivel cuenta, solo variant value');

-- ===========================================================================
-- Entidades (C-05, T-12 a)
-- ===========================================================================

create function pg_temp.ents(p_level text, p_after_spend text default null, p_after_ref uuid default null,
  p_limit integer default 200, p_prev boolean default true) returns jsonb language sql as $f$
  select pg_temp.as_user('aaaaaaaa-0000-4000-8000-000000000171', format(
    $q$select coalesce(jsonb_agg(to_jsonb(m)),'[]') from public.meta_diagnostic_entity_metrics(
      'cc000000-0000-4000-8000-000000000171',%L,%L,%L,%L,%L,'actions:purchase',%L,%L,%L) m$q$,
    p_level,pg_temp.d()-27,pg_temp.d(),
    case when p_prev then pg_temp.d()-55 end, case when p_prev then pg_temp.d()-28 end,
    p_after_spend,p_after_ref,p_limit)) $f$;
create temp table camp as select pg_temp.ents('campaign') as j;

select results_eq(
  $$select x->>'name', x->>'effective_status', x->>'cur_spend' from camp, jsonb_array_elements(j) x$$,
  $$values ('Campaña Uno','ACTIVE','84'),('Campaña pausada','PAUSED','5')$$,
  'C-05: entra la pausada con actividad, salen la sin fila y la en cero; nombre de la captura más reciente');
select results_eq(
  $$select x->>'cur_impressions', x->>'cur_clicks', x->>'cur_result_count', x->>'cur_result_value',
           x->>'cur_ctr', x->>'cur_cost_per_result', x->>'cur_attributed_return'
      from camp, jsonb_array_elements(j) x where x->>'name' = 'Campaña Uno'$$,
  $$values ('8400','168','28','252','2.000000','3.000000','3.000000')$$,
  'T-12: cifras actuales de la entidad desde las bases');
select results_eq(
  $$select x->>'prev_spend', x->>'var_spend', x->>'var_ctr', x->>'var_cost_per_result',
           x->>'var_attributed_return', (x->>'days_with_row')::int
      from camp, jsonb_array_elements(j) x where x->>'name' = 'Campaña Uno'$$,
  $$values ('56','50.000000','0.000000','50.000000','50.000000',28)$$,
  'T-12: variaciones porcentuales calculadas en SQL');
select results_eq(
  $$select x->>'cur_result_count', x->>'cur_cost_per_result', x->>'prev_spend', x->>'var_spend'
      from camp, jsonb_array_elements(j) x where x->>'name' = 'Campaña pausada'$$,
  $$values (null::text,null::text,null::text,null::text)$$,
  'T-13: sin la acción del objetivo el resultado es no calculable, nunca cero');
select results_eq(
  $$select x->>'name', x->>'parent_ref' from jsonb_array_elements(pg_temp.ents('adset')) x$$,
  $$values ('Campaña Uno','ca000000-0000-4000-8000-000000000001')$$,
  'T-12 a: un conjunto con el mismo nombre que una campaña no se mezcla con ella');
select is(jsonb_array_length(pg_temp.ents('ad')),1,'C-05: el nivel anuncio se recorre aparte');

select results_eq(
  $$select x->>'name' from jsonb_array_elements(pg_temp.ents('campaign',null,null,1)) x$$,
  $$values ('Campaña Uno')$$, 'C-05: primera página por clave');
select results_eq(
  $$select x->>'name' from jsonb_array_elements(pg_temp.ents('campaign','84',
      'ca000000-0000-4000-8000-000000000001',1)) x$$,
  $$values ('Campaña pausada')$$, 'C-05: segunda página después de (gasto, ref)');
select is(jsonb_array_length(pg_temp.ents('campaign','5','ca000000-0000-4000-8000-000000000002',1)),0,
  'C-05: la paginación termina sin repetir');
select is(pg_temp.sqlstate_of($$select * from public.meta_diagnostic_entity_metrics(
  'cc000000-0000-4000-8000-000000000171','campaign',current_date-27,current_date,null,null,
  'actions:purchase',null,null,501)$$),'22023','C-05: p_limit mayor que 500 se rechaza');
select is(pg_temp.sqlstate_of($$select * from public.meta_diagnostic_entity_metrics(
  'cc000000-0000-4000-8000-000000000171','campaign',current_date-27,current_date,null,null,
  'actions:purchase','1.5e3',null,10)$$),'22023','CA-44b: la clave de gasto es texto decimal exacto');

-- ===========================================================================
-- T-14: desgloses de cuenta
-- ===========================================================================

create function pg_temp.bd(p_dimension text) returns jsonb language sql as $f$
  select pg_temp.as_user('aaaaaaaa-0000-4000-8000-000000000171', format(
    $q$select coalesce(jsonb_agg(to_jsonb(m)),'[]') from public.meta_diagnostic_breakdown_metrics(
      'cc000000-0000-4000-8000-000000000171','account',%L,%L,%L,'actions:purchase') m$q$,
    p_dimension,pg_temp.d()-27,pg_temp.d())) $f$;

select results_eq(
  $$select x->>'segment_key', x->>'spend', x->>'result_count', x->>'ctr', x->>'cost_per_result',
           x->>'attribution', x->>'currency', x->>'last_attempt_status', (x->>'segments_total')::int
      from jsonb_array_elements(pg_temp.bd('country')) x$$,
  $$values ('AR','56','28','4.000000','2.000000','unknown','USD','complete',2),
           ('UY','3',null::text,'10.000000',null::text,'unknown','USD','complete',2)$$,
  'T-14: país por gasto, atribución unknown y resultado del objetivo');
select results_eq(
  $$select x->>'dimension', x->>'segment_key', x->>'segment_label', x->>'result_count'
      from jsonb_array_elements(pg_temp.bd('age_gender')) x$$,
  $$values ('age_gender','25-34|female','25-34 · female','28')$$,
  'T-14: edad y género sin cruzar con lugar');
select results_eq(
  $$select x->>'result_count', x->>'cost_per_result', x->>'spend', x->>'currency', x->>'last_attempt_status'
      from jsonb_array_elements(pg_temp.bd('region')) x$$,
  $$values (null::text,null::text,null::text,'mixed','failed')$$,
  'T-14: región sin resultado; moneda mixta sin dinero; último intento fallido');
select is(pg_temp.sqlstate_of($$select * from public.meta_diagnostic_breakdown_metrics(
  'cc000000-0000-4000-8000-000000000171','account','device',current_date-27,current_date,
  'actions:purchase')$$),'22023','T-14: una dimensión fuera de la lista se rechaza');

-- ===========================================================================
-- T-22: tras desconectar el informe sigue en la tabla pero no se ve
-- ===========================================================================

select 1 from worker_api.begin_disconnect('aaaaaaaa-0000-4000-8000-000000000171',
  'c0a00000-0000-4000-8000-000000000171','cc000000-0000-4000-8000-000000000171');
select is(pg_temp.as_user('aaaaaaaa-0000-4000-8000-000000000171',
  $$select count(*)::text::jsonb from public.diagnostic_reports$$),'0'::jsonb,
  'T-22: desconectada, el informe no se lee');
select is(worker_api.purge_connection('aaaaaaaa-0000-4000-8000-000000000171',
  'c0a00000-0000-4000-8000-000000000171','cc000000-0000-4000-8000-000000000171'),true,
  'T-22: purge_connection procede sin tocar el diagnóstico');
select is((select count(*)::int from public.diagnostic_reports
  where company_id = 'c0a00000-0000-4000-8000-000000000171'),1,
  'T-22: tras la purga el informe sigue en la tabla');
select 1 from worker_api.create_pending_connection(
  'aaaaaaaa-0000-4000-8000-000000000171','c0a00000-0000-4000-8000-000000000171',
  'cc000000-0000-4000-8000-0000000001a1','negocio_sintetico','AAAA','AAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAA==',1,'system_user','app_sintetica','{ads_read}',null);
select 1 from worker_api.confirm_connection(
  'aaaaaaaa-0000-4000-8000-000000000171','c0a00000-0000-4000-8000-000000000171',
  'cc000000-0000-4000-8000-0000000001a1','act_900001a1','USD','UTC',true);
select is(pg_temp.as_user('aaaaaaaa-0000-4000-8000-000000000171',
  $$select count(*)::text::jsonb from public.diagnostic_reports$$),'0'::jsonb,
  'T-22: reconectada a otra conexión, el informe sigue oculto');
select is(pg_temp.elig('aaaaaaaa-0000-4000-8000-000000000171','cc000000-0000-4000-8000-0000000001a1')->>'reason',
  'sync_missing','T-07: el informe oculto de la conexión anterior no bloquea a la nueva');

select * from finish();
rollback;
