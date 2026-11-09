-- M25a: registro, arriendo, privilegios y lecturas del chat. Datos sintéticos.
begin;
create extension if not exists pgtap with schema extensions;
select plan(163);

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

create function pg_temp.result_as(p_user uuid, p_sql text) returns jsonb language plpgsql as $f$
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

select has_table('public', 'chat_query_records', 'T-01: registro existe');
select has_table('private', 'chat_turn_leases', 'T-01: arriendos existen');
select is((select relrowsecurity from pg_class where oid = 'public.chat_query_records'::regclass), true,
  'T-01: RLS en registro');
select is((select relforcerowsecurity from pg_class where oid = 'public.chat_query_records'::regclass), true,
  'T-01: RLS forzada en registro');
select is((select relrowsecurity from pg_class where oid = 'private.chat_turn_leases'::regclass), true,
  'T-01: RLS en arriendos');
select is((select relforcerowsecurity from pg_class where oid = 'private.chat_turn_leases'::regclass), true,
  'T-01: RLS forzada en arriendos');
select is_empty($$select 1 from pg_class c, pg_namespace n,
  unnest(array['anon','authenticated','service_role','praxa_integrations']) role_name
  where n.oid = c.relnamespace and (n.nspname, c.relname) in
    (('public','chat_query_records'),('private','chat_turn_leases'))
    and has_table_privilege(role_name, c.oid, 'SELECT')$$,
  'T-01: ninguno de los cuatro roles lee las tablas');
select is_empty($$select 1 from pg_policy where polrelid in
  ('public.chat_query_records'::regclass, 'private.chat_turn_leases'::regclass)$$,
  'T-01: sin políticas RLS');
select results_eq($$select attname::text collate "default" from pg_attribute
  where attrelid = 'public.chat_query_records'::regclass and attnum > 0 and not attisdropped
  order by attnum$$,
  $$values ('id'),('company_id'),('connection_id'),('question_redacted'),('tool_names'),
    ('outcome'),('reason'),('latency_ms'),('requested_model_id'),('reported_model_id'),
    ('feedback'),('created_at')$$,
  'T-01: columnas exactas del registro');
select is((select count(*)::int from pg_constraint
  where conrelid = 'public.chat_query_records'::regclass and confdeltype = 'c'), 2,
  'T-02: empresa y conexión borran en cascada');
select is((select count(*)::int from pg_constraint
  where conrelid = 'private.chat_turn_leases'::regclass and confdeltype = 'c'), 2,
  'T-02: empresa y usuario borran arriendos en cascada');

select has_function('worker_api','begin_chat_turn',array['uuid','uuid','uuid','integer'],
  'T-36: begin_chat_turn existe');
select has_function('worker_api','end_chat_turn',array['uuid','uuid','uuid'],
  'T-36: end_chat_turn existe');
select has_function('worker_api','record_query',
  array['uuid','uuid','uuid','uuid','integer','text','text[]','text','text','integer','text','text'],
  'T-02: record_query existe');
select has_function('worker_api','set_feedback',array['uuid','uuid','uuid','text'],
  'T-05: set_feedback existe');

select is(private.chat_attribution_ref('{"known":false,"settings":[]}'::jsonb),
  'unknown','T-26: atribución desconocida explícita');
select is(private.chat_attribution_ref('{"known":true,"report_time":"impression","unified":true,
  "settings":[{"adset_ref":"A","windows":[{"event_type":"click","days":7},
    {"event_type":"view","days":1}]}]}'::jsonb),
  private.chat_attribution_ref('{"known":true,"report_time":"impression","unified":true,
  "settings":[{"adset_ref":"B","windows":[{"event_type":"view","days":1},
    {"event_type":"click","days":7}]},{"adset_ref":"C","windows":
    [{"event_type":"click","days":7},{"event_type":"view","days":1}]}]}'::jsonb),
  'T-26: mismos conjuntos de ventanas, aunque cambien IDs y orden, comparten referencia');
select isnt(private.chat_attribution_ref('{"known":true,"report_time":"impression","unified":true,
  "settings":[{"windows":[{"event_type":"click","days":7},
    {"event_type":"view","days":1}]}]}'::jsonb),
  private.chat_attribution_ref('{"known":true,"report_time":"impression","unified":true,
  "settings":[{"windows":[{"event_type":"click","days":7}]},
    {"windows":[{"event_type":"view","days":1}]}]}'::jsonb),
  'T-26: conjunto completo difiere de dos conjuntos separados');
select isnt(private.chat_attribution_ref('{"known":true,"report_time":"impression","unified":true,
  "settings":[{"windows":[{"event_type":"click","days":7}]}]}'::jsonb),
  private.chat_attribution_ref('{"known":true,"report_time":"impression","unified":true,
  "settings":[{"windows":[{"event_type":"click","days":1}]}]}'::jsonb),
  'T-26: ventana distinta cambia la referencia');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values ('aaaaaaaa-0000-4000-8000-000000000151', '00000000-0000-0000-0000-000000000000',
        'authenticated','authenticated','chat.uno@praxa.test','x',now(),now(),now()),
       ('aaaaaaaa-0000-4000-8000-000000000152', '00000000-0000-0000-0000-000000000000',
        'authenticated','authenticated','chat.dos@praxa.test','x',now(),now(),now());
insert into public.companies (id,name,owner_id) values
  ('c0a00000-0000-4000-8000-000000000151','Chat sintético uno','aaaaaaaa-0000-4000-8000-000000000151'),
  ('c0a00000-0000-4000-8000-000000000152','Chat sintético dos','aaaaaaaa-0000-4000-8000-000000000152');
select 1 from worker_api.create_pending_connection(
  'aaaaaaaa-0000-4000-8000-000000000151','c0a00000-0000-4000-8000-000000000151',
  'cc000000-0000-4000-8000-000000000151','negocio_sintetico','AAAA','AAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAA==',1,'system_user','app_sintetica','{ads_read}',null);
select 1 from worker_api.confirm_connection(
  'aaaaaaaa-0000-4000-8000-000000000151','c0a00000-0000-4000-8000-000000000151',
  'cc000000-0000-4000-8000-000000000151','act_90000151','USD','UTC',true);

select is((select written from worker_api.record_query(
  'aaaaaaaa-0000-4000-8000-000000000151','c0a00000-0000-4000-8000-000000000151',
  'fa000000-0000-4000-8000-000000000151','cc000000-0000-4000-8000-000000000151',
  0,'Pregunta sintética','{total}','answered',null,12,'modelo_sintetico',null)),true,
  'T-02: conexión activa y generación vigente escribe');
select is((select written from worker_api.record_query(
  'aaaaaaaa-0000-4000-8000-000000000151','c0a00000-0000-4000-8000-000000000151',
  'fa000000-0000-4000-8000-000000000151','cc000000-0000-4000-8000-000000000151',
  0,'Pregunta sintética','{total}','answered',null,12,'modelo_sintetico',null)),true,
  'T-03: reintento idéntico confirma sin duplicar');
select is((select count(*)::int from public.chat_query_records where id =
  'fa000000-0000-4000-8000-000000000151'),1,'T-03: una sola fila');
select is(pg_temp.sqlstate_of($$select * from worker_api.record_query(
  'aaaaaaaa-0000-4000-8000-000000000151','c0a00000-0000-4000-8000-000000000151',
  'fa000000-0000-4000-8000-000000000151','cc000000-0000-4000-8000-000000000151',
  0,'Otra pregunta','{total}','answered',null,12,'modelo_sintetico',null)$$),'22023',
  'T-03: mismo id con otro contenido rechaza');
select is((select written from worker_api.record_query(
  'aaaaaaaa-0000-4000-8000-000000000151','c0a00000-0000-4000-8000-000000000151',
  'fa000000-0000-4000-8000-000000000153','cc000000-0000-4000-8000-000000000151',
  1,'Pregunta sintética','{}','not_answered','tool_error',12,'modelo_sintetico',null)),false,
  'T-02: generación distinta descarta');
select is((select written from worker_api.record_query(
  'aaaaaaaa-0000-4000-8000-000000000151','c0a00000-0000-4000-8000-000000000151',
  'fa000000-0000-4000-8000-000000000163','cc000000-0000-4000-8000-000000000151',
  0,'Pregunta sintética','{}','not_answered','no_coverage',12,'modelo_sintetico',null)),true,
  'T-65: conexión activa registra abstención por falta de cobertura');
select is((select written from worker_api.record_query(
  'aaaaaaaa-0000-4000-8000-000000000151','c0a00000-0000-4000-8000-000000000151',
  'fa000000-0000-4000-8000-000000000164','cc000000-0000-4000-8000-000000000151',
  0,'Pregunta sintética','{coverage}','answered_partial_coverage',null,12,
  'modelo_sintetico',null)),true,
  'T-65: conexión activa registra respuesta parcial');
select is((select written from worker_api.record_query(
  'aaaaaaaa-0000-4000-8000-000000000151','c0a00000-0000-4000-8000-000000000151',
  'fa000000-0000-4000-8000-000000000154',null,
  null,'Sin conexión','{}','not_answered','connection_not_active',12,'modelo_sintetico',null)),true,
  'T-04: sin conexión admite motivo fijo');
select is(pg_temp.sqlstate_of($$select * from worker_api.record_query(
  'aaaaaaaa-0000-4000-8000-000000000151','c0a00000-0000-4000-8000-000000000151',
  'fa000000-0000-4000-8000-000000000155',null,
  null,'Sin conexión','{}','answered',null,12,'modelo_sintetico',null)$$),'22023',
  'T-04: sin conexión no admite respuesta');
select is((select worker_api.set_feedback(
  'aaaaaaaa-0000-4000-8000-000000000151','c0a00000-0000-4000-8000-000000000151',
  'fa000000-0000-4000-8000-000000000151','useful')),true,'T-05: voto válido');
select is((select worker_api.set_feedback(
  'aaaaaaaa-0000-4000-8000-000000000151','c0a00000-0000-4000-8000-000000000151',
  'fa000000-0000-4000-8000-000000000151','not_useful')),true,'T-05: último voto gana');
select is((select feedback from public.chat_query_records where id =
  'fa000000-0000-4000-8000-000000000151'),'not_useful','T-05: valor final');
select is((select worker_api.set_feedback(
  'aaaaaaaa-0000-4000-8000-000000000152','c0a00000-0000-4000-8000-000000000152',
  'fa000000-0000-4000-8000-000000000151','useful')),false,
  'T-05: empresa ajena no vota');
select is(pg_temp.sqlstate_of($$select worker_api.set_feedback(
  'aaaaaaaa-0000-4000-8000-000000000151','c0a00000-0000-4000-8000-000000000151',
  'fa000000-0000-4000-8000-000000000151','otro')$$),'22023',
  'T-05: voto inválido rechazado');
select is((select written from worker_api.record_query(
  'aaaaaaaa-0000-4000-8000-000000000152','c0a00000-0000-4000-8000-000000000152',
  'fa000000-0000-4000-8000-000000000159','cc000000-0000-4000-8000-000000000151',
  0,'Pregunta sintética','{}','answered',null,12,'modelo_sintetico',null)),false,
  'T-02: conexión de otra empresa no escribe');
select is((select written from worker_api.record_query(
  'aaaaaaaa-0000-4000-8000-000000000151','c0a00000-0000-4000-8000-000000000151',
  'fa000000-0000-4000-8000-000000000160','cc000000-0000-4000-8000-000000009999',
  0,'Pregunta sintética','{}','answered',null,12,'modelo_sintetico',null)),false,
  'T-02: conexión inexistente no escribe');
select is((select count(*)::int from public.chat_query_records where id in
  ('fa000000-0000-4000-8000-000000000159',
   'fa000000-0000-4000-8000-000000000160')),0,
  'T-02: referencias ajena e inexistente no dejan fila');
select 1 from worker_api.create_pending_connection(
  'aaaaaaaa-0000-4000-8000-000000000152','c0a00000-0000-4000-8000-000000000152',
  'cc000000-0000-4000-8000-000000000152','negocio_sintetico','AAAA',
  'AAAAAAAAAAAAAAAA','AAAAAAAAAAAAAAAAAAAAAA==',1,'system_user','app_sintetica',
  '{ads_read}',null);
select is((select written from worker_api.record_query(
  'aaaaaaaa-0000-4000-8000-000000000152','c0a00000-0000-4000-8000-000000000152',
  'fa000000-0000-4000-8000-000000000161','cc000000-0000-4000-8000-000000000152',
  0,'Pregunta sintética','{}','not_answered','connection_not_active',12,
  'modelo_sintetico',null)),true,
  'T-65: pending_selection admite abstención por conexión inactiva');
select is((select written from worker_api.record_query(
  'aaaaaaaa-0000-4000-8000-000000000152','c0a00000-0000-4000-8000-000000000152',
  'fa000000-0000-4000-8000-000000000162','cc000000-0000-4000-8000-000000000152',
  0,'Pregunta sintética','{}','answered',null,12,'modelo_sintetico',null)),false,
  'T-65: pending_selection descarta respuesta afirmativa');

select is((select worker_api.begin_chat_turn(
  'aaaaaaaa-0000-4000-8000-000000000151','c0a00000-0000-4000-8000-000000000151',
  'eb000000-0000-4000-8000-000000000151',90)),
  'eb000000-0000-4000-8000-000000000151'::uuid,'T-36: primer arriendo');
select is(pg_temp.sqlstate_of($$select worker_api.begin_chat_turn(
  'aaaaaaaa-0000-4000-8000-000000000151','c0a00000-0000-4000-8000-000000000151',
  'eb000000-0000-4000-8000-000000000152',90)$$),'PX011',
  'T-36: segundo turno bloqueado');
select is((select worker_api.begin_chat_turn(
  'aaaaaaaa-0000-4000-8000-000000000151','c0a00000-0000-4000-8000-000000000151',
  'eb000000-0000-4000-8000-000000000151',90)),
  'eb000000-0000-4000-8000-000000000151'::uuid,'T-36: mismo turno idempotente');
select is((select worker_api.end_chat_turn(
  'aaaaaaaa-0000-4000-8000-000000000151','c0a00000-0000-4000-8000-000000000151',
  'eb000000-0000-4000-8000-000000000152')),false,
  'T-36: otro id no libera');
select is((select worker_api.end_chat_turn(
  'aaaaaaaa-0000-4000-8000-000000000151','c0a00000-0000-4000-8000-000000000151',
  'eb000000-0000-4000-8000-000000000151')),true,
  'T-36: liberar turno');
insert into private.chat_turn_leases(company_id,user_id,turn_id,expires_at) values
  ('c0a00000-0000-4000-8000-000000000151','aaaaaaaa-0000-4000-8000-000000000151',
   'eb000000-0000-4000-8000-000000000153',now()-interval '1 second');
select is(worker_api.begin_chat_turn(
  'aaaaaaaa-0000-4000-8000-000000000151','c0a00000-0000-4000-8000-000000000151',
  'eb000000-0000-4000-8000-000000000154',90),
  'eb000000-0000-4000-8000-000000000154'::uuid,
  'T-36: arriendo vencido se reemplaza');
select is(worker_api.end_chat_turn(
  'aaaaaaaa-0000-4000-8000-000000000151','c0a00000-0000-4000-8000-000000000151',
  'eb000000-0000-4000-8000-000000000154'),true,
  'T-36: turno reemplazante se libera');

select is(pg_temp.sqlstate_as('authenticated',
  $$select 1 from public.chat_query_records$$),'42501','T-31: JWT no lee registros');
select is(pg_temp.sqlstate_as('praxa_integrations',
  $$select 1 from public.chat_query_records$$),'42501','T-01: rol de C no lee registros');
select has_function('public','chat_total',array['uuid','uuid','text','date','date','text'],
  'T-19: total invoker existe');
select has_function('public','chat_ranking',
  array['uuid','text','text','date','date','text','text','integer','boolean'],
  'T-27: ranking invoker existe');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname like 'chat_%'),11,
  'T-09: once lecturas públicas exactas');
select is_empty($$select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname like 'chat_%'
    and (p.prosecdef or p.provolatile<>'s' or not (p.proconfig @> array['search_path=""']))$$,
  'T-09: todas las lecturas son stable, invoker y sin search_path');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname like 'chat_%'
    and has_function_privilege('authenticated',p.oid,'EXECUTE')),11,
  'T-09: authenticated ejecuta las once lecturas');
select is_empty($$select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname like 'chat_%'
    and (has_function_privilege('anon',p.oid,'EXECUTE')
      or has_function_privilege('praxa_integrations',p.oid,'EXECUTE')
      or has_function_privilege('service_role',p.oid,'EXECUTE'))$$,
  'T-09: anon, rol de C y service_role no ejecutan las lecturas');
select is(pg_temp.sqlstate_as('anon',$$select public.chat_total(
  'cc000000-0000-4000-8000-000000000151',
  'a2000000-0000-4000-8000-000000000001','spend',current_date-1,current_date-1,null)$$),
  '42501','T-09: anon recibe 42501 al invocar lectura');
select is(pg_temp.sqlstate_of($$select public.chat_total(
  'cc000000-0000-4000-8000-000000000151',
  'fa000000-0000-4000-8000-000000000151','spend',date '2026-01-01',date '2026-04-04',null)$$),
  '22023','T-19: período de 94 días rechazado');
select is(pg_temp.sqlstate_of(v.sql),'22023','T-19: 94 días en ' || v.fn)
from (values
  ('total',$q$select public.chat_total(null,null,'spend',date '2026-01-01',date '2026-04-04',null)$q$),
  ('daily_average',$q$select public.chat_daily_average(null,null,'spend',date '2026-01-01',date '2026-04-04',null)$q$),
  ('compare_periods',$q$select public.chat_compare_periods(null,null,'spend',date '2026-01-01',date '2026-04-04',date '2026-05-01',date '2026-05-02',null)$q$),
  ('percent_change',$q$select public.chat_percent_change(null,null,'spend',date '2026-01-01',date '2026-04-04',date '2026-05-01',date '2026-05-02',null)$q$),
  ('daily_series',$q$select public.chat_daily_series(null,null,'spend',date '2026-01-01',date '2026-04-04',null)$q$),
  ('coverage',$q$select public.chat_coverage(null,'account',date '2026-01-01',date '2026-04-04')$q$),
  ('cost_per_result',$q$select public.chat_cost_per_result(null,null,'purchase',date '2026-01-01',date '2026-04-04')$q$),
  ('share',$q$select public.chat_share(null,null,'spend',date '2026-01-01',date '2026-04-04',null)$q$),
  ('ranking',$q$select public.chat_ranking(null,'account','spend',date '2026-01-01',date '2026-04-04',null,'desc',10,false)$q$),
  ('action_types',$q$select public.chat_action_types(null,null,date '2026-01-01',date '2026-04-04')$q$),
  ('breakdown',$q$select public.chat_breakdown(null,'account','country','spend',date '2026-01-01',date '2026-04-04',null,null,20)$q$)
) v(fn,sql);

select 1 from worker_api.start_sync_run(
  'aaaaaaaa-0000-4000-8000-000000000151','c0a00000-0000-4000-8000-000000000151',
  'cc000000-0000-4000-8000-000000000151',0,
  'e0000000-0000-4000-8000-000000000151',repeat('e',64),
  current_date-1,current_date-1,
  '{"lookbackDays":1,"maxWindowDays":1,"maxPagesPerLevel":1,"maxMetadataPages":1,"maxEntities":1,"maxPayloadBytes":100000,"maxDurationMs":1000,"finalizationReserveMs":1000,"leaseSeconds":2,"maxRetries":2,"retryDelayMs":500}');
select 1 from worker_api.publish_snapshot(
  'aaaaaaaa-0000-4000-8000-000000000151','c0a00000-0000-4000-8000-000000000151',
  'cc000000-0000-4000-8000-000000000151',0,
  'e0000000-0000-4000-8000-000000000151',repeat('e',64),
  '5a000000-0000-4000-8000-000000000151','account',clock_timestamp(),1,1,
  jsonb_build_object('entities',jsonb_build_array(jsonb_build_object(
    'level','account','external_id','act_90000151','parent_external_id',null,
    'name','Cuenta sintética','effective_status',null,'objective',null,
    'metadata_fetched_at',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'attribution','{"known":false,"report_time":"impression","unified":true,"settings":[]}'::jsonb)),
    'days',jsonb_build_array(jsonb_build_object(
      'date',(current_date-1)::text,'level','account','external_id','act_90000151',
      'spend','1.50','impressions','10','reach',null,'clicks','2','inline_link_clicks',null,
      'ctr',null,'cpc',null,'cpm',null,'frequency',null,
      'actions','[{"action_type":"purchase","variant":"value","count":"1","value":"2.50"}]'::jsonb))));

select is((select (public.chat_total(
  'cc000000-0000-4000-8000-000000000151',entity_ref,'spend',current_date-1,current_date-1,null)
  #>> '{values,0,value}') from public.meta_entities where connection_id =
  'cc000000-0000-4000-8000-000000000151' and level = 'account'),
  '1.50','T-25: gasto exacto en SQL');
select is((pg_temp.result_as('aaaaaaaa-0000-4000-8000-000000000152',
  format('select public.chat_total(%L::uuid,%L::uuid,%L,date %L,date %L,null)',
    'cc000000-0000-4000-8000-000000000151',
    (select entity_ref from public.meta_entities where connection_id=
      'cc000000-0000-4000-8000-000000000151' and level='account'),
    'spend',(current_date-1)::text,(current_date-1)::text)) ->> 'status'),
  'not_found','T-09: JWT de otra empresa no ve entidad ni cifra');
select is((select (public.chat_total(
  'cc000000-0000-4000-8000-000000000151',entity_ref,'ctr',current_date-1,current_date-1,null)
  #>> '{values,0,value}') from public.meta_entities where connection_id =
  'cc000000-0000-4000-8000-000000000151' and level = 'account'),
  '20.000000','T-25: CTR recalculado desde bases');
select is((select (public.chat_total(
  'cc000000-0000-4000-8000-000000000151',entity_ref,'spend',current_date-2,current_date-1,null)
  #>> '{composition,days_not_observed}') from public.meta_entities where connection_id =
  'cc000000-0000-4000-8000-000000000151' and level = 'account'),
  '1','T-22: día no observado cuenta, sin convertirse a cero');
select is((select (public.chat_total(
  'cc000000-0000-4000-8000-000000000151',entity_ref,'spend',current_date-2,current_date-1,null)
  #>> '{composition,partial}') from public.meta_entities where connection_id =
  'cc000000-0000-4000-8000-000000000151' and level = 'account'),
  'true','T-22: total con día faltante es parcial');
select is((select (public.chat_total(
  'cc000000-0000-4000-8000-000000000151',entity_ref,'reach',current_date-1,current_date-1,null)
  ->> 'status') from public.meta_entities where connection_id =
  'cc000000-0000-4000-8000-000000000151' and level = 'account'),
  'not_supported','T-25: alcance no se agrega');
select is((select (public.chat_daily_average(
  'cc000000-0000-4000-8000-000000000151',entity_ref,'spend',current_date-2,current_date-1,null)
  #>> '{values,0,value}') from public.meta_entities where connection_id =
  'cc000000-0000-4000-8000-000000000151' and level = 'account'),
  '1.500000','T-25: promedio usa días con dato');
select is((select pg_catalog.jsonb_array_length(public.chat_percent_change(
  'cc000000-0000-4000-8000-000000000151',entity_ref,'spend',
  current_date-1,current_date-1,current_date-1,current_date-1,null)->'values')
  from public.meta_entities where connection_id =
  'cc000000-0000-4000-8000-000000000151' and level='account'),
  1,'T-27: variación devuelve solo change');
select is((select public.chat_percent_change(
  'cc000000-0000-4000-8000-000000000151',entity_ref,'spend',
  current_date-1,current_date-1,current_date-1,current_date-1,null)#>>'{values,0,value}'
  from public.meta_entities where connection_id =
  'cc000000-0000-4000-8000-000000000151' and level='account'),
  '0.000000','T-27: variación exacta en texto');
select is((select public.chat_compare_periods(
  'cc000000-0000-4000-8000-000000000151',entity_ref,'spend',
  current_date-1,current_date-1,current_date-1,current_date-1,null)#>>'{values,2,value}'
  from public.meta_entities where connection_id =
  'cc000000-0000-4000-8000-000000000151' and level='account'),
  '0.00','T-27: diferencia b menos a');
select is((select (public.chat_daily_series(
  'cc000000-0000-4000-8000-000000000151',entity_ref,'spend',current_date-2,current_date-1,null)
  #>> '{values,0,absence}') from public.meta_entities where connection_id =
  'cc000000-0000-4000-8000-000000000151' and level = 'account'),
  'no_observado','T-22: la serie conserva el día sin observación');
select is((public.chat_coverage(
  'cc000000-0000-4000-8000-000000000151','account',current_date-2,current_date-1)
  #>> '{composition,days_not_observed}'),
  '1','T-22: cobertura cuenta el día no observado');
select is((select (public.chat_cost_per_result(
  'cc000000-0000-4000-8000-000000000151',entity_ref,'purchase',current_date-1,current_date-1)
  #>> '{values,0,value}') from public.meta_entities where connection_id =
  'cc000000-0000-4000-8000-000000000151' and level = 'account'),
  '1.500000','T-27: costo por resultado usa gasto y acción');
select is((select (public.chat_share(
  'cc000000-0000-4000-8000-000000000151',entity_ref,'spend',current_date-1,current_date-1,null)
  ->> 'status') from public.meta_entities where connection_id =
  'cc000000-0000-4000-8000-000000000151' and level = 'account'),
  'not_supported','T-27: participación no se calcula en cuenta');
select is(public.chat_ranking(
  'cc000000-0000-4000-8000-000000000151','account','spend',current_date-1,current_date-1,
  null,'desc',10,false)#>>'{values,0,value}',
  '1.50','T-27: ranking devuelve el valor exacto');
select is(public.chat_ranking(
  'cc000000-0000-4000-8000-000000000151','account','spend',current_date-1,current_date-1,
  null,'desc',10,false)#>>'{values,1,value}',
  '1','T-27: list_count antes del tope');
select is((select public.chat_action_types(
  'cc000000-0000-4000-8000-000000000151',entity_ref,current_date-1,current_date-1)
  #>>'{values,0,value}' from public.meta_entities where connection_id =
  'cc000000-0000-4000-8000-000000000151' and level='account'),
  '1','T-27: tipo de acción conserva el conteo');
select is((select public.chat_action_types(
  'cc000000-0000-4000-8000-000000000151',entity_ref,current_date-1,current_date-1)
  #>>'{values,1,value}' from public.meta_entities where connection_id =
  'cc000000-0000-4000-8000-000000000151' and level='account'),
  '2.50','T-27: tipo de acción conserva el valor');
update public.meta_daily_coverage set rows = pg_catalog.jsonb_set(rows,'{0,actions}',
  (rows#>'{0,actions}') || '[{"action_type":"lead","variant":"value","count":"2","value":null}]'::jsonb)
where connection_id='cc000000-0000-4000-8000-000000000151' and level='account';
select is((select public.chat_action_types(
  'cc000000-0000-4000-8000-000000000151',entity_ref,current_date-1,current_date-1)
  #>>'{values,1,absence}' from public.meta_entities where connection_id =
  'cc000000-0000-4000-8000-000000000151' and level='account'),
  'no_informado','T-27: cada tipo conserva lado ausente sin inventar cero');
select is((select pg_catalog.jsonb_array_length(public.chat_action_types(
  'cc000000-0000-4000-8000-000000000151',entity_ref,current_date-1,current_date-1)->'values')
  from public.meta_entities where connection_id =
  'cc000000-0000-4000-8000-000000000151' and level='account'),
  4,'T-27: cada tipo tiene dos valores');
select is((select public.chat_action_types(
  'cc000000-0000-4000-8000-000000000151',entity_ref,current_date-2,current_date-1)
  #>>'{composition,days_with_value}' from public.meta_entities where connection_id =
  'cc000000-0000-4000-8000-000000000151' and level='account'),
  '1','T-27: composición cuenta días, no tipos');
select 1 from worker_api.publish_breakdown(
  'aaaaaaaa-0000-4000-8000-000000000151','c0a00000-0000-4000-8000-000000000151',
  'cc000000-0000-4000-8000-000000000151',0,
  'e0000000-0000-4000-8000-000000000151',repeat('e',64),
  '5b000000-0000-4000-8000-000000000151','account','country',clock_timestamp(),1,1,
  jsonb_build_object('rows',jsonb_build_array(jsonb_build_object(
    'date',(current_date-1)::text,'external_id','act_90000151',
    'segment_primary','AR','segment_secondary',null,
    'spend','1.50','impressions','10','clicks','2','inline_link_clicks',null,
    'ctr',null,'cpc',null,'cpm',null,'actions','[]'::jsonb))));
select is(public.chat_breakdown(
  'cc000000-0000-4000-8000-000000000151','account','country','spend',
  current_date-1,current_date-1,null,null,20)#>>'{values,0,value}',
  '1.50','T-30: desglose conserva el monto');
select is(public.chat_breakdown(
  'cc000000-0000-4000-8000-000000000151','account','country','spend',
  current_date-1,current_date-1,null,null,20)#>>'{extra,estimated}',
  'true','T-30: desglose estimado');
select is(public.chat_breakdown(
  'cc000000-0000-4000-8000-000000000151','account','country','spend',
  current_date-1,current_date-1,null,null,20)#>>'{values,1,value}',
  '100.000000','T-30: participación calculada por segmento');
select is(pg_temp.sqlstate_of($$select public.chat_breakdown(
  'cc000000-0000-4000-8000-000000000151','campaign','country','spend',
  current_date-1,current_date-1,null,null,20)$$),'22023',
  'T-78: campaña exige entidad');
select is(public.chat_breakdown(
  'cc000000-0000-4000-8000-000000000151','account','region','action_count',
  current_date-1,current_date-1,null,'purchase',20)->>'status','not_supported',
  'T-30: región no admite acciones');
insert into public.meta_breakdown_rows (snapshot_id,entity_ref,date,segment_primary,
  segment_secondary,company_id,connection_id,spend,impressions,clicks,inline_link_clicks,
  ctr,cpc,cpm,actions)
select '5b000000-0000-4000-8000-000000000151',e.entity_ref,current_date-1,
  'S' || lpad(n::text,2,'0'),'','c0a00000-0000-4000-8000-000000000151',
  'cc000000-0000-4000-8000-000000000151',n,10,2,null,null,null,null,'[]'::jsonb
from public.meta_entities e cross join generate_series(1,21) n
where e.connection_id='cc000000-0000-4000-8000-000000000151' and e.level='account';
select is(public.chat_breakdown(
  'cc000000-0000-4000-8000-000000000151','account','country','spend',
  current_date-1,current_date-1,null,null,2)#>>'{extra,segments_total}',
  '22','T-30: total de segmentos antes del recorte');
select is(public.chat_breakdown(
  'cc000000-0000-4000-8000-000000000151','account','country','spend',
  current_date-1,current_date-1,null,null,2)#>>'{values,4,value}',
  '191.50','T-78: otros suma segmentos omitidos');
select is(public.chat_breakdown(
  'cc000000-0000-4000-8000-000000000151','account','country','spend',
  current_date-1,current_date-1,null,null,2)#>>'{values,5,value}',
  '82.365591','T-78: otros tiene participación sobre todos los segmentos');
select is(public.chat_breakdown(
  'cc000000-0000-4000-8000-000000000151','account','country','action_count',
  current_date-1,current_date-1,null,'purchase',2)->>'status',
  'not_calculable','T-30: desglose sin acción no inventa cero');
select is(public.chat_breakdown(
  'cc000000-0000-4000-8000-000000000151','account','country','action_count',
  current_date-1,current_date-1,null,'purchase',2)#>>'{composition,days_metric_missing}',
  '1','T-30: ausencia de acción cuenta como métrica faltante');
select is(pg_catalog.jsonb_array_length(public.chat_breakdown(
  'cc000000-0000-4000-8000-000000000151','account','country','ctr',
  current_date-1,current_date-1,null,null,2)->'values'),3,
  'T-30: tasa recortada no añade otros ni participaciones');
select is(public.chat_breakdown(
  'cc000000-0000-4000-8000-000000000151','account','country','ctr',
  current_date-1,current_date-1,null,null,2)#>>'{composition,days_with_value}',
  '1','T-30: tasa usa bases del día, no el campo de tasa ausente');

-- Dos campañas con filas en días disjuntos y monedas distintas: cada una conserva
-- su valor y la composición del nivel cuenta días, no entidades.
insert into public.meta_sync_runs(id,company_id,connection_id,credential_generation,
  ownership_token,started_at,lease_expires_at,finished_at,window_from,window_to,status,limits)
select 'e0000000-0000-4000-8000-000000000152',company_id,connection_id,
  credential_generation,ownership_token,now()-interval '2 minutes',now()-interval '1 minute',
  now(),current_date-2,current_date-1,'completed',limits
from public.meta_sync_runs where id='e0000000-0000-4000-8000-000000000151';
insert into public.meta_insight_snapshots(id,company_id,connection_id,sync_run_id,level,
  fetched_at,window_from,window_to,currency,timezone,pages,validated_pages,complete,
  result,failure_reason,error_class,parameters,duration_ms,request_payload)
select '5a000000-0000-4000-8000-000000000152',company_id,connection_id,
  'e0000000-0000-4000-8000-000000000152','campaign',now(),current_date-2,
  current_date-1,currency,timezone,pages,validated_pages,complete,result,failure_reason,
  error_class,parameters,duration_ms,request_payload
from public.meta_insight_snapshots where id='5a000000-0000-4000-8000-000000000151';
insert into public.meta_entities(entity_ref,company_id,connection_id,level,external_id,parent_ref)
select ('a2000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  'c0a00000-0000-4000-8000-000000000151',
  'cc000000-0000-4000-8000-000000000151','campaign',n::text,account.entity_ref
from generate_series(1,2) n cross join public.meta_entities account
where account.connection_id='cc000000-0000-4000-8000-000000000151'
  and account.level='account';
with campaign_docs as (
  select jsonb_agg(jsonb_build_object('entity_ref',e.entity_ref,'level','campaign',
    'parent_ref',e.parent_ref,'name','Campaña sintética','effective_status',null,
    'objective',null,'metadata_fetched_at',now(),
    'attribution','{"known":false,"report_time":"impression","unified":true,"settings":[]}'::jsonb)
    order by e.entity_ref) as entities
  from public.meta_entities e
  where e.connection_id='cc000000-0000-4000-8000-000000000151' and e.level='campaign'
), days as (
  select current_date-2 as d,1 as n,'USD'::text as currency,'10'::text as spend
  union all select current_date-1,2,'EUR','20'
)
insert into public.meta_daily_coverage(connection_id,level,date,company_id,snapshot_id,
  fetched_at,captured_before_day_end,currency,timezone,entities,rows)
select 'cc000000-0000-4000-8000-000000000151','campaign',days.d,
  'c0a00000-0000-4000-8000-000000000151',
  '5a000000-0000-4000-8000-000000000152',now(),false,days.currency,'UTC',
  campaign_docs.entities,jsonb_build_array(jsonb_build_object(
    'entity_ref',('a2000000-0000-4000-8000-'||lpad(days.n::text,12,'0'))::uuid,
    'spend',days.spend,'impressions','10','reach',null,'clicks','2',
    'inline_link_clicks',null,'ctr',null,'cpc',null,'cpm',null,'frequency',null,
    'actions','[]'::jsonb,
    'attribution','{"known":false,"report_time":"impression","unified":true,"settings":[]}'::jsonb))
from days cross join campaign_docs;
select is(public.chat_total('cc000000-0000-4000-8000-000000000151',
  'a2000000-0000-4000-8000-000000000001','spend',current_date-2,current_date-1,null)
  #>>'{values,0,value}','10','T-27: moneda de día sin fila no invalida entidad');
select is(public.chat_total('cc000000-0000-4000-8000-000000000151',
  'a2000000-0000-4000-8000-000000000001','spend',current_date-2,current_date-1,null)
  #>>'{values,0,currency}','USD','T-27: moneda de entidad con valor');
select is(public.chat_ranking('cc000000-0000-4000-8000-000000000151',
  'campaign','spend',current_date-2,current_date-1,null,'desc',20,false)
  #>>'{values,0,currency}','EUR','T-27: ranking mantiene moneda de cada entidad');
select is(public.chat_ranking('cc000000-0000-4000-8000-000000000151',
  'campaign','spend',current_date-2,current_date-1,null,'desc',20,false)
  #>>'{values,1,currency}','USD','T-27: segunda moneda no se descarta');
select is(public.chat_ranking('cc000000-0000-4000-8000-000000000151',
  'campaign','spend',current_date-2,current_date-1,null,'desc',20,false)
  #>>'{composition,days_with_value}','2','T-27: composición cuenta dos días');
select is(public.chat_ranking('cc000000-0000-4000-8000-000000000151',
  'campaign','spend',current_date-2,current_date-1,null,'desc',20,false)
  #>>'{values,0,composition,partial}','true','T-27: fila disjunta es parcial');
select is((select public.chat_breakdown('cc000000-0000-4000-8000-000000000151',
  'campaign','country','spend',current_date-2,current_date-1,entity_ref,null,2)
  ->>'status' from public.meta_entities where connection_id=
  'cc000000-0000-4000-8000-000000000151' and level='account'),
  'not_found','T-30: referencia de cuenta no sirve para desglose de campaña');
select is(public.chat_breakdown('cc000000-0000-4000-8000-000000000151',
  'campaign','country','spend',current_date-2,current_date-1,
  'a2000000-0000-4000-8000-000000009999',null,2)->>'status',
  'not_found','T-30: referencia inexistente no devuelve calendario');
update public.meta_daily_coverage set rows = rows || jsonb_build_array(
  (rows->0) || jsonb_build_object(
    'entity_ref','a2000000-0000-4000-8000-000000000001','spend','5'))
where connection_id='cc000000-0000-4000-8000-000000000151'
  and level='campaign' and date=current_date-1;
select is(public.chat_total('cc000000-0000-4000-8000-000000000151',
  'a2000000-0000-4000-8000-000000000001','spend',current_date-2,current_date-1,null)
  ->>'reason','currency_mixed','T-27: misma entidad con dos monedas no se suma');
select is(public.chat_ranking('cc000000-0000-4000-8000-000000000151',
  'campaign','spend',current_date-2,current_date-1,null,'desc',20,false)
  #>>'{values,2,value}','1','T-27: entidad con moneda incompatible queda excluida');
update public.meta_daily_coverage set rows = jsonb_set(jsonb_set(rows,
  '{0,actions}','[{"action_type":"purchase","variant":"value","count":"1","value":null},
    {"action_type":"purchase","variant":"click_7d","count":"100","value":null}]'::jsonb),
  '{0,attribution}','{"known":true,"report_time":"impression","unified":true,
    "settings":[{"adset_ref":"A","windows":[{"event_type":"click","days":7}]}]}'::jsonb)
where connection_id='cc000000-0000-4000-8000-000000000151'
  and level='campaign' and date=current_date-2;
update public.meta_daily_coverage set currency='USD',rows = jsonb_set(jsonb_set(rows,
  '{1,actions}','[{"action_type":"purchase","variant":"value","count":"1","value":null}]'::jsonb),
  '{1,attribution}','{"known":true,"report_time":"impression","unified":true,
    "settings":[{"adset_ref":"B","windows":[{"event_type":"click","days":1}]}]}'::jsonb)
where connection_id='cc000000-0000-4000-8000-000000000151'
  and level='campaign' and date=current_date-1;
select is(public.chat_total('cc000000-0000-4000-8000-000000000151',
  'a2000000-0000-4000-8000-000000000001','action_count',current_date-2,current_date-2,
  'purchase')#>>'{values,0,value}','1','T-26: solo variante value entra en la suma');
select is(public.chat_total('cc000000-0000-4000-8000-000000000151',
  'a2000000-0000-4000-8000-000000000001','action_count',current_date-2,current_date-1,
  'purchase')->>'reason','attribution_incompatible',
  'T-26: ventanas conocidas distintas de una entidad no se suman');
select is(public.chat_compare_periods('cc000000-0000-4000-8000-000000000151',
  'a2000000-0000-4000-8000-000000000001','action_count',current_date-2,current_date-2,
  current_date-1,current_date-1,'purchase')->>'reason','attribution_incompatible',
  'T-26: comparación de ventanas conocidas distintas no calcula diferencia');
update public.meta_daily_coverage set rows=jsonb_set(rows,'{1,attribution}',
  '{"known":false,"report_time":"impression","unified":true,"settings":[]}'::jsonb)
where connection_id='cc000000-0000-4000-8000-000000000151'
  and level='campaign' and date=current_date-1;
select is(public.chat_total('cc000000-0000-4000-8000-000000000151',
  'a2000000-0000-4000-8000-000000000001','action_count',current_date-2,current_date-1,
  'purchase')#>>'{values,0,attribution_ref}','unknown',
  'T-26: conocido más desconocido suma y conserva unknown');
select is(public.chat_compare_periods('cc000000-0000-4000-8000-000000000151',
  'a2000000-0000-4000-8000-000000000001','action_count',current_date-2,current_date-2,
  current_date-1,current_date-1,'purchase')#>>'{values,2,attribution_ref}','unknown',
  'T-26: comparación con unknown conserva advertencia');
update public.meta_daily_coverage set rows=jsonb_set(rows,'{1,attribution}',
  '{"known":true,"report_time":"impression","unified":true,
    "settings":[{"adset_ref":"C","windows":[{"event_type":"click","days":7}]}]}'::jsonb)
where connection_id='cc000000-0000-4000-8000-000000000151'
  and level='campaign' and date=current_date-1;
update public.meta_daily_coverage set rows=jsonb_set(jsonb_set(rows,'{0,actions}',
  '[{"action_type":"purchase","variant":"value","count":"2","value":null}]'::jsonb),
  '{0,attribution}','{"known":true,"report_time":"impression","unified":true,
    "settings":[{"adset_ref":"D","windows":[{"event_type":"click","days":7}]}]}'::jsonb)
where connection_id='cc000000-0000-4000-8000-000000000151'
  and level='campaign' and date=current_date-1;
select is(public.chat_ranking('cc000000-0000-4000-8000-000000000151',
  'campaign','action_count',current_date-2,current_date-1,'purchase','desc',20,false)
  #>>'{extra,attribution_mixed}','false','T-27: mismas ventanas entre entidades no mezclan');
select is(public.chat_ranking('cc000000-0000-4000-8000-000000000151',
  'campaign','action_count',current_date-2,current_date-1,'purchase','desc',20,false)
  #>>'{values,2,value}','2','T-27: ranking de acciones lista dos entidades');
update public.meta_daily_coverage set rows=jsonb_set(rows,'{0,attribution}',
  '{"known":true,"report_time":"impression","unified":true,
    "settings":[{"adset_ref":"D","windows":[{"event_type":"click","days":1}]}]}'::jsonb)
where connection_id='cc000000-0000-4000-8000-000000000151'
  and level='campaign' and date=current_date-1;
select is(public.chat_ranking('cc000000-0000-4000-8000-000000000151',
  'campaign','action_count',current_date-2,current_date-1,'purchase','desc',20,false)
  #>>'{extra,attribution_mixed}','true','T-27: ventanas distintas entre entidades avisan');
update public.meta_daily_coverage set rows=jsonb_set(rows,'{1,attribution}',
  '{"known":true,"report_time":"impression","unified":true,
    "settings":[{"adset_ref":"C","windows":[{"event_type":"click","days":1}]}]}'::jsonb)
where connection_id='cc000000-0000-4000-8000-000000000151'
  and level='campaign' and date=current_date-1;
select is(public.chat_ranking('cc000000-0000-4000-8000-000000000151',
  'campaign','action_count',current_date-2,current_date-1,'purchase','desc',20,false)
  #>>'{values,2,value}','1','T-27: entidad internamente incompatible se excluye');

insert into public.meta_breakdown_snapshots(id,company_id,connection_id,sync_run_id,
  level,dimension,fetched_at,window_from,window_to,currency,timezone,pages,duration_ms,request_hash)
select '5b000000-0000-4000-8000-000000000152',company_id,connection_id,
  'e0000000-0000-4000-8000-000000000152',level,dimension,now(),current_date-2,
  current_date-1,currency,timezone,pages,duration_ms,request_hash
from public.meta_breakdown_snapshots where id='5b000000-0000-4000-8000-000000000151';
insert into public.meta_breakdown_rows(snapshot_id,entity_ref,date,segment_primary,
  segment_secondary,company_id,connection_id,spend,impressions,clicks,
  inline_link_clicks,ctr,cpc,cpm,actions)
select '5b000000-0000-4000-8000-000000000152',e.entity_ref,
  d.day,d.segment,'','c0a00000-0000-4000-8000-000000000151',
  'cc000000-0000-4000-8000-000000000151',d.spend,10,2,null,null,null,null,'[]'::jsonb
from public.meta_entities e cross join (values
  (current_date-2,'A',10::numeric),(current_date-1,'B',20::numeric)) d(day,segment,spend)
where e.connection_id='cc000000-0000-4000-8000-000000000151' and e.level='account';
update public.meta_breakdown_coverage set snapshot_id='5b000000-0000-4000-8000-000000000152'
where connection_id='cc000000-0000-4000-8000-000000000151'
  and level='account' and dimension='country' and date=current_date-1;
insert into public.meta_breakdown_coverage(connection_id,level,dimension,date,company_id,
  snapshot_id,fetched_at,captured_before_day_end,currency,timezone) values
  ('cc000000-0000-4000-8000-000000000151','account','country',current_date-2,
  'c0a00000-0000-4000-8000-000000000151',
  '5b000000-0000-4000-8000-000000000152',now(),false,'USD','UTC');
select is(public.chat_breakdown('cc000000-0000-4000-8000-000000000151',
  'account','country','spend',current_date-2,current_date-1,null,null,1)
  #>>'{composition,days_with_value}','2','T-30: composición de dimensión cuenta días');
select is(public.chat_breakdown('cc000000-0000-4000-8000-000000000151',
  'account','country','spend',current_date-2,current_date-1,null,null,1)
  #>>'{composition,partial}','true','T-30: filas disjuntas marcan resultado parcial');
select is(public.chat_breakdown('cc000000-0000-4000-8000-000000000151',
  'account','country','spend',current_date-2,current_date-1,null,null,1)
  #>>'{values,2,composition,partial}','true','T-30: otros conserva parcialidad');
select is(public.chat_coverage('cc000000-0000-4000-8000-000000000151',
  'campaign',current_date-2,current_date-1)#>>'{composition,observed_from}',
  (current_date-2)::text,'T-90: primer día observado del nivel');
select is(public.chat_coverage('cc000000-0000-4000-8000-000000000151',
  'campaign',current_date-2,current_date-1)#>>'{composition,observed_to}',
  (current_date-1)::text,'T-90: último día observado del nivel');
select is(public.chat_coverage('cc000000-0000-4000-8000-000000000151',
  'campaign',current_date-4,current_date-3)#>>'{extra,nearest_after}',
  (current_date-2)::text,'T-90: cobertura informa próximo día real');
select is(public.chat_coverage('cc000000-0000-4000-8000-000000000151',
  'campaign',current_date,current_date)#>>'{extra,nearest_before}',
  (current_date-1)::text,'T-90: cobertura informa día anterior real');
select is(public.chat_coverage('cc000000-0000-4000-8000-000000000151',
  'campaign',current_date-4,current_date-3)#>>'{composition,observed_from}',
  null::text,'T-90: sin cobertura no inventa fecha observada');
select is(public.chat_breakdown('cc000000-0000-4000-8000-000000000151',
  'account','country','spend',current_date-3,current_date-3,null,null,1)
  #>>'{extra,nearest_after}',(current_date-2)::text,
  'T-90: desglose usa sus propios días cercanos');

-- Siete días: las bases de costo y participación usan todo lo informado,
-- sin convertir en cero la compra o la fila ausente de los otros días.
insert into public.meta_sync_runs(id,company_id,connection_id,credential_generation,
  ownership_token,started_at,lease_expires_at,finished_at,window_from,window_to,status,limits)
select 'e0000000-0000-4000-8000-000000000153',company_id,connection_id,
  credential_generation,ownership_token,now()-interval '2 minutes',now()-interval '1 minute',
  now(),date '2026-06-01',date '2026-06-07','completed',limits
from public.meta_sync_runs where id='e0000000-0000-4000-8000-000000000151';
insert into public.meta_insight_snapshots(id,company_id,connection_id,sync_run_id,level,
  fetched_at,window_from,window_to,currency,timezone,pages,validated_pages,complete,
  result,failure_reason,error_class,parameters,duration_ms,request_payload)
select case when levels.level='account' then '5a000000-0000-4000-8000-000000000153'::uuid
    else '5a000000-0000-4000-8000-000000000154'::uuid end,
  s.company_id,s.connection_id,'e0000000-0000-4000-8000-000000000153',
  levels.level,now(),date '2026-06-01',date '2026-06-07',s.currency,s.timezone,
  s.pages,s.validated_pages,s.complete,s.result,s.failure_reason,s.error_class,
  s.parameters,s.duration_ms,s.request_payload
from public.meta_insight_snapshots s cross join (values ('account'),('campaign')) levels(level)
where s.id='5a000000-0000-4000-8000-000000000151';
with entities as (
  select e.entity_ref,e.level,e.parent_ref from public.meta_entities e
  where e.connection_id='cc000000-0000-4000-8000-000000000151'
    and (e.level='account' or e.entity_ref='a2000000-0000-4000-8000-000000000001')
)
insert into public.meta_daily_coverage(connection_id,level,date,company_id,snapshot_id,
  fetched_at,captured_before_day_end,currency,timezone,entities,rows)
select 'cc000000-0000-4000-8000-000000000151',e.level,d::date,
  'c0a00000-0000-4000-8000-000000000151',
  case when e.level='account' then '5a000000-0000-4000-8000-000000000153'::uuid
    else '5a000000-0000-4000-8000-000000000154'::uuid end,
  now(),false,'USD','UTC',jsonb_build_array(jsonb_build_object(
    'entity_ref',e.entity_ref,'level',e.level,'parent_ref',e.parent_ref,
    'name','Entidad sintética','effective_status',null,'objective',null,
    'metadata_fetched_at',now(),
    'attribution','{"known":false,"report_time":"impression","unified":true,"settings":[]}'::jsonb)),
  case when e.level='account' or d::date=date '2026-06-01' then
    jsonb_build_array(jsonb_build_object('entity_ref',e.entity_ref,'spend','10',
      'impressions',case when d::date=date '2026-06-01' then '0' else '10' end,
      'reach',null,'clicks',case when d::date=date '2026-06-01' then '0' else '1' end,
      'inline_link_clicks',null,'ctr',null,'cpc',null,'cpm',null,'frequency',null,
      'actions',case when e.level='account' and d::date=date '2026-06-01' then
        '[{"action_type":"purchase","variant":"value","count":"1","value":null}]'::jsonb
        else '[]'::jsonb end,
      'attribution','{"known":false,"report_time":"impression","unified":true,"settings":[]}'::jsonb))
    else '[]'::jsonb end
from entities e cross join generate_series(date '2026-06-01',date '2026-06-07',interval '1 day') d;
select is((select public.chat_total('cc000000-0000-4000-8000-000000000151',
  entity_ref,'spend',date '2026-06-01',date '2026-06-07',null)#>>'{values,0,value}'
  from public.meta_entities where connection_id='cc000000-0000-4000-8000-000000000151'
    and level='account'),'70','T-24: total de cuenta prevalece sobre campaña');
select is((select public.chat_cost_per_result('cc000000-0000-4000-8000-000000000151',
  entity_ref,'purchase',date '2026-06-01',date '2026-06-07')#>>'{values,0,value}'
  from public.meta_entities where connection_id='cc000000-0000-4000-8000-000000000151'
    and level='account'),'70.000000','T-27: costo usa siete días de gasto y una compra');
select is((select public.chat_cost_per_result('cc000000-0000-4000-8000-000000000151',
  entity_ref,'purchase',date '2026-06-01',date '2026-06-07')#>>'{composition,days_metric_missing}'
  from public.meta_entities where connection_id='cc000000-0000-4000-8000-000000000151'
    and level='account'),'6','T-27: costo parcial declara seis días sin acción');
select is(public.chat_share('cc000000-0000-4000-8000-000000000151',
  'a2000000-0000-4000-8000-000000000001','spend',date '2026-06-01',date '2026-06-07',null)
  #>>'{values,0,value}','14.285714','T-27: participación usa toda la cuenta');
select is(public.chat_share('cc000000-0000-4000-8000-000000000151',
  'a2000000-0000-4000-8000-000000000001','spend',date '2026-06-01',date '2026-06-07',null)
  #>>'{composition,partial}','true','T-27: participación conserva días sin fila');
select is(public.chat_share('cc000000-0000-4000-8000-000000000151',
  'a2000000-0000-4000-8000-000000000001','ctr',date '2026-06-01',date '2026-06-07',null)
  ->>'reason','metric_not_additive','T-27: tasa no se usa para participación');
select is((select public.chat_total('cc000000-0000-4000-8000-000000000151',
  entity_ref,'ctr',date '2026-06-01',date '2026-06-01',null)->>'reason'
  from public.meta_entities where connection_id='cc000000-0000-4000-8000-000000000151'
    and level='account'),'denominator_zero','T-25: tasa con base cero no se calcula');
select is((select public.chat_compare_periods('cc000000-0000-4000-8000-000000000151',
  entity_ref,'spend',date '2026-06-01',date '2026-06-01',
  date '2026-06-02',date '2026-06-02',null)#>>'{composition,days_total}'
  from public.meta_entities where connection_id='cc000000-0000-4000-8000-000000000151'
    and level='account'),'2','T-27: comparación suma longitud de ambos períodos');
select is((select public.chat_compare_periods('cc000000-0000-4000-8000-000000000151',
  entity_ref,'spend',date '2026-06-01',date '2026-06-01',
  date '2026-06-02',date '2026-06-02',null)#>>'{composition,observed_from}'
  from public.meta_entities where connection_id='cc000000-0000-4000-8000-000000000151'
    and level='account'),null::text,'T-27: comparación no inventa rango observado combinado');
update public.meta_daily_coverage set rows=jsonb_set(jsonb_set(rows,'{0,actions}',
  '[{"action_type":"purchase","variant":"value","count":"1","value":null}]'::jsonb),
  '{0,attribution}','{"known":true,"report_time":"impression","unified":true,
    "settings":[{"adset_ref":"E","windows":[{"event_type":"click","days":7}]}]}'::jsonb)
where connection_id='cc000000-0000-4000-8000-000000000151'
  and level='campaign' and date=date '2026-06-01';
select is(public.chat_share('cc000000-0000-4000-8000-000000000151',
  'a2000000-0000-4000-8000-000000000001','action_count',
  date '2026-06-01',date '2026-06-07','purchase')#>>'{values,0,attribution_ref}',
  'unknown','T-27: participación conocida sobre padre unknown avisa');
update public.meta_daily_coverage set rows=jsonb_set(rows,'{0,actions}',
  '[{"action_type":"lead","variant":"value","count":"2","value":null}]'::jsonb)
where connection_id='cc000000-0000-4000-8000-000000000151'
  and level='account' and date=date '2026-06-02';
select is((select public.chat_action_types('cc000000-0000-4000-8000-000000000151',
  entity_ref,date '2026-06-01',date '2026-06-07')#>>'{composition,days_with_value}'
  from public.meta_entities where connection_id='cc000000-0000-4000-8000-000000000151'
    and level='account'),'2','T-27: dos tipos en días disjuntos cuentan dos días');
select is((select public.chat_action_types('cc000000-0000-4000-8000-000000000151',
  entity_ref,date '2026-06-01',date '2026-06-07')#>>'{values,0,composition,partial}'
  from public.meta_entities where connection_id='cc000000-0000-4000-8000-000000000151'
    and level='account'),'true','T-27: cada tipo declara sus días faltantes');
update public.meta_daily_coverage set rows=jsonb_set(rows,'{0,spend}','null'::jsonb)
where connection_id='cc000000-0000-4000-8000-000000000151'
  and level='account' and date=date '2026-06-03';
select is((select public.chat_total('cc000000-0000-4000-8000-000000000151',
  entity_ref,'cpm',date '2026-06-01',date '2026-06-03',null)#>>'{values,0,value}'
  from public.meta_entities where connection_id='cc000000-0000-4000-8000-000000000151'
    and level='account'),'2000.000000','T-25: CPM recalcula solo con bases completas');
select is((select public.chat_total('cc000000-0000-4000-8000-000000000151',
  entity_ref,'cpm',date '2026-06-01',date '2026-06-03',null)
  #>>'{composition,days_metric_missing}' from public.meta_entities where connection_id=
  'cc000000-0000-4000-8000-000000000151' and level='account'),
  '1','T-25: día con base incompleta queda fuera de tasa');
select is((select public.chat_total('cc000000-0000-4000-8000-000000000151',
  entity_ref,'frequency',date '2026-06-01',date '2026-06-03',null)->>'status'
  from public.meta_entities where connection_id='cc000000-0000-4000-8000-000000000151'
    and level='account'),'not_supported','T-25: frecuencia no se agrega');
select is(public.chat_total('cc000000-0000-4000-8000-000000000151',
  'a2000000-0000-4000-8000-000000000001','spend',
  date '2026-06-01',date '2026-06-07',null)#>>'{composition,days_no_row}',
  '6','T-22: seis días cubiertos sin fila no son ceros');
select is(public.chat_daily_series('cc000000-0000-4000-8000-000000000151',
  'a2000000-0000-4000-8000-000000000001','spend',
  date '2026-06-01',date '2026-06-07',null)#>>'{values,1,absence}',
  'sin_fila_reportada','T-22: serie declara día cubierto sin fila');
insert into public.meta_sync_runs(id,company_id,connection_id,credential_generation,
  ownership_token,started_at,lease_expires_at,finished_at,window_from,window_to,status,limits)
select 'e0000000-0000-4000-8000-000000000154',company_id,connection_id,
  credential_generation,ownership_token,now()-interval '2 minutes',now()-interval '1 minute',
  now(),current_date,current_date,'completed',limits
from public.meta_sync_runs where id='e0000000-0000-4000-8000-000000000151';
insert into public.meta_insight_snapshots(id,company_id,connection_id,sync_run_id,level,
  fetched_at,window_from,window_to,currency,timezone,pages,validated_pages,complete,
  result,failure_reason,error_class,parameters,duration_ms,request_payload)
select '5a000000-0000-4000-8000-000000000155',company_id,connection_id,
  'e0000000-0000-4000-8000-000000000154','account',now(),current_date,current_date,
  currency,timezone,pages,validated_pages,complete,result,failure_reason,error_class,
  parameters,duration_ms,request_payload
from public.meta_insight_snapshots where id='5a000000-0000-4000-8000-000000000151';
insert into public.meta_daily_coverage(connection_id,level,date,company_id,snapshot_id,
  fetched_at,captured_before_day_end,currency,timezone,entities,rows)
select 'cc000000-0000-4000-8000-000000000151','account',current_date,
  'c0a00000-0000-4000-8000-000000000151',
  '5a000000-0000-4000-8000-000000000155',now(),true,'USD','UTC',
  jsonb_build_array(jsonb_build_object('entity_ref',e.entity_ref,'level','account',
    'parent_ref',null,'name','Cuenta sintética','effective_status',null,
    'objective',null,'metadata_fetched_at',now(),
    'attribution','{"known":false,"report_time":"impression","unified":true,"settings":[]}'::jsonb)),
  jsonb_build_array(jsonb_build_object('entity_ref',e.entity_ref,'spend','3',
    'impressions','10','reach',null,'clicks','1','inline_link_clicks',null,
    'ctr',null,'cpc',null,'cpm',null,'frequency',null,'actions','[]'::jsonb,
    'attribution','{"known":false,"report_time":"impression","unified":true,"settings":[]}'::jsonb))
from public.meta_entities e where e.connection_id=
  'cc000000-0000-4000-8000-000000000151' and e.level='account';
update public.meta_daily_coverage set rows=jsonb_set(rows,'{0,inline_link_clicks}','"2"'::jsonb)
where connection_id='cc000000-0000-4000-8000-000000000151'
  and level='account' and date=current_date-1;
select is((select public.chat_total('cc000000-0000-4000-8000-000000000151',
  entity_ref,'spend',current_date,current_date,null)#>>'{composition,days_open}'
  from public.meta_entities where connection_id='cc000000-0000-4000-8000-000000000151'
    and level='account'),'1','T-22: día actual abierto');
select is((select public.chat_total('cc000000-0000-4000-8000-000000000151',
  entity_ref,'spend',current_date,current_date,null)#>>'{composition,days_captured_partial}'
  from public.meta_entities where connection_id='cc000000-0000-4000-8000-000000000151'
    and level='account'),'1','T-22: captura antes del cierre queda parcial');
select is((select public.chat_daily_series('cc000000-0000-4000-8000-000000000151',
  entity_ref,'inline_link_clicks',current_date-1,current_date,null)
  #>>'{values,1,absence}' from public.meta_entities where connection_id=
  'cc000000-0000-4000-8000-000000000151' and level='account'),
  'no_informado','T-22: fila con métrica ausente no es cero');
select is((select public.chat_daily_series('cc000000-0000-4000-8000-000000000151',
  entity_ref,'inline_link_clicks',current_date-1,current_date,null)
  #>>'{values,1,presence}' from public.meta_entities where connection_id=
  'cc000000-0000-4000-8000-000000000151' and level='account'),
  'con_datos','T-22: ausencia de métrica conserva presencia de fila');

-- H-E1-211: la campaña parcial va primero; la completa queda última.
-- El resultado conserva la parcialidad de cualquiera de sus filas.
with second_row as (
  select rows->0 as row from public.meta_daily_coverage
  where connection_id='cc000000-0000-4000-8000-000000000151'
    and level='campaign' and date=current_date-1
)
update public.meta_daily_coverage c set currency='USD',
  rows=jsonb_build_array(
    (c.rows->0) || jsonb_build_object('spend','30'),
    second_row.row || jsonb_build_object('spend','1'))
from second_row
where c.connection_id='cc000000-0000-4000-8000-000000000151'
  and c.level='campaign' and c.date=current_date-2;
update public.meta_daily_coverage set currency='USD',
  rows=jsonb_build_array((rows->0) || jsonb_build_object('spend','1'))
where connection_id='cc000000-0000-4000-8000-000000000151'
  and level='campaign' and date=current_date-1;
select is(public.chat_ranking('cc000000-0000-4000-8000-000000000151',
  'campaign','spend',current_date-2,current_date-1,null,'desc',20,false)
  #>>'{values,0,value}','30','H-E1-211: campaña parcial tiene el valor mayor');
select is(public.chat_ranking('cc000000-0000-4000-8000-000000000151',
  'campaign','spend',current_date-2,current_date-1,null,'desc',20,false)
  #>>'{values,0,composition,partial}','true',
  'H-E1-211: primera campaña es parcial');
select is(public.chat_ranking('cc000000-0000-4000-8000-000000000151',
  'campaign','spend',current_date-2,current_date-1,null,'desc',20,false)
  #>>'{values,1,composition,partial}','false',
  'H-E1-211: última campaña es completa');
select is(public.chat_ranking('cc000000-0000-4000-8000-000000000151',
  'campaign','spend',current_date-2,current_date-1,null,'desc',20,false)
  #>>'{composition,partial}','true',
  'H-E1-211: el resultado conserva parcialidad de la primera campaña');
select is(public.chat_ranking('cc000000-0000-4000-8000-000000000151',
  'campaign','spend',current_date-2,current_date-1,null,'desc',20,true)
  #>'{extra,trends,a2000000-0000-4000-8000-000000000001}',
  (select jsonb_agg(jsonb_build_object('day',v->>'day','value',v->>'value',
    'absence',v->>'absence') order by v->>'day')
   from jsonb_array_elements(public.chat_daily_series(
     'cc000000-0000-4000-8000-000000000151',
     'a2000000-0000-4000-8000-000000000001','spend',
     current_date-2,current_date-1,null)->'values') v),
  'H-E1-211: tendencia de campaña parcial coincide con la serie diaria');
select is(public.chat_ranking('cc000000-0000-4000-8000-000000000151',
  'campaign','spend',current_date-2,current_date-1,null,'desc',20,true)
  #>'{extra,trends,a2000000-0000-4000-8000-000000000002}',
  (select jsonb_agg(jsonb_build_object('day',v->>'day','value',v->>'value',
    'absence',v->>'absence') order by v->>'day')
   from jsonb_array_elements(public.chat_daily_series(
     'cc000000-0000-4000-8000-000000000151',
     'a2000000-0000-4000-8000-000000000002','spend',
     current_date-2,current_date-1,null)->'values') v),
  'H-E1-211: tendencia de campaña completa coincide con la serie diaria');
select is(public.chat_ranking('cc000000-0000-4000-8000-000000000151',
  'campaign','ctr',current_date-2,current_date-1,null,'desc',20,true)
  #>'{extra,trends,a2000000-0000-4000-8000-000000000001}',
  'null'::jsonb,
  'H-E1-211: sin CTR diario informado, tendencia nula aunque tasa sea calculable');

select 1 from worker_api.mark_needs_reauth(
  'aaaaaaaa-0000-4000-8000-000000000151','c0a00000-0000-4000-8000-000000000151',
  'cc000000-0000-4000-8000-000000000151',0,'authentication','Fallo sintético');
select is((select written from worker_api.record_query(
  'aaaaaaaa-0000-4000-8000-000000000151','c0a00000-0000-4000-8000-000000000151',
  'fa000000-0000-4000-8000-000000000157','cc000000-0000-4000-8000-000000000151',
  0,'Pregunta sintética','{}','not_answered','connection_not_active',12,'modelo_sintetico',null)),true,
  'T-65: needs_reauth permite solo abstención por conexión inactiva');
select is((select written from worker_api.record_query(
  'aaaaaaaa-0000-4000-8000-000000000151','c0a00000-0000-4000-8000-000000000151',
  'fa000000-0000-4000-8000-000000000158','cc000000-0000-4000-8000-000000000151',
  0,'Pregunta sintética','{}','answered',null,12,'modelo_sintetico',null)),false,
  'T-65: needs_reauth descarta respuesta afirmativa');

select 1 from worker_api.begin_disconnect(
  'aaaaaaaa-0000-4000-8000-000000000151','c0a00000-0000-4000-8000-000000000151',
  'cc000000-0000-4000-8000-000000000151');
select is((select written from worker_api.record_query(
  'aaaaaaaa-0000-4000-8000-000000000151','c0a00000-0000-4000-8000-000000000151',
  'fa000000-0000-4000-8000-000000000156','cc000000-0000-4000-8000-000000000151',
  0,'Consulta tardía','{}','answered',null,12,'modelo_sintetico',null)),false,
  'T-02: desconexión descarta registro tardío');
select is((select count(*)::int from public.chat_query_records where id =
  'fa000000-0000-4000-8000-000000000156'),0,
  'T-02: la escritura tardía no deja fila');
select is(worker_api.purge_connection(
  'aaaaaaaa-0000-4000-8000-000000000151','c0a00000-0000-4000-8000-000000000151',
  'cc000000-0000-4000-8000-000000000151'),true,'T-06: purga procede');
select is((select count(*)::int from public.chat_query_records where connection_id =
  'cc000000-0000-4000-8000-000000000151'),0,
  'T-06: purga borra registros de conexión');
select is((select count(*)::int from public.chat_query_records where id =
  'fa000000-0000-4000-8000-000000000154'),1,
  'T-06: purga conserva registro sin conexión');
select is(worker_api.purge_connection(
  'aaaaaaaa-0000-4000-8000-000000000151','c0a00000-0000-4000-8000-000000000151',
  'cc000000-0000-4000-8000-000000000151'),false,'T-06: purga repetida es false');

rollback;
