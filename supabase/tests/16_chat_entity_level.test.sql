-- M25a (H-E1-231): nivel propio de la entidad y tipos de resultado con días sin fila. Datos sintéticos.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values ('aaaaaaaa-0000-4000-8000-000000000161', '00000000-0000-0000-0000-000000000000',
        'authenticated','authenticated','chat.tres@praxa.test','x',now(),now(),now());
insert into public.companies (id,name,owner_id) values
  ('c0a00000-0000-4000-8000-000000000161','Chat sintético tres','aaaaaaaa-0000-4000-8000-000000000161');
select 1 from worker_api.create_pending_connection(
  'aaaaaaaa-0000-4000-8000-000000000161','c0a00000-0000-4000-8000-000000000161',
  'cc000000-0000-4000-8000-000000000161','negocio_sintetico','AAAA','AAAAAAAAAAAAAAAA',
  'AAAAAAAAAAAAAAAAAAAAAA==',1,'system_user','app_sintetica','{ads_read}',null);
select 1 from worker_api.confirm_connection(
  'aaaaaaaa-0000-4000-8000-000000000161','c0a00000-0000-4000-8000-000000000161',
  'cc000000-0000-4000-8000-000000000161','act_90000161','USD','UTC',true);
select 1 from worker_api.start_sync_run(
  'aaaaaaaa-0000-4000-8000-000000000161','c0a00000-0000-4000-8000-000000000161',
  'cc000000-0000-4000-8000-000000000161',0,
  'e0000000-0000-4000-8000-000000000161',repeat('f',64),
  current_date-2,current_date-1,
  '{"lookbackDays":7,"maxWindowDays":7,"maxPagesPerLevel":2,"maxMetadataPages":2,"maxEntities":20,"maxPayloadBytes":100000,"maxDurationMs":300000,"finalizationReserveMs":10000,"leaseSeconds":310,"maxRetries":0,"retryDelayMs":0}');

-- Cobertura de campañas del día -2: dos campañas listadas, solo la 201 con fila.
select 1 from worker_api.publish_snapshot(
  'aaaaaaaa-0000-4000-8000-000000000161','c0a00000-0000-4000-8000-000000000161',
  'cc000000-0000-4000-8000-000000000161',0,
  'e0000000-0000-4000-8000-000000000161',repeat('f',64),
  '5a000000-0000-4000-8000-000000000161','campaign',clock_timestamp(),1,1,
  jsonb_build_object('entities',jsonb_build_array(
    jsonb_build_object('level','account','external_id','act_90000161','parent_external_id',null,
      'name','Cuenta sintética','effective_status',null,'objective',null,
      'metadata_fetched_at',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'attribution','{"known":false,"report_time":"impression","unified":true,"settings":[]}'::jsonb),
    jsonb_build_object('level','campaign','external_id','201','parent_external_id','act_90000161',
      'name','Campaña uno','effective_status','ACTIVE','objective','OUTCOME_SALES',
      'metadata_fetched_at',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'attribution','{"known":false,"report_time":"impression","unified":true,"settings":[]}'::jsonb),
    jsonb_build_object('level','campaign','external_id','202','parent_external_id','act_90000161',
      'name','Campaña dos','effective_status','ACTIVE','objective','OUTCOME_SALES',
      'metadata_fetched_at',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'attribution','{"known":false,"report_time":"impression","unified":true,"settings":[]}'::jsonb)),
    'days',jsonb_build_array(jsonb_build_object(
      'date',(current_date-2)::text,'level','campaign','external_id','201',
      'spend','4.00','impressions','40','reach',null,'clicks','4','inline_link_clicks',null,
      'ctr',null,'cpc',null,'cpm',null,'frequency',null,
      'actions','[{"action_type":"purchase","variant":"value","count":"2","value":"6.00"}]'::jsonb))));

-- Cobertura de anuncios de la misma ventana (-2 y -1): lista también la campaña 201.
-- publish_snapshot escribe cobertura del nivel para todos los días de la ventana.
select 1 from worker_api.publish_snapshot(
  'aaaaaaaa-0000-4000-8000-000000000161','c0a00000-0000-4000-8000-000000000161',
  'cc000000-0000-4000-8000-000000000161',0,
  'e0000000-0000-4000-8000-000000000161',repeat('f',64),
  '5a000000-0000-4000-8000-000000000162','ad',clock_timestamp(),1,1,
  jsonb_build_object('entities',jsonb_build_array(
    jsonb_build_object('level','account','external_id','act_90000161','parent_external_id',null,
      'name','Cuenta sintética','effective_status',null,'objective',null,
      'metadata_fetched_at',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'attribution','{"known":false,"report_time":"impression","unified":true,"settings":[]}'::jsonb),
    jsonb_build_object('level','campaign','external_id','201','parent_external_id','act_90000161',
      'name','Campaña uno','effective_status','ACTIVE','objective','OUTCOME_SALES',
      'metadata_fetched_at',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'attribution','{"known":false,"report_time":"impression","unified":true,"settings":[]}'::jsonb),
    jsonb_build_object('level','adset','external_id','301','parent_external_id','201',
      'name','Conjunto uno','effective_status','ACTIVE','objective',null,
      'metadata_fetched_at',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'attribution','{"known":false,"report_time":"impression","unified":true,"settings":[]}'::jsonb),
    jsonb_build_object('level','ad','external_id','401','parent_external_id','301',
      'name','Anuncio uno','effective_status','ACTIVE','objective',null,
      'metadata_fetched_at',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'attribution','{"known":false,"report_time":"impression","unified":true,"settings":[]}'::jsonb)),
    'days',jsonb_build_array(jsonb_build_object(
      'date',(current_date-1)::text,'level','ad','external_id','401',
      'spend','9.00','impressions','90','reach',null,'clicks','9','inline_link_clicks',null,
      'ctr',null,'cpc',null,'cpm',null,'frequency',null,
      'actions','[]'::jsonb))));

-- Sin la corrección, la campaña podía buscarse entre las filas de anuncios.
select is((select (public.chat_total(
  'cc000000-0000-4000-8000-000000000161',entity_ref,'spend',current_date-2,current_date-1,null)
  #>> '{values,0,value}') from public.meta_entities where connection_id =
  'cc000000-0000-4000-8000-000000000161' and level='campaign' and external_id='201'),
  '4.00','H-E1-231: la campaña usa sus filas de campaña aunque haya una cobertura de anuncios más reciente');
select is((select (public.chat_total(
  'cc000000-0000-4000-8000-000000000161',entity_ref,'spend',current_date-2,current_date-1,null)
  #>> '{composition,days_with_value}') from public.meta_entities where connection_id =
  'cc000000-0000-4000-8000-000000000161' and level='campaign' and external_id='201'),
  '1','H-E1-231: un día con valor');
select is((select (public.chat_total(
  'cc000000-0000-4000-8000-000000000161',entity_ref,'spend',current_date-2,current_date-1,null)
  #>> '{composition,days_not_observed}') from public.meta_entities where connection_id =
  'cc000000-0000-4000-8000-000000000161' and level='campaign' and external_id='201'),
  '0','H-E1-231: la cobertura se escribe para toda la ventana, así que ningún día queda sin observar');
select is((select (public.chat_total(
  'cc000000-0000-4000-8000-000000000161',entity_ref,'spend',current_date-2,current_date-1,null)
  #>> '{composition,days_no_row}') from public.meta_entities where connection_id =
  'cc000000-0000-4000-8000-000000000161' and level='campaign' and external_id='201'),
  '1','H-E1-231: el día -1 está cubierto pero la campaña no tiene fila');

-- Tipos de resultado: la primera fecha pedida (-3) no tiene cobertura.
select is((select (public.chat_action_types(
  'cc000000-0000-4000-8000-000000000161',entity_ref,current_date-3,current_date-2)
  #>> '{scope,timezone}') from public.meta_entities where connection_id =
  'cc000000-0000-4000-8000-000000000161' and level='campaign' and external_id='201'),
  'UTC','H-E1-231: la zona horaria sale de una fila observada, no de la primera fecha');
select is((select (public.chat_action_types(
  'cc000000-0000-4000-8000-000000000161',entity_ref,current_date-3,current_date-2)
  #>> '{values,1,currency}') from public.meta_entities where connection_id =
  'cc000000-0000-4000-8000-000000000161' and level='campaign' and external_id='201'),
  'USD','H-E1-231: el valor monetario conserva su moneda');
select is((select (public.chat_action_types(
  'cc000000-0000-4000-8000-000000000161',entity_ref,current_date-3,current_date-2)
  #>> '{composition,days_not_observed}') from public.meta_entities where connection_id =
  'cc000000-0000-4000-8000-000000000161' and level='campaign' and external_id='201'),
  '1','H-E1-231: un día sin observar');

-- La campaña 202 está listada el día -2 pero sin fila, aunque la 201 sí la tiene.
select is((select (public.chat_action_types(
  'cc000000-0000-4000-8000-000000000161',entity_ref,current_date-3,current_date-2)
  #>> '{composition,days_no_row}') from public.meta_entities where connection_id =
  'cc000000-0000-4000-8000-000000000161' and level='campaign' and external_id='202'),
  '1','H-E1-231: el día sin fila de la entidad se informa como sin fila');
select is((select (public.chat_action_types(
  'cc000000-0000-4000-8000-000000000161',entity_ref,current_date-3,current_date-2)
  #>> '{composition,days_metric_missing}') from public.meta_entities where connection_id =
  'cc000000-0000-4000-8000-000000000161' and level='campaign' and external_id='202'),
  '0','H-E1-231: no se confunde con una métrica faltante');

select * from finish();
rollback;
