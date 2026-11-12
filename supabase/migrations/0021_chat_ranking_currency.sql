-- M25a (H-E1-233): corrección aditiva de chat_ranking sobre 0019, sin editarla.
--
-- La moneda de la entidad (entity_currency, entity_currencies) se filtraba por raw.raw_value,
-- el campo diario cpc/cpm/ctr de Meta. Pero CTR, CPC y CPM del ranking se recalculan desde las
-- bases (clics, gasto, impresiones). Si Meta informa las bases y omite el campo diario, la tasa
-- se calculaba con moneda nula y sin detectar monedas distintas entre los días que aportan.
-- Ahora la moneda se evalúa sobre las mismas filas que aportan al valor (has_value).
--
-- Solo `create or replace` con la misma firma; los privilegios se reafirman igual que en 0019.
create or replace function public.chat_ranking(
  p_connection_id uuid,p_level text,p_metric text,p_from date,p_to date,
  p_action_type text default null,p_order text default 'desc',p_limit integer default 10,
  p_include_trend boolean default false
) returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  v_connection public.integration_connections;
  item record;
  vals jsonb := '[]'::jsonb;
  trends jsonb := '{}'::jsonb;
  comp jsonb;
  result_comp jsonb;
  list_count integer := 0;
  excluded_count integer := 0;
  displayed integer := 0;
  known_attr text;
  mixed boolean := false;
  v_unit text;
  v_status text := 'ok';
  v_reason text;
begin
  perform private.chat_assert_period(p_from,p_to);
  perform private.chat_assert_metric(p_metric,p_action_type);
  if p_connection_id is null or p_level not in ('account','campaign','adset','ad')
    or p_order not in ('asc','desc') or p_limit not between 1 and 20
    or p_include_trend is null then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;
  select c.* into v_connection from public.integration_connections c
   where c.id=p_connection_id and c.status in ('active','needs_reauth');
  if p_metric in ('reach','frequency') then
    v_status := 'not_supported'; v_reason := 'metric_not_additive';
  elsif not found then
    v_status := 'not_found'; v_reason := 'entity_not_found';
  end if;
  result_comp := public.chat_coverage(p_connection_id,p_level,p_from,p_to)->'composition';
  v_unit := case when p_metric in ('spend','cpc','cpm','action_value') then 'money'
    when p_metric = 'ctr' then 'percent' else 'count' end;
  if v_status = 'ok' then
    for item in
      with period_cov as materialized (
        select c.* from public.meta_daily_coverage c
        where c.connection_id=p_connection_id and c.level=p_level
          and c.date between p_from and p_to
      ), refs as materialized (
        select distinct on ((e->>'entity_ref')::uuid)
          (e->>'entity_ref')::uuid as entity_ref,e->>'name' as entity_name,
          (e->>'parent_ref')::uuid as parent_ref
        from public.meta_daily_coverage c
        cross join lateral pg_catalog.jsonb_array_elements(c.entities) e
        where c.connection_id=p_connection_id and c.level=p_level and e->>'level'=p_level
        order by (e->>'entity_ref')::uuid,c.date desc
      ), raw as materialized (
        select c.date,c.currency,(r->>'entity_ref')::uuid as entity_ref,
          private.chat_metric_value(r,p_metric,p_action_type)::numeric as raw_value,
          case when p_metric='ctr' then (r->>'clicks')::numeric
            when p_metric in ('cpc','cpm') then (r->>'spend')::numeric end as num,
          case when p_metric in ('ctr','cpm') then (r->>'impressions')::numeric
            when p_metric='cpc' then (r->>'clicks')::numeric end as den,
          private.chat_attribution_ref(r->'attribution') as attr_ref,
          case when p_metric in ('ctr','cpc','cpm') then
            (case when p_metric='ctr' then (r->>'clicks')::numeric
              else (r->>'spend')::numeric end) is not null and
            (case when p_metric in ('ctr','cpm') then (r->>'impressions')::numeric
              else (r->>'clicks')::numeric end) is not null
            else private.chat_metric_value(r,p_metric,p_action_type) is not null end as has_value
        from period_cov c cross join lateral pg_catalog.jsonb_array_elements(c.rows) r
      ), globals as (
        select count(*)::integer as cov_days,
          count(*) filter (where pg_catalog.statement_timestamp() <
            ((date+1)::timestamp at time zone timezone))::integer as open_days,
          count(*) filter (where captured_before_day_end)::integer as partial_days,
          min(fetched_at) as fetched_min,max(fetched_at) as fetched_max,
          min(date) as observed_from,max(date) as observed_to,
          count(*) filter (where pg_catalog.jsonb_array_length(rows)=0)::integer as no_row_days,
          (select count(distinct r.date)::integer from raw r where
            case when p_metric in ('ctr','cpc','cpm') then r.num is not null and r.den is not null
            else r.raw_value is not null end) as any_value_days
        from period_cov
      ), agg as (
        select refs.entity_ref,refs.entity_name,refs.parent_ref,
          count(raw.entity_ref)::integer as row_days,
          count(*) filter (where case when p_metric in ('ctr','cpc','cpm') then
            raw.num is not null and raw.den is not null else raw.raw_value is not null end)::integer
            as value_days,
          sum(raw.raw_value) as sum_value,
          sum(raw.num) filter (where raw.den is not null) as sum_num,
          sum(raw.den) filter (where raw.num is not null) as sum_den,
          count(distinct raw.currency) filter (where raw.has_value)::integer
            as entity_currencies,
          min(raw.currency) filter (where raw.has_value) as entity_currency,
          count(distinct raw.attr_ref) filter (where raw.raw_value is not null
            and raw.attr_ref <> 'unknown')::integer as known_attrs,
          min(raw.attr_ref) filter (where raw.raw_value is not null
            and raw.attr_ref <> 'unknown') as known_attr,
          bool_or(raw.attr_ref='unknown' and raw.raw_value is not null) as has_unknown
        from refs left join raw on raw.entity_ref=refs.entity_ref
        group by refs.entity_ref,refs.entity_name,refs.parent_ref
      ), calc as (
        select a.*,g.*,
          case when a.value_days=0 or (v_unit='money' and a.entity_currencies>1)
            or (p_metric in ('action_count','action_value') and a.known_attrs>1)
            or (p_metric in ('ctr','cpc','cpm') and coalesce(a.sum_den,0)=0) then null::numeric
            when p_metric='ctr' then pg_catalog.round(100*a.sum_num/a.sum_den,6)
            when p_metric='cpc' then pg_catalog.round(a.sum_num/a.sum_den,6)
            when p_metric='cpm' then pg_catalog.round(1000*a.sum_num/a.sum_den,6)
            else a.sum_value end as value,
          case when p_metric in ('action_count','action_value') then
            case when a.has_unknown then 'unknown' else a.known_attr end end as attribution_ref
        from agg a cross join globals g
      )
      select * from calc
      order by case when p_order='desc' then value end desc nulls last,
        case when p_order='asc' then value end asc nulls last,entity_ref
    loop
      if item.value is not null then
        list_count := list_count + 1;
        result_comp := result_comp || pg_catalog.jsonb_build_object(
          'days_with_value',item.any_value_days,
          'days_metric_missing',item.cov_days-item.any_value_days-item.no_row_days,
          'days_no_row',item.no_row_days,
          'partial',coalesce((result_comp->>'partial')::boolean,false)
            or item.any_value_days<p_to-p_from+1 or item.open_days>0
            or item.partial_days>0);
        if item.attribution_ref not in ('unknown')
          and item.attribution_ref is not null then
          if known_attr is not null and known_attr <> item.attribution_ref then
            mixed := true;
          end if;
          known_attr := item.attribution_ref;
        end if;
        comp := pg_catalog.jsonb_build_object('days_total',p_to-p_from+1,
          'days_with_value',item.value_days,'days_metric_missing',item.row_days-item.value_days,
          'days_no_row',item.cov_days-item.row_days,
          'days_not_observed',p_to-p_from+1-item.cov_days,
          'days_open',item.open_days,'days_captured_partial',item.partial_days,
          'fetched_at_min',case when item.fetched_min is null then null else
            pg_catalog.to_char(item.fetched_min at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') end,
          'fetched_at_max',case when item.fetched_max is null then null else
            pg_catalog.to_char(item.fetched_max at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') end,
          'observed_from',item.observed_from,'observed_to',item.observed_to,
          'partial',item.value_days<p_to-p_from+1 or item.open_days>0 or item.partial_days>0);
        if displayed < p_limit then
          vals := vals || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
            'path_key','entity','metric',p_metric,'unit',v_unit,
            'currency',case when v_unit='money' then item.entity_currency else null end,
            'action_type',p_action_type,'attribution_ref',item.attribution_ref,
            'period',pg_catalog.jsonb_build_object('from',p_from,'to',p_to),
            'period_a',null,'period_b',null,'day',null,'entity_ref',item.entity_ref,
            'entity_name',item.entity_name,'parent_ref',item.parent_ref,
            'segment_primary',null,'segment_secondary',null,
            'value',item.value::text,'absence',null,'presence',null,
            'temporal_status',null,'captured_partial',item.partial_days>0,
            'fetched_at',null,'composition',comp));
          displayed := displayed + 1;
        end if;
        if (comp->>'partial')::boolean then
          result_comp := result_comp || pg_catalog.jsonb_build_object('partial',true);
        end if;
      else
        excluded_count := excluded_count + 1;
      end if;
    end loop;
    if list_count=0 then v_status:='not_calculable';v_reason:='data_absent';end if;
  end if;
  if p_include_trend and displayed>0 then
    with selected as materialized (
      select (v->>'entity_ref')::uuid as entity_ref
      from pg_catalog.jsonb_array_elements(vals) v
      where v->>'path_key'='entity'
    ), period_cov as materialized (
      select c.date,c.rows from public.meta_daily_coverage c
      where c.connection_id=p_connection_id and c.level=p_level
        and c.date between p_from and p_to
    ), raw as materialized (
      select distinct on (c.date,s.entity_ref)
        c.date as day,s.entity_ref,
        private.chat_metric_value(x.row_data,p_metric,p_action_type) as metric_value
      from period_cov c
      cross join lateral pg_catalog.jsonb_array_elements(c.rows)
        with ordinality x(row_data,ord)
      join selected s on s.entity_ref=(x.row_data->>'entity_ref')::uuid
      order by c.date,s.entity_ref,x.ord
    ), per_day as (
      select s.entity_ref,p_from+i as day,r.metric_value,
        case when r.metric_value is not null then null
          when c.date is null then 'no_observado'
          when r.entity_ref is null then 'sin_fila_reportada'
          else 'no_informado' end as absence
      from selected s
      cross join pg_catalog.generate_series(0,p_to-p_from) i
      left join period_cov c on c.date=p_from+i
      left join raw r on r.day=p_from+i and r.entity_ref=s.entity_ref
    ), per_entity as (
      select entity_ref,
        case when count(metric_value)>0 then
          pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
            'day',day::text,'value',metric_value,'absence',absence)
            order by day)
        else null end as trend
      from per_day group by entity_ref
    )
    select coalesce(pg_catalog.jsonb_object_agg(entity_ref::text,trend),'{}'::jsonb)
      into trends from per_entity;
  end if;
  if v_status='ok' then
    vals := vals || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object('path_key','list_count','metric','list_count',
        'unit','count','currency',null,'action_type',null,'attribution_ref',null,
        'period',pg_catalog.jsonb_build_object('from',p_from,'to',p_to),
        'period_a',null,'period_b',null,'day',null,'entity_ref',null,'entity_name',null,
        'parent_ref',null,'segment_primary',null,'segment_secondary',null,
        'value',list_count::text,'absence',null,'presence',null,'temporal_status',null,
        'captured_partial',false,'fetched_at',null,'composition',null),
      pg_catalog.jsonb_build_object('path_key','excluded_count','metric','excluded_count',
        'unit','count','currency',null,'action_type',null,'attribution_ref',null,
        'period',pg_catalog.jsonb_build_object('from',p_from,'to',p_to),
        'period_a',null,'period_b',null,'day',null,'entity_ref',null,'entity_name',null,
        'parent_ref',null,'segment_primary',null,'segment_secondary',null,
        'value',excluded_count::text,'absence',null,'presence',null,'temporal_status',null,
        'captured_partial',false,'fetched_at',null,'composition',null));
  end if;
  return pg_catalog.jsonb_build_object('status',v_status,'reason',v_reason,
    'scope',pg_catalog.jsonb_build_object('level',p_level,'entity_ref',null,'entity_name',null,
      'period',pg_catalog.jsonb_build_object('from',p_from,'to',p_to),'period_a',null,'period_b',null,
      'period_defaulted',false,'entity_defaulted',false,
      'timezone',v_connection.timezone,'currency',v_connection.currency),
    'values',case when v_status='ok' then vals else '[]'::jsonb end,
    'composition',result_comp,
    'extra',pg_catalog.jsonb_build_object('attribution_mixed',mixed,
      'trends',case when p_include_trend then trends else null end));
end;
$$;
revoke all on function public.chat_ranking(uuid,text,text,date,date,text,text,integer,boolean)
  from public,anon,authenticated,service_role,praxa_integrations;
grant execute on function public.chat_ranking(uuid,text,text,date,date,text,text,integer,boolean)
  to authenticated;

