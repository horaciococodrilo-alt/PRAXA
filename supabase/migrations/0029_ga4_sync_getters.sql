-- M16f H-E1-266: getters de calidad y cohortes. No modifica migraciones aplicadas.
-- Las lecturas conservan SECURITY INVOKER y RLS de las tablas públicas.

-- Devuelve solo calidad visible bajo RLS y marca diferencia con la zona vigente.
create function public.ga4_quality_with_zone(p_quality_id uuid, p_connection_id uuid)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select (to_jsonb(q) - 'company_id' - 'connection_id') ||
    jsonb_build_object('zona_distinta', q.time_zone is distinct from s.time_zone)
  from public.ga4_report_quality q
  join public.ga4_sync_status s on s.connection_id = q.connection_id
    and s.company_id = q.company_id
  where q.quality_id = p_quality_id and q.connection_id = p_connection_id
$$;
revoke all on function public.ga4_quality_with_zone(uuid, uuid)
  from public, anon, authenticated, service_role, praxa_integrations;
grant execute on function public.ga4_quality_with_zone(uuid, uuid) to authenticated;

create or replace function public.get_ga4_traffic(p_connection_id uuid, p_from date, p_to date)
returns table (day date, sessions bigint, active_users bigint, new_users bigint,
  meta_visits bigint, provisional boolean, traffic_quality jsonb, source_quality jsonb)
language sql stable security invoker set search_path = ''
as $$
  select t.day, t.sessions, t.active_users, t.new_users, t.meta_visits, t.provisional,
    public.ga4_quality_with_zone(q.quality_id, q.connection_id),
    public.ga4_quality_with_zone(sq.quality_id, sq.connection_id)
  from public.ga4_traffic_daily t
  join public.ga4_report_quality q on q.quality_id = t.traffic_quality_id
    and q.connection_id = t.connection_id and q.company_id = t.company_id
  left join public.ga4_report_quality sq on sq.quality_id = t.source_quality_id
    and sq.connection_id = t.connection_id and sq.company_id = t.company_id
  where t.connection_id = p_connection_id and t.day between p_from and p_to
  union all
  select null::date, null::bigint, null::bigint, null::bigint,
    null::bigint, false,
    public.ga4_quality_with_zone(q.quality_id, q.connection_id),
    public.ga4_quality_with_zone(sq.quality_id, sq.connection_id)
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

create or replace function public.get_ga4_sources(p_connection_id uuid, p_from date, p_to date)
returns table (day date, source text, medium text, sessions bigint, quality jsonb)
language sql stable security invoker set search_path = ''
as $$
  select d.day, d.source, d.medium, d.sessions,
    public.ga4_quality_with_zone(q.quality_id, q.connection_id)
  from public.ga4_source_daily d
  join public.ga4_report_quality q on q.quality_id = d.quality_id
    and q.connection_id = d.connection_id and q.company_id = d.company_id
  where d.connection_id = p_connection_id and d.day between p_from and p_to
  union all
  select null::date, null::text, null::text, null::bigint,
    public.ga4_quality_with_zone(q.quality_id, q.connection_id)
  from public.ga4_report_quality q
  where q.connection_id = p_connection_id and q.report_id = 'ga4_trafico_fuente' and q.row_count = 0
    and q.window_from <= p_to and q.window_to >= p_from
    and not exists (select 1 from public.ga4_source_daily d
      where d.connection_id = q.connection_id and d.quality_id = q.quality_id
        and d.day between p_from and p_to)
  order by 1 nulls last, 2, 3
$$;

create or replace function public.get_ga4_funnel(p_connection_id uuid, p_from date, p_to date)
returns table (day date, event_name text, event_count bigint, quality jsonb)
language sql stable security invoker set search_path = ''
as $$
  select d.day, d.event_name, d.event_count,
    public.ga4_quality_with_zone(q.quality_id, q.connection_id)
  from public.ga4_funnel_daily d
  join public.ga4_report_quality q on q.quality_id = d.quality_id
    and q.connection_id = d.connection_id and q.company_id = d.company_id
  where d.connection_id = p_connection_id and d.day between p_from and p_to
  union all
  select null::date, null::text, null::bigint,
    public.ga4_quality_with_zone(q.quality_id, q.connection_id)
  from public.ga4_report_quality q
  where q.connection_id = p_connection_id and q.report_id = 'ga4_embudo' and q.row_count = 0
    and q.window_from <= p_to and q.window_to >= p_from
    and not exists (select 1 from public.ga4_funnel_daily d
      where d.connection_id = q.connection_id and d.quality_id = q.quality_id
        and d.day between p_from and p_to)
  order by 1 nulls last, 2
$$;

create or replace function public.get_ga4_items(p_connection_id uuid, p_from date, p_to date)
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
    public.ga4_quality_with_zone(q.quality_id, q.connection_id)
  from daily d
  join public.ga4_report_quality q on q.quality_id = d.quality_id
    and q.connection_id = d.connection_id and q.company_id = d.company_id
  left join public.tn_sync_status ts on ts.connection_id = d.tn_connection_id
  union all
  select null::date, null::uuid, null::uuid, null::text,
    null::bigint, null::bigint, null::bigint, null::bigint,
    public.ga4_quality_with_zone(q.quality_id, q.connection_id)
  from public.ga4_report_quality q
  where q.connection_id = p_connection_id and q.report_id = 'ga4_productos' and q.row_count = 0
    and q.window_from <= p_to and q.window_to >= p_from
    and not exists (select 1 from public.ga4_item_daily d
      where d.connection_id = q.connection_id and d.quality_id = q.quality_id
        and d.day between p_from and p_to)
  order by 1 nulls last, 5 desc, 2
$$;

create or replace function public.get_ga4_campaigns(p_connection_id uuid, p_from date, p_to date)
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
    public.ga4_quality_with_zone(q.quality_id, q.connection_id)
  from daily d join public.ga4_report_quality q on q.quality_id = d.quality_id
    and q.connection_id = d.connection_id and q.company_id = d.company_id
  union all
  select null::date, null::uuid, null::bigint,
    public.ga4_quality_with_zone(q.quality_id, q.connection_id)
  from public.ga4_report_quality q
  where q.connection_id = p_connection_id and q.report_id = 'ga4_campanias' and q.row_count = 0
    and q.window_from <= p_to and q.window_to >= p_from
    and not exists (select 1 from public.ga4_campaign_daily d
      where d.connection_id = q.connection_id and d.quality_id = q.quality_id
        and d.day between p_from and p_to)
  order by 1 nulls last, 3 desc
$$;

create or replace function public.get_ga4_cohorts(p_connection_id uuid, p_from date, p_to date)
returns table (cohort_month date, month_offset integer, cohort_size bigint,
  active bigint, size_hidden boolean, active_hidden boolean, provisional boolean,
  quality jsonb)
language sql stable security invoker set search_path = ''
as $$
  select c.cohort_month, c.month_offset, c.cohort_size, c.active,
    c.size_hidden, c.active_hidden, c.provisional,
    public.ga4_quality_with_zone(q.quality_id, q.connection_id)
  from public.ga4_visitor_cohorts c
  join public.ga4_report_quality q on q.quality_id = c.quality_id
    and q.connection_id = c.connection_id and q.company_id = c.company_id
  where c.connection_id = p_connection_id and c.cohort_month between p_from and p_to
  union all
  select null::date, null::integer, null::bigint, null::bigint,
    false, false, false, public.ga4_quality_with_zone(q.quality_id, q.connection_id)
  from public.ga4_report_quality q
  where q.connection_id = p_connection_id and q.report_id = 'ga4_cohortes' and q.row_count = 0
    and q.window_from <= p_to and q.window_to >= p_from
    and not exists (select 1 from public.ga4_visitor_cohorts c
      where c.connection_id = q.connection_id and c.quality_id = q.quality_id
        and c.cohort_month between p_from and p_to)
  order by 1 nulls last, 2
$$;

-- La variante de celdas recibe la fecha local y GA4_PROVISIONAL_DAYS desde el
-- servidor, para mantener esa constante en un solo lugar. Conserva el getter
-- histórico de tres argumentos para las lecturas ya publicadas.
create function public.get_ga4_cohorts(
  p_connection_id uuid, p_from date, p_to date,
  p_today date, p_max_offset integer, p_provisional_days integer)
returns table (cohort_month date, month_offset integer, cohort_size bigint,
  active bigint, size_hidden boolean, active_hidden boolean, provisional boolean,
  retention numeric, absence text, quality jsonb)
language plpgsql stable security invoker set search_path = ''
as $$
begin
  if p_connection_id is null or p_from is null or p_to is null or p_today is null
     or p_to < p_from
     or date_trunc('month', p_to) >= date_trunc('month', p_from) + interval '12 months'
     or p_max_offset is null or p_max_offset not between 0 and 11
     or p_provisional_days is null or p_provisional_days not between 0 and 30
  then raise exception 'praxa: argumento inválido' using errcode = '22023'; end if;

  return query
  with months as (
    select g.value::date as month_start
    from generate_series(date_trunc('month', p_from)::timestamp,
      date_trunc('month', p_to)::timestamp, interval '1 month') as g(value)
  ), cells as (
    select m.month_start, n.value as n,
      (m.month_start + n.value * 30) as range_start,
      ((m.month_start + interval '1 month')::date - 1 + n.value * 30) as range_end,
      q.quality_id, q.subject_to_thresholding, q.data_loss_from_other_row,
      q.data_truncation_reasons, q.sampling_metadatas, q.restricted_metrics,
      q.empty_reason, q.time_zone as quality_zone, s.time_zone as current_zone,
      c.cohort_size as cell_size, c.active as cell_active,
      c.size_hidden as cell_size_hidden, c.active_hidden as cell_active_hidden,
      c.provisional as cell_provisional,
      c0.cohort_size as known_size, c0.size_hidden as known_size_hidden
    from months m cross join generate_series(0, p_max_offset) as n(value)
    left join lateral (
      select x.* from public.ga4_report_quality x
      where x.connection_id = p_connection_id and x.report_id = 'ga4_cohortes'
        and x.report_version = 1 and x.window_from <= m.month_start
        and x.window_to >= m.month_start
      order by x.fetched_at desc limit 1
    ) q on true
    left join public.ga4_sync_status s on s.connection_id = p_connection_id
    left join public.ga4_visitor_cohorts c on c.connection_id = p_connection_id
      and c.cohort_month = m.month_start and c.month_offset = n.value
    left join public.ga4_visitor_cohorts c0 on c0.connection_id = p_connection_id
      and c0.cohort_month = m.month_start and c0.month_offset = 0
  ), projected as (
    select x.*,
      coalesce(x.cell_size, x.known_size) as visible_size,
      coalesce(x.cell_size_hidden, x.known_size_hidden, true) as hidden_size,
      coalesce(x.cell_active_hidden, x.known_size_hidden, false) as hidden_active,
      x.quality_id is not null and not coalesce(x.subject_to_thresholding, true)
        and not coalesce(x.data_loss_from_other_row, true)
        and coalesce(cardinality(x.data_truncation_reasons), 1) = 0
        and coalesce(jsonb_array_length(x.sampling_metadatas), 1) = 0
        and coalesce(jsonb_array_length(x.restricted_metrics), 1) = 0
        and x.empty_reason is null and x.quality_zone = x.current_zone as clean_quality
    from cells x
  ), classified as (
    select x.*,
      case
        when x.cell_active is not null then x.cell_active
        when x.cell_active_hidden or x.hidden_size then null::bigint
        when p_today > x.range_end + p_provisional_days and x.clean_quality
          then 0::bigint
        else null::bigint
      end as visible_active,
      case
        when x.cell_active_hidden or x.cell_size_hidden then 'menos_de_5'
        when x.cell_active is not null then null::text
        when p_today < x.range_start then 'aun_no_disponible'
        when x.quality_id is null then 'sin_cobertura'
        when x.hidden_size then 'menos_de_5'
        when p_today <= x.range_end + p_provisional_days or not x.clean_quality
          then 'desconocido'
        else null::text
      end as absence_reason
    from projected x
  )
  select x.month_start, x.n, x.visible_size, x.visible_active,
    x.hidden_size, x.hidden_active,
    case when p_today < x.range_start then false
         else coalesce(x.cell_provisional, false) or p_today <= x.range_end + p_provisional_days end,
    case when x.visible_size > 0 and x.visible_active is not null
      then round(x.visible_active::numeric / x.visible_size, 4) else null::numeric end,
    x.absence_reason,
    public.ga4_quality_with_zone(x.quality_id, p_connection_id)
  from classified x
  order by x.month_start, x.n;
end;
$$;
revoke all on function public.get_ga4_cohorts(uuid, date, date, date, integer, integer)
  from public, anon, authenticated, service_role, praxa_integrations;
grant execute on function public.get_ga4_cohorts(uuid, date, date, date, integer, integer)
  to authenticated;


