-- M25a (H-E1-231): correcciones de la revisión de código sobre 0018, sin editarla.
--
-- 1. private.chat_entity_days resolvía el nivel de la entidad con la cobertura más reciente
--    que la contiene en `entities`. Una cobertura de anuncios también lista campañas y
--    conjuntos, así que una campaña podía buscarse entre filas de anuncios y salir sin datos.
--    Ahora el nivel es el propio de la entidad (`level` de su elemento en `entities`).
-- 2. public.chat_action_types tomaba moneda, zona horaria y nombre de la primera fecha pedida,
--    que puede no estar observada, y contaba días sin fila con la cobertura del nivel y no con
--    la de la entidad consultada.
--
-- Solo `create or replace` con la misma firma: los privilegios de 0018 se conservan.

create or replace function private.chat_entity_days(
  p_connection_id uuid, p_entity_ref uuid, p_from date, p_to date
) returns table(day date, level text, entity_name text, parent_ref uuid,
  row_data jsonb, presence text, currency text, timezone text,
  fetched_at timestamptz, captured_partial boolean, temporal_status text,
  attribution_ref text)
language plpgsql stable security invoker set search_path = '' as $$
declare v_level text;
begin
  perform private.chat_assert_period(p_from,p_to);
  if p_connection_id is null or p_entity_ref is null then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;
  select e->>'level' into v_level from public.meta_daily_coverage c
    cross join lateral pg_catalog.jsonb_array_elements(c.entities) e
   where c.connection_id = p_connection_id and e->>'entity_ref' = p_entity_ref::text
     and e->>'level' in ('account','campaign','adset','ad')
   order by c.date desc limit 1;
  if not found then return; end if;
  return query
  select d.day, v_level, e.entity->>'name', (e.entity->>'parent_ref')::uuid,
    r.row_data,
    case when c.date is null then 'no_observado'
         when r.row_data is null then 'sin_fila_reportada'
         else 'con_datos' end,
    c.currency, c.timezone, c.fetched_at,
    coalesce(c.captured_before_day_end,false),
    case when c.date is null then null
         when pg_catalog.statement_timestamp() < ((d.day + 1)::timestamp at time zone c.timezone)
           then 'abierto' else 'cerrado' end,
    private.chat_attribution_ref(coalesce(r.row_data->'attribution',e.entity->'attribution'))
  from (select p_from + i as day from pg_catalog.generate_series(0,p_to-p_from) i) d
  left join public.meta_daily_coverage c
    on c.connection_id = p_connection_id and c.level = v_level and c.date = d.day
  left join lateral (
    select x as entity from pg_catalog.jsonb_array_elements(coalesce(c.entities,'[]'::jsonb)) x
     where x->>'entity_ref' = p_entity_ref::text limit 1
  ) e on true
  left join lateral (
    select x as row_data from pg_catalog.jsonb_array_elements(coalesce(c.rows,'[]'::jsonb)) x
     where x->>'entity_ref' = p_entity_ref::text limit 1
  ) r on true;
end;
$$;

create or replace function public.chat_action_types(
  p_connection_id uuid,p_entity_ref uuid,p_from date,p_to date
) returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  d record; item record; c jsonb; v jsonb; vals jsonb := '[]'::jsonb;
  scope jsonb; comp jsonb; found_entity boolean := false;
  v_action_days integer := 0; v_any_partial boolean := false;
  v_total integer; v_not_observed integer; v_no_row integer;
  v_open integer; v_captured_partial integer;
begin
  perform private.chat_assert_period(p_from,p_to);
  if p_connection_id is null or p_entity_ref is null then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;
  -- Metadatos de una fila observada: la primera fecha pedida puede no tener cobertura.
  select * into d from private.chat_entity_days(p_connection_id,p_entity_ref,p_from,p_to)
   order by (timezone is null), (entity_name is null), day limit 1;
  found_entity := found;
  if not found_entity then
    return private.chat_aggregate(p_connection_id,p_entity_ref,'action_count',
      p_from,p_to,'purchase','total');
  end if;
  scope := pg_catalog.jsonb_build_object('level',d.level,'entity_ref',p_entity_ref,
    'entity_name',d.entity_name,'period',pg_catalog.jsonb_build_object('from',p_from,'to',p_to),
    'period_a',null,'period_b',null,'period_defaulted',false,'entity_defaulted',false,
    'timezone',d.timezone,'currency',d.currency);
  comp := public.chat_coverage(p_connection_id,d.level,p_from,p_to)->'composition';
  -- Los días sin observar, sin fila, abiertos y parciales son los de la entidad consultada.
  select count(*)::integer,
         (count(*) filter (where presence = 'no_observado'))::integer,
         (count(*) filter (where presence = 'sin_fila_reportada'))::integer,
         (count(*) filter (where temporal_status = 'abierto'))::integer,
         (count(*) filter (where captured_partial))::integer
    into v_total,v_not_observed,v_no_row,v_open,v_captured_partial
    from private.chat_entity_days(p_connection_id,p_entity_ref,p_from,p_to);
  comp := comp || pg_catalog.jsonb_build_object(
    'days_total',v_total,'days_not_observed',v_not_observed,'days_no_row',v_no_row,
    'days_open',v_open,'days_captured_partial',v_captured_partial);
  for item in
    select action_type from (
      select distinct a->>'action_type' as action_type
      from public.meta_daily_coverage cov
      cross join lateral pg_catalog.jsonb_array_elements(cov.rows) r
      cross join lateral pg_catalog.jsonb_array_elements(coalesce(r->'actions','[]'::jsonb)) a
      where cov.connection_id=p_connection_id and cov.level=d.level
        and cov.date between p_from and p_to
        and r->>'entity_ref'=p_entity_ref::text and a->>'variant'='value'
    ) types order by action_type collate "C"
  loop
    c := private.chat_aggregate(p_connection_id,p_entity_ref,'action_count',
      p_from,p_to,item.action_type,'total');
    v := private.chat_aggregate(p_connection_id,p_entity_ref,'action_value',
      p_from,p_to,item.action_type,'total');
    if c->>'status'='ok' or v->>'status'='ok' then
      vals := vals || pg_catalog.jsonb_build_array(
        coalesce(c#>'{values,0}',v#>'{values,0}') || pg_catalog.jsonb_build_object(
          'path_key','action_count','metric','action_count','unit','count','currency',null,
          'value',c#>>'{values,0,value}',
          'absence',case when c->>'status'='ok' then null
            when c->>'reason'='data_absent' then 'no_informado' else 'no_calculable' end,
          'composition',c->'composition',
          'captured_partial',(c#>>'{composition,days_captured_partial}')::integer>0));
      vals := vals || pg_catalog.jsonb_build_array(
        coalesce(v#>'{values,0}',c#>'{values,0}') || pg_catalog.jsonb_build_object(
          'path_key','action_value','metric','action_value','unit','money',
          'currency',d.currency,'value',v#>>'{values,0,value}',
          'absence',case when v->>'status'='ok' then null
            when v->>'reason'='data_absent' then 'no_informado' else 'no_calculable' end,
          'composition',v->'composition',
          'captured_partial',(v#>>'{composition,days_captured_partial}')::integer>0));
    end if;
    if (c#>>'{composition,partial}')::boolean or (v#>>'{composition,partial}')::boolean then
      v_any_partial := true;
    end if;
  end loop;
  select count(distinct cov.date)::integer into v_action_days
    from public.meta_daily_coverage cov
    cross join lateral pg_catalog.jsonb_array_elements(cov.rows) r
    cross join lateral pg_catalog.jsonb_array_elements(coalesce(r->'actions','[]'::jsonb)) a
   where cov.connection_id=p_connection_id and cov.level=d.level
     and cov.date between p_from and p_to and r->>'entity_ref'=p_entity_ref::text
     and a->>'variant'='value' and (a->>'count' is not null or a->>'value' is not null);
  comp := comp || pg_catalog.jsonb_build_object(
    'days_with_value',v_action_days,
    'days_metric_missing',(comp->>'days_total')::integer -
      (comp->>'days_not_observed')::integer - (comp->>'days_no_row')::integer - v_action_days,
    'partial',v_any_partial or v_action_days < (comp->>'days_total')::integer
      or (comp->>'days_open')::integer>0 or (comp->>'days_captured_partial')::integer>0);
  return pg_catalog.jsonb_build_object('status',case when vals='[]'::jsonb then 'not_calculable' else 'ok' end,
    'reason',case when vals='[]'::jsonb then 'data_absent' else null end,
    'scope',scope,'values',vals,'composition',comp,'extra','{}'::jsonb);
end;
$$;
