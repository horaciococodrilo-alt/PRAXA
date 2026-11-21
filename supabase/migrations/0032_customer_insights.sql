-- PRAXA 0032 — M27a: RFM, cohortes y propuestas de audiencias (snapshot agregado).
--
-- Un snapshot agregado vigente por conexión de Tiendanube y moneda (D-M27a-01). Se calcula en
-- SQL, con `numeric` exacto, dentro de la transacción que cierra un incremental completo; se
-- invalida (se borra) al iniciar o publicar una sincronización, al marcar una supresión de
-- privacidad, al borrar pedidos y al cambiar estado, generación, zona o moneda de la conexión.
-- Nunca se conserva un snapshot viejo para ocultar un fallo.
--
-- MATRIZ DE PRIVILEGIOS DE LOS OBJETOS NUEVOS (M27a §2; la prueba es 21_customer_insights)
--
--   objeto                                     | anon | authenticated  | rol de C | PUBLIC   | service_role
--   -------------------------------------------+------+----------------+----------+----------+-------------
--   public.tn_customer_insights                | —    | SELECT por RLS | —        | —        | —
--   public.get_tn_customer_insights            | —    | EXECUTE        | —        | revocado | —
--                                              |      | (INVOKER)      |          |          |
--   private.tn_* nuevos (cálculo, invalidación,| —    | —              | —        | revocado | —
--     triggers)                                |      |                |          |          |
--
-- Las columnas nuevas de `private.tn_orders` y `public.tn_sync_status` no cambian sus grants.
-- `worker_api.tn_start_sync`, `tn_publish_orders`, `tn_publish_catalog` y `tn_finish_sync` se
-- reemplazan con la MISMA firma (`create or replace` conserva sus grants): `worker-api.ts`, su
-- allowlist y sus casts no cambian. Cambia la forma interna de dos JSONB:
--   - cada pedido de `p_orders` suma `insights_amount`, `insights_amount_status`,
--     `insights_amount_definition`, `insights_identity_status` e `insights_lines_status`;
--   - `p_state` del catálogo suma `new_traversal` y `has_omitted_products`.
--
-- Las funciones de trigger son SECURITY DEFINER para invalidar sin importar qué rol escribe;
-- no se pueden llamar como RPC (devuelven `trigger`) y no tienen EXECUTE para nadie.
--
-- No se infieren estados históricos: las filas existentes quedan `unverified`/`unknown` y las
-- conexiones con sincronización existente se marcan para una relectura completa.

-- ---------------------------------------------------------------------------
-- Procedencia y calidad, privadas por pedido
-- ---------------------------------------------------------------------------

alter table private.tn_orders
  add column insights_amount            numeric,
  add column insights_amount_status     text not null default 'unverified',
  add column insights_amount_definition text,
  add column insights_identity_status   text not null default 'unverified',
  add column insights_lines_status      text not null default 'unverified';

alter table private.tn_orders
  add constraint tn_orders_insights_amount_status
    check (insights_amount_status in ('verified', 'unverified', 'incomplete', 'inconsistent')),
  add constraint tn_orders_insights_amount_definition
    check (insights_amount_definition is null
           or insights_amount_definition in ('tn_paid_current_observed_v1',
                                             'tn_paid_current_less_verified_refunds_v1')),
  add constraint tn_orders_insights_amount
    check ((insights_amount_status = 'verified' and insights_amount is not null and insights_amount >= 0
            and insights_amount_definition is not null)
           or (insights_amount_status <> 'verified' and insights_amount is null
               and insights_amount_definition is null)),
  add constraint tn_orders_insights_identity
    check (insights_identity_status in ('verified', 'absent', 'invalid', 'unverified')
           and (insights_identity_status = 'unverified'
                or (insights_identity_status = 'verified') = (external_customer_id is not null))),
  add constraint tn_orders_insights_lines
    check (insights_lines_status in ('complete', 'source_omitted', 'source_invalid', 'line_omitted', 'unverified'));

alter table public.tn_sync_status
  add column insights_catalog_status        text not null default 'unknown',
  add column insights_catalog_has_omissions boolean not null default false,
  add column insights_rebuild_pending       boolean not null default false,
  add column insights_rebuild_started       boolean not null default false;

alter table public.tn_sync_status
  add constraint tn_sync_status_insights_catalog
    check (insights_catalog_status in ('unknown', 'cycle_incomplete', 'omitted_items', 'complete')),
  add constraint tn_sync_status_insights_rebuild
    check (insights_rebuild_pending or not insights_rebuild_started);

-- Relectura completa de lo ya sincronizado y recorrido de catálogo nuevo desde la página 1.
update public.tn_sync_status
   set insights_rebuild_pending = true, catalog_next_page = null, catalog_traversal_started_at = null;

-- ---------------------------------------------------------------------------
-- Snapshot agregado
-- ---------------------------------------------------------------------------

create table public.tn_customer_insights (
  company_id    uuid not null,
  connection_id uuid not null,
  currency      text not null,
  generation    integer not null,
  ruleset       text not null,
  as_of_day     date not null,
  fetched_at    timestamptz not null,
  payload       jsonb not null,

  constraint tn_customer_insights_pkey primary key (connection_id, currency),
  constraint tn_customer_insights_connection_fkey
    foreign key (company_id, connection_id)
    references public.integration_connections (company_id, id) on delete cascade,
  constraint tn_customer_insights_currency check (currency ~ '^[A-Z]{3}$'),
  constraint tn_customer_insights_generation check (generation >= 0),
  constraint tn_customer_insights_ruleset check (ruleset = 'rfm_v1'),
  constraint tn_customer_insights_payload
    check (pg_catalog.jsonb_typeof(payload) = 'object'
           and payload->>'currency' = currency and payload->>'ruleset' = ruleset
           and payload->>'asOfDay' = as_of_day::text)
);

revoke all on public.tn_customer_insights from public, anon, authenticated, service_role, praxa_integrations;
alter table public.tn_customer_insights enable row level security;
alter table public.tn_customer_insights force row level security;

-- Membresía del JWT, conexión de Tiendanube ACTIVA y la misma generación del snapshot.
create policy tn_customer_insights_select_member
  on public.tn_customer_insights for select to authenticated
  using (private.is_company_member(company_id) and exists (
    select 1 from public.integration_connections c
     where c.id = tn_customer_insights.connection_id
       and c.company_id = tn_customer_insights.company_id
       and c.provider::text = 'tiendanube' and c.status = 'active'
       and c.credential_generation = tn_customer_insights.generation));

grant select on public.tn_customer_insights to authenticated;

-- ---------------------------------------------------------------------------
-- Helpers privados de cálculo
-- ---------------------------------------------------------------------------

create function private.tn_insights_metric(p_value text, p_absence text, p_unit text, p_definition text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'value', p_value, 'absence', case when p_value is null then p_absence end,
    'unit', p_unit, 'definition', p_definition)
$$;

create function private.tn_insights_decimal(p_value numeric)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_value is null then null else pg_catalog.trim_scale(pg_catalog.round(p_value, 6))::text end
$$;

-- Clasificación por comprador identificado, moneda y corte (§4, `rfm_v1`). Solo pedidos
-- elegibles, sin marca de supresión, con día local en `[C-364, C]`.
create function private.tn_insights_customer_segments(p_connection_id uuid, p_currency text, p_through date)
returns table (
  customer_id text, recency integer, frequency integer, monetary numeric,
  r_score integer, f_score integer, m_score integer, segment text
)
language sql
stable
set search_path = ''
-- T-17: los pedidos recién publicados en la misma transacción no tienen estadísticas; sin bucles
-- anidados el plan no depende de ellas (hash joins acotados por conexión y moneda).
set enable_nestloop = off
as $$
  with ord as (
    select o.external_customer_id as cust, o.local_day as d, o.insights_amount as amt
      from private.tn_orders o
     where o.connection_id = p_connection_id and o.currency = p_currency and o.eligible
       and o.external_customer_id is not null
       and o.local_day between p_through - 364 and p_through
       and not exists (select 1 from private.tn_redaction_suppressions s
                        where s.connection_id = o.connection_id and s.external_order_id = o.external_order_id)
  ), cust as (
    select ord.cust, p_through - pg_catalog.max(ord.d) as r, pg_catalog.count(*)::integer as f,
           pg_catalog.sum(ord.amt) as m
      from ord group by ord.cust
  ), dist as (
    select distinct cust.m from cust where cust.m is not null
  ), q as (
    select pg_catalog.percentile_disc(0.25) within group (order by dist.m) as q1,
           pg_catalog.percentile_disc(0.5) within group (order by dist.m) as q2,
           pg_catalog.percentile_disc(0.75) within group (order by dist.m) as q3,
           pg_catalog.count(*) > 1 as variety
      from dist
  ), scored as (
    select c.cust, c.r, c.f, c.m,
           case when c.r <= 30 then 5 when c.r <= 60 then 4 when c.r <= 90 then 3
                when c.r <= 180 then 2 else 1 end as rs,
           case when c.f = 1 then 1 when c.f = 2 then 2 when c.f <= 4 then 3
                when c.f <= 9 then 4 else 5 end as fs,
           case when c.m is null then null when c.m <= q.q1 then 1 when c.m <= q.q2 then 2
                when c.m <= q.q3 then 3 else 4 end as ms,
           q.variety
      from cust c cross join q
  )
  select s.cust, s.r, s.f, s.m, s.rs, s.fs, s.ms,
         case when s.r > 180 then 'inactivos'
              when s.r >= 91 then 'riesgo'
              when s.f = 1 and s.r <= 30 then 'nuevos'
              when s.r <= 90 and s.f >= 2 and s.ms = 4 and s.variety then 'alto_valor'
              when s.r <= 90 and s.f >= 3 then 'frecuentes'
              else 'potencial' end
    from scored s
$$;

-- `InsightsData` de una conexión y moneda (§1.1). Toda cifra sale de agregados con k = 5.
create function private.tn_customer_insights_payload(
  p_connection_id uuid, p_currency text, p_through date, p_timezone text, p_fetched_at timestamptz,
  p_catalog_complete boolean)
returns jsonb
language plpgsql
stable
set search_path = ''
-- T-17: ver `tn_insights_customer_segments`.
set enable_nestloop = off
as $$
declare
  v_from         date := p_through - 364;
  v_mon_status   text;
  v_mon_def      text;
  v_identity     text;
  v_lines        boolean;
  v_segments     jsonb;
  v_cohorts      jsonb;
  v_cross        jsonb;
  v_money_absent text;
  v_cohort_count integer;
  v_codes        constant text[] := array['inactivos', 'riesgo', 'nuevos', 'alto_valor', 'frecuentes', 'potencial'];
begin
  -- Calidad sobre los pedidos elegibles de la ventana.
  select case when pg_catalog.count(*) = 0 then 'no_evaluable'
              when pg_catalog.bool_and(o.insights_identity_status = 'verified') then 'completa'
              else 'incompleta' end,
         coalesce(pg_catalog.bool_and(o.insights_lines_status = 'complete'), true)
    into v_identity, v_lines
    from private.tn_orders o
   where o.connection_id = p_connection_id and o.currency = p_currency and o.eligible
     and o.local_day between v_from and p_through
     and not exists (select 1 from private.tn_redaction_suppressions s
                      where s.connection_id = o.connection_id and s.external_order_id = o.external_order_id);

  -- Monetary del universo: pedidos elegibles de compradores identificados en la ventana.
  select case when pg_catalog.count(*) = 0 then 'unverified'
              when pg_catalog.bool_or(o.insights_amount_status = 'inconsistent') then 'inconsistent'
              when pg_catalog.bool_or(o.insights_amount_status = 'incomplete') then 'incomplete'
              when pg_catalog.bool_or(o.insights_amount_status = 'unverified') then 'unverified'
              when pg_catalog.count(distinct o.insights_amount_definition) = 1 then 'verified'
              else 'inconsistent' end,
         case when pg_catalog.count(*) > 0 and pg_catalog.bool_and(o.insights_amount_status = 'verified')
                   and pg_catalog.count(distinct o.insights_amount_definition) = 1
              then pg_catalog.min(o.insights_amount_definition) end
    into v_mon_status, v_mon_def
    from private.tn_orders o
   where o.connection_id = p_connection_id and o.currency = p_currency and o.eligible
     and o.external_customer_id is not null
     and o.local_day between v_from and p_through
     and not exists (select 1 from private.tn_redaction_suppressions s
                      where s.connection_id = o.connection_id and s.external_order_id = o.external_order_id);

  v_money_absent := case when v_mon_status = 'unverified' then 'monetario_no_validado' else 'dato_incompleto' end;

  -- Segmentos (§4, §6): sin Monetary verificado no hay partición; un grupo de 1–4 oculta toda la
  -- distribución de la moneda.
  if v_mon_status <> 'verified' then
    v_segments := pg_catalog.jsonb_build_object('status', 'unavailable', 'absence', v_money_absent,
      'definition', 'segment_partition_v1');
  else
    with seg as (
      select * from private.tn_insights_customer_segments(p_connection_id, p_currency, p_through)
    ), agg as (
      select x.code, x.ord, pg_catalog.count(seg.customer_id)::integer as n,
             coalesce(pg_catalog.sum(seg.frequency), 0)::integer as orders,
             coalesce(pg_catalog.sum(seg.monetary), 0) as money,
             (pg_catalog.percentile_cont(0.5) within group (order by seg.recency))::numeric as med_r
        from pg_catalog.unnest(v_codes) with ordinality as x(code, ord)
        left join seg on seg.segment = x.code
       group by x.code, x.ord
    ), excluded as (
      select pg_catalog.count(distinct o.external_customer_id)::integer as n
        from private.tn_orders o
       where o.connection_id = p_connection_id and o.currency = p_currency and o.eligible
         and o.external_customer_id is not null and o.local_day < v_from
         and not exists (select 1 from private.tn_redaction_suppressions s
                          where s.connection_id = o.connection_id and s.external_order_id = o.external_order_id)
         and not exists (select 1 from seg where seg.customer_id = o.external_customer_id)
    )
    select case when pg_catalog.bool_or(agg.n between 1 and 4) then
             pg_catalog.jsonb_build_object('status', 'unavailable', 'absence', 'privacidad',
               'definition', 'segment_partition_v1')
           else pg_catalog.jsonb_build_object(
             'status', 'available',
             'totalCustomers', private.tn_insights_metric(pg_catalog.sum(agg.n)::text, null, 'customers',
               'segment_total_customers_v1'),
             'excludedBeforeWindow', private.tn_insights_metric(
               case when (select e.n from excluded e) >= 5 then (select e.n from excluded e)::text end,
               'privacidad', 'customers', 'excluded_before_window_v1'),
             'rows', pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'code', agg.code,
               'customers', private.tn_insights_metric(agg.n::text, null, 'customers', 'segment_customers_v1'),
               'orders', private.tn_insights_metric(agg.orders::text, null, 'orders', 'segment_orders_v1'),
               'monetary', private.tn_insights_metric(private.tn_insights_decimal(agg.money), null, 'currency',
                 'segment_monetary_v1'),
               'monetaryPerCustomer', private.tn_insights_metric(
                 case when agg.n > 0 then private.tn_insights_decimal(agg.money / agg.n) end,
                 'sin_denominador', 'currency', 'segment_monetary_per_customer_v1'),
               'monetaryPerOrder', private.tn_insights_metric(
                 case when agg.orders > 0 then private.tn_insights_decimal(agg.money / agg.orders) end,
                 'sin_denominador', 'currency', 'segment_monetary_per_order_v1'),
               'recencyMedianDays', private.tn_insights_metric(
                 case when agg.n > 0 then private.tn_insights_decimal(agg.med_r) end,
                 'sin_denominador', 'days', 'segment_recency_median_days_v1'),
               'frequencyMean', private.tn_insights_metric(
                 case when agg.n > 0 then private.tn_insights_decimal(agg.orders::numeric / agg.n) end,
                 'sin_denominador', 'orders_per_customer', 'segment_frequency_mean_v1'))
               order by agg.ord)) end
      into v_segments
      from agg;
  end if;

  -- Cohortes (§5): primera compra observada en todo el histórico cubierto, últimas 24, meses
  -- 0..12. Un mes abierto o futuro es `periodo_abierto`; cualquier conteo de 0–4 es `privacidad`.
  with ord as (
    select o.external_customer_id as cust, o.external_order_id as oid, o.local_day as d,
           pg_catalog.date_trunc('month', o.local_day)::date as om,
           o.insights_amount as amt, o.insights_amount_status = 'verified' as mv
      from private.tn_orders o
     where o.connection_id = p_connection_id and o.currency = p_currency and o.eligible
       and o.external_customer_id is not null and o.local_day <= p_through
       and not exists (select 1 from private.tn_redaction_suppressions s
                        where s.connection_id = o.connection_id and s.external_order_id = o.external_order_id)
  ), firsts as (
    select ord.cust, pg_catalog.min(ord.om) as c from ord group by ord.cust
  ), months as (
    select f.c, pg_catalog.count(*)::integer as n from firsts f group by f.c order by f.c desc limit 24
  ), o2 as (
    select ord.*, f.c from ord join firsts f on f.cust = ord.cust where f.c in (select m.c from months m)
  ), iv as (
    select o2.cust, o2.c, o2.om,
           o2.d - pg_catalog.lag(o2.d) over (partition by o2.cust order by o2.d, o2.oid) as gap
      from o2
  ), grid as (
    select m.c, m.n, k.k, (m.c + pg_catalog.make_interval(months => k.k))::date as cm
      from months m cross join pg_catalog.generate_series(0, 12) as k(k)
  ), per_month as (
    select o2.c, o2.om, pg_catalog.count(distinct o2.cust)::integer as a, pg_catalog.count(*)::integer as oc,
           pg_catalog.sum(o2.amt) as val, pg_catalog.bool_and(o2.mv) as mv
      from o2 group by o2.c, o2.om
  ), cum as (
    select g.c, g.k, pg_catalog.sum(o2.amt) as cval, pg_catalog.bool_and(o2.mv) as cmv
      from grid g join o2 on o2.c = g.c and o2.om <= g.cm group by g.c, g.k
  ), rep as (
    select g.c, g.k, pg_catalog.count(distinct iv.cust)::integer as rc, pg_catalog.count(*)::integer as ic,
           pg_catalog.avg(iv.gap::numeric) as mgap
      from grid g join iv on iv.c = g.c and iv.om <= g.cm and iv.gap is not null group by g.c, g.k
  ), cells as (
    select g.c, g.n, g.k, g.cm,
           (g.cm + interval '1 month')::date - 1 > p_through as is_open,
           coalesce(pm.a, 0) as a, coalesce(pm.oc, 0) as oc, pm.val, coalesce(pm.mv, true) as mv,
           cu.cval, coalesce(cu.cmv, true) as cmv,
           coalesce(rp.rc, 0) as rc, coalesce(rp.ic, 0) as ic, rp.mgap
      from grid g
      left join per_month pm on pm.c = g.c and pm.om = g.cm
      left join cum cu on cu.c = g.c and cu.k = g.k
      left join rep rp on rp.c = g.c and rp.k = g.k
  ), cell_json as (
    select x.c, x.k, case
      when x.is_open or x.a < 5 then (
        select pg_catalog.jsonb_build_object('offset', x.k, 'calendarMonth', pg_catalog.to_char(x.cm, 'YYYY-MM'),
          'activeCustomers', private.tn_insights_metric(null, h.reason, 'customers', 'cohort_active_v1'),
          'retention', private.tn_insights_metric(null, h.reason, 'ratio', 'cohort_retention_v1'),
          'repeatPurchaseCumulative', private.tn_insights_metric(null, h.reason, 'ratio', 'cohort_repeat_cumulative_v1'),
          'observedValue', private.tn_insights_metric(null, h.reason, 'currency', 'cohort_observed_value_v1'),
          'ticket', private.tn_insights_metric(null, h.reason, 'currency', 'cohort_ticket_v1'),
          'observedValuePerCustomerCumulative', private.tn_insights_metric(null, h.reason, 'currency',
            'cohort_observed_value_per_customer_cumulative_v1'),
          'meanDaysBetweenPurchases', private.tn_insights_metric(null, h.reason, 'days',
            'cohort_mean_days_between_purchases_v1'),
          'repeatCustomers', private.tn_insights_metric(null, h.reason, 'customers', 'cohort_repeat_customers_v1'),
          'purchaseIntervals', private.tn_insights_metric(null, h.reason, 'intervals', 'cohort_purchase_intervals_v1'))
          from (select case when x.is_open then 'periodo_abierto' else 'privacidad' end as reason) h)
      else pg_catalog.jsonb_build_object('offset', x.k, 'calendarMonth', pg_catalog.to_char(x.cm, 'YYYY-MM'),
          'activeCustomers', private.tn_insights_metric(x.a::text, null, 'customers', 'cohort_active_v1'),
          'retention', private.tn_insights_metric(private.tn_insights_decimal(x.a::numeric / x.n), null, 'ratio',
            'cohort_retention_v1'),
          'repeatPurchaseCumulative', private.tn_insights_metric(
            case when x.rc >= 5 then private.tn_insights_decimal(x.rc::numeric / x.n) end, 'privacidad', 'ratio',
            'cohort_repeat_cumulative_v1'),
          'observedValue', private.tn_insights_metric(
            case when v_mon_status = 'verified' and x.mv then private.tn_insights_decimal(x.val) end,
            case when v_mon_status <> 'verified' then v_money_absent else 'dato_incompleto' end,
            'currency', 'cohort_observed_value_v1'),
          'ticket', private.tn_insights_metric(
            case when v_mon_status = 'verified' and x.mv then private.tn_insights_decimal(x.val / x.oc) end,
            case when v_mon_status <> 'verified' then v_money_absent else 'dato_incompleto' end,
            'currency', 'cohort_ticket_v1'),
          'observedValuePerCustomerCumulative', private.tn_insights_metric(
            case when v_mon_status = 'verified' and x.cmv then private.tn_insights_decimal(x.cval / x.n) end,
            case when v_mon_status <> 'verified' then v_money_absent else 'dato_incompleto' end,
            'currency', 'cohort_observed_value_per_customer_cumulative_v1'),
          'meanDaysBetweenPurchases', private.tn_insights_metric(
            case when x.rc >= 5 then private.tn_insights_decimal(x.mgap) end, 'privacidad', 'days',
            'cohort_mean_days_between_purchases_v1'),
          'repeatCustomers', private.tn_insights_metric(case when x.rc >= 5 then x.rc::text end, 'privacidad',
            'customers', 'cohort_repeat_customers_v1'),
          'purchaseIntervals', private.tn_insights_metric(case when x.rc >= 5 then x.ic::text end, 'privacidad',
            'intervals', 'cohort_purchase_intervals_v1'))
      end as cell
      from cells x
  )
  select (select pg_catalog.count(*)::integer from months),
         pg_catalog.jsonb_agg(r.row order by r.c desc)
    into v_cohort_count, v_cohorts
    from (
      select m.c, pg_catalog.jsonb_build_object(
               'cohortMonth', pg_catalog.to_char(m.c, 'YYYY-MM'),
               'size', private.tn_insights_metric(m.n::text, null, 'customers', 'cohort_size_observed_v1'),
               'cells', (select pg_catalog.jsonb_agg(cj.cell order by cj.k) from cell_json cj where cj.c = m.c)) as row
        from months m
       where m.n >= 5
    ) r;

  if v_cohorts is null and v_cohort_count > 0 then
    v_cohorts := pg_catalog.jsonb_build_object('status', 'unavailable', 'absence', 'privacidad',
      'definition', 'cohorts_observed_v1');
  else
    v_cohorts := pg_catalog.jsonb_build_object('status', 'available', 'rows', coalesce(v_cohorts, '[]'::jsonb));
  end if;

  -- Venta cruzada (§7): un solo par seguro, sin conteos ni claves en el payload.
  if not p_catalog_complete or not v_lines then
    v_cross := pg_catalog.jsonb_build_object('status', 'unavailable', 'absence', 'dato_incompleto',
      'definition', 'cross_sell_pair_v1');
  elsif v_segments->>'status' <> 'available' then
    v_cross := pg_catalog.jsonb_build_object('status', 'unavailable', 'absence', v_segments->>'absence',
      'definition', 'cross_sell_pair_v1');
  else
    with segc as (
      select s.customer_id as cust, s.segment as code
        from private.tn_insights_customer_segments(p_connection_id, p_currency, p_through) s
       where s.segment in ('alto_valor', 'frecuentes')
    ), lines as (
      select distinct o.external_customer_id as cust, p.id as pid, p.name as pname, p.deleted,
             p.id is null or p.last_seen_at is null as unlinked
        from private.tn_orders o
        join private.tn_order_lines l
          on l.connection_id = o.connection_id and l.external_order_id = o.external_order_id
        left join private.tn_products p
          on p.connection_id = o.connection_id and p.external_product_id = l.external_product_id
       where o.connection_id = p_connection_id and o.currency = p_currency and o.eligible
         and o.local_day between v_from and p_through
         and o.external_customer_id in (select segc.cust from segc)
         and not exists (select 1 from private.tn_redaction_suppressions s
                          where s.connection_id = o.connection_id and s.external_order_id = o.external_order_id)
    ), baskets as (
      -- Productos vigentes por comprador: los pares salen de su arreglo, sin un autojoin que el
      -- planificador pueda resolver como bucle anidado (T-17).
      select segc.code, segc.cust, pg_catalog.array_agg(distinct l.pid) as pids
        from segc join lines l on l.cust = segc.cust
       where not l.unlinked and not l.deleted
       group by segc.code, segc.cust
    ), counts as (
      select b.code, x.pid, pg_catalog.count(*) as n
        from baskets b cross join lateral pg_catalog.unnest(b.pids) as x(pid)
       group by b.code, x.pid
    ), pairs as (
      select b.code, a.pid as pa, z.pid as pb, pg_catalog.count(*) as co
        from baskets b
       cross join lateral pg_catalog.unnest(b.pids) as a(pid)
       cross join lateral pg_catalog.unnest(b.pids) as z(pid)
       where a.pid <> z.pid
       group by b.code, a.pid, z.pid
    ), best as (
      select p.code, pa.name as na, pb.name as nb
        from pairs p
        join counts c on c.code = p.code and c.pid = p.pa
        join private.tn_products pa on pa.id = p.pa
        join private.tn_products pb on pb.id = p.pb
       where p.co >= 5 and c.n - p.co >= 5
       order by p.co desc, case p.code when 'alto_valor' then 0 else 1 end, p.pa, p.pb
       limit 1
    )
    select case
             when exists (select 1 from lines where lines.unlinked) then
               pg_catalog.jsonb_build_object('status', 'unavailable', 'absence', 'dato_incompleto',
                 'definition', 'cross_sell_pair_v1')
             when b.code is null then
               pg_catalog.jsonb_build_object('status', 'unavailable', 'absence', 'privacidad',
                 'definition', 'cross_sell_pair_v1')
             else pg_catalog.jsonb_build_object('status', 'available', 'sourceSegment', b.code,
               'productAName', pg_catalog.left(b.na, 255), 'productBName', pg_catalog.left(b.nb, 255),
               'coPurchaseSufficient', true, 'targetSufficient', true, 'identifiedCustomers', null,
               'identifiedCustomersAbsence', 'privacidad', 'definition', 'cross_sell_pair_v1') end
      into v_cross
      from (select 1) one left join best b on true;
  end if;

  return pg_catalog.jsonb_build_object(
    'ruleset', 'rfm_v1',
    'source', 'tiendanube',
    'asOfDay', p_through::text,
    'fetchedAt', pg_catalog.to_char(p_fetched_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'timezone', p_timezone,
    'currency', p_currency,
    'rfmFrom', v_from::text,
    'firstPurchaseBasis', 'observada',
    'quality', pg_catalog.jsonb_build_object(
      'coverage', pg_catalog.jsonb_build_object('fromDay', null, 'throughDay', p_through::text, 'complete', true),
      'identity', v_identity,
      'monetary', pg_catalog.jsonb_build_object('status', v_mon_status, 'definition', v_mon_def),
      'catalog', case when p_catalog_complete then 'completo' else 'incompleto' end,
      'orderLines', case when v_lines then 'completas' else 'incompletas' end),
    'segments', v_segments,
    'cohorts', v_cohorts,
    'productEvidence', pg_catalog.jsonb_build_object(
      'catalogComplete', p_catalog_complete, 'linesComplete', v_lines, 'crossSell', v_cross));
end;
$$;

-- Borra el snapshot de la conexión. Lo llaman operaciones privilegiadas ya autorizadas.
create function private.tn_invalidate_customer_insights(p_connection_id uuid)
returns void
language sql
set search_path = ''
as $$
  delete from public.tn_customer_insights i where i.connection_id = p_connection_id
$$;

-- Recalcula el snapshot de la conexión, una fila por moneda con pedidos elegibles en la ventana.
-- Solo con conexión activa, incremental, cobertura y sin relectura pendiente.
create function private.tn_refresh_customer_insights(p_connection_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_connection public.integration_connections;
  v_status     public.tn_sync_status;
  v_through    date;
  v_currency   text;
begin
  perform private.tn_invalidate_customer_insights(p_connection_id);

  select c.* into v_connection from public.integration_connections c where c.id = p_connection_id;
  select s.* into v_status from public.tn_sync_status s where s.connection_id = p_connection_id;
  if v_connection.id is null or v_connection.provider::text <> 'tiendanube' or v_connection.status <> 'active'
     or v_status.connection_id is null or v_status.phase <> 'incremental' or v_status.coverage_until is null
     or v_status.insights_rebuild_pending or v_status.last_fetched_at is null then
    return;
  end if;

  v_through := private.tn_covered_through(v_status.coverage_until, v_connection.timezone);

  for v_currency in
    select distinct o.currency from private.tn_orders o
     where o.connection_id = p_connection_id and o.eligible
       and o.local_day between v_through - 364 and v_through
       and not exists (select 1 from private.tn_redaction_suppressions s
                        where s.connection_id = o.connection_id and s.external_order_id = o.external_order_id)
     order by 1
  loop
    insert into public.tn_customer_insights
      (company_id, connection_id, currency, generation, ruleset, as_of_day, fetched_at, payload)
    values (v_connection.company_id, p_connection_id, v_currency, v_connection.credential_generation, 'rfm_v1',
            v_through, v_status.last_fetched_at,
            private.tn_customer_insights_payload(p_connection_id, v_currency, v_through, v_connection.timezone,
              v_status.last_fetched_at, v_status.insights_catalog_status = 'complete'));
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Invalidación por triggers
-- ---------------------------------------------------------------------------

create function private.tn_insights_on_suppression()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.tn_customer_insights i
   where i.connection_id in (select distinct n.connection_id from marked n);
  return null;
end;
$$;

create function private.tn_insights_on_order_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.tn_customer_insights i
   where i.connection_id in (select distinct g.connection_id from gone g);
  return null;
end;
$$;

-- Cambio de estado, generación, zona o moneda: el snapshot deja de valer. Generación o zona
-- exigen además una relectura completa; la generación nueva reinicia el estado del catálogo.
create function private.tn_insights_on_connection_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.provider::text <> 'tiendanube' then
    return null;
  end if;
  if old.status is distinct from new.status or old.credential_generation is distinct from new.credential_generation
     or old.timezone is distinct from new.timezone or old.currency is distinct from new.currency then
    delete from public.tn_customer_insights i where i.connection_id = new.id;
  end if;
  if old.credential_generation is distinct from new.credential_generation
     or old.timezone is distinct from new.timezone then
    update public.tn_sync_status s
       set insights_rebuild_pending = true, insights_rebuild_started = false,
           insights_catalog_status = case when old.credential_generation is distinct from new.credential_generation
                                          then 'unknown' else s.insights_catalog_status end,
           catalog_next_page = case when old.credential_generation is distinct from new.credential_generation
                                    then null else s.catalog_next_page end,
           catalog_traversal_started_at = case when old.credential_generation is distinct from new.credential_generation
                                               then null else s.catalog_traversal_started_at end,
           updated_at = now()
     where s.connection_id = new.id;
  end if;
  return null;
end;
$$;

create trigger tn_redaction_suppressions_invalidate_insights
  after insert on private.tn_redaction_suppressions
  referencing new table as marked
  for each statement execute function private.tn_insights_on_suppression();

create trigger tn_orders_invalidate_insights
  after delete on private.tn_orders
  referencing old table as gone
  for each statement execute function private.tn_insights_on_order_delete();

create trigger integration_connections_invalidate_insights
  after update of status, credential_generation, timezone, currency on public.integration_connections
  for each row execute function private.tn_insights_on_connection_change();

revoke all on function private.tn_insights_metric(text, text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function private.tn_insights_decimal(numeric)
  from public, anon, authenticated, service_role;
revoke all on function private.tn_insights_customer_segments(uuid, text, date)
  from public, anon, authenticated, service_role;
revoke all on function private.tn_customer_insights_payload(uuid, text, date, text, timestamptz, boolean)
  from public, anon, authenticated, service_role;
revoke all on function private.tn_invalidate_customer_insights(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.tn_refresh_customer_insights(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.tn_insights_on_suppression()
  from public, anon, authenticated, service_role;
revoke all on function private.tn_insights_on_order_delete()
  from public, anon, authenticated, service_role;
revoke all on function private.tn_insights_on_connection_change()
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- worker_api: mismas firmas, invalidación, relectura y publicación del snapshot
-- ---------------------------------------------------------------------------

-- Abre un paso (0023) e invalida el snapshot. Con relectura pendiente, el paso es un backfill
-- desde el inicio del histórico aunque la sincronización ya esté en incremental; la cobertura
-- y el dataset de M16e se conservan. Un corte conserva marca de agua y checkpoint.
create or replace function worker_api.tn_start_sync(
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
  v_phase      text;
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
  perform private.tn_invalidate_customer_insights(p_connection_id);

  v_now := pg_catalog.date_trunc('milliseconds', pg_catalog.clock_timestamp());

  insert into public.tn_sync_status as s (connection_id, company_id, phase, watermark)
  values (p_connection_id, p_company_id, 'backfill', v_now)
  on conflict (connection_id) do nothing;

  select s.* into v_status from public.tn_sync_status s where s.connection_id = p_connection_id for update;
  v_phase := v_status.phase;
  if v_status.insights_rebuild_pending then
    v_phase := 'backfill';
    if not v_status.insights_rebuild_started then
      update public.tn_sync_status s
         set insights_rebuild_started = true, backfill_next = null, watermark = v_now
       where s.connection_id = p_connection_id;
    end if;
  end if;

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
     v_phase, v_now, p_lease_expires_at, 'running');

  return query select p_run_id, v_phase, v_now, p_lease_expires_at,
    v_status.watermark, v_status.backfill_next,
    v_status.incremental_checkpoint - interval '1 hour', v_status.catalog_next_page;
exception
  when integrity_constraint_violation then
    get stacked diagnostics v_constraint = constraint_name;
    perform private.raise_worker_integrity_error(v_constraint);
end;
$$;

-- Publica una página de pedidos (0023) con los cinco campos de calidad de M27a, que se guardan
-- en columnas privadas. Invalida el snapshot antes de modificar nada.
--
-- p_orders: [{...los 19 campos de 0023..., insights_amount, insights_amount_status,
--             insights_amount_definition, insights_identity_status, insights_lines_status}]
create or replace function worker_api.tn_publish_orders(
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
    'is_subscription', 'is_subscription_initial', 'refunded_amount', 'insights_amount',
    'insights_amount_status', 'insights_amount_definition', 'insights_identity_status',
    'insights_lines_status'];
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
                    or coalesce(e->>'customer_id', '1') !~ '^[1-9][0-9]{0,19}$'
                    -- Calidad de M27a (§2 y §3): cerrada y coherente consigo misma.
                    or pg_catalog.jsonb_typeof(e->'insights_amount') not in ('string', 'null')
                    or coalesce(e->>'insights_amount', '0') !~ '^[0-9]{1,15}(\.[0-9]{1,6})?$'
                    or pg_catalog.jsonb_typeof(e->'insights_amount_status') <> 'string'
                    or e->>'insights_amount_status' not in ('verified', 'unverified', 'incomplete', 'inconsistent')
                    or pg_catalog.jsonb_typeof(e->'insights_amount_definition') not in ('string', 'null')
                    or coalesce(e->>'insights_amount_definition', 'tn_paid_current_observed_v1')
                         not in ('tn_paid_current_observed_v1', 'tn_paid_current_less_verified_refunds_v1')
                    or (e->>'insights_amount_status' = 'verified')
                         <> (pg_catalog.jsonb_typeof(e->'insights_amount') = 'string'
                             and pg_catalog.jsonb_typeof(e->'insights_amount_definition') = 'string')
                    or (e->>'insights_amount_status' <> 'verified'
                        and (pg_catalog.jsonb_typeof(e->'insights_amount') <> 'null'
                             or pg_catalog.jsonb_typeof(e->'insights_amount_definition') <> 'null'))
                    or pg_catalog.jsonb_typeof(e->'insights_identity_status') <> 'string'
                    or e->>'insights_identity_status' not in ('verified', 'absent', 'invalid')
                    or (e->>'insights_identity_status' = 'verified')
                         <> (pg_catalog.jsonb_typeof(e->'customer_id') = 'string')
                    or pg_catalog.jsonb_typeof(e->'insights_lines_status') <> 'string'
                    or e->>'insights_lines_status' not in ('complete', 'source_omitted', 'source_invalid',
                                                           'line_omitted'))
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

  perform private.tn_invalidate_customer_insights(p_connection_id);

  select s.* into v_status from public.tn_sync_status s
   where s.connection_id = p_connection_id for update;

  if p_window->>'kind' <> v_run.phase
     or (v_run.phase = 'backfill'
         and ((v_status.backfill_next is not null and v_from <> v_status.backfill_next)
              or v_to > (v_status.watermark at time zone v_connection.timezone)::date)) then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;

  begin
    select coalesce(pg_catalog.array_agg(row(
             p_company_id, p_connection_id, x.id, x.customer_id, x.status, x.payment_status,
             x.created_at, x.updated_at, x.paid_at, x.closed_at, x.cancelled_at, x.currency,
             x.subtotal, x.discount, x.total, x.total_paid_by_customer, x.storefront,
             x.cancel_reason, x.is_subscription, x.is_subscription_initial, x.refunded_amount,
             private.tn_local_day(x.paid_at, x.created_at, v_connection.timezone),
             x.payment_status in ('paid', 'partially_refunded') and x.status <> 'cancelled',
             x.payment_status = 'partially_paid' and x.status <> 'cancelled',
             x.insights_amount, x.insights_amount_status, x.insights_amount_definition,
             x.insights_identity_status, x.insights_lines_status
           )::private.tn_orders), '{}')
      into v_orders
      from pg_catalog.jsonb_to_recordset(p_orders) as x(
        id text, customer_id text, status text, payment_status text, created_at timestamptz,
        updated_at timestamptz, paid_at timestamptz, closed_at timestamptz,
        cancelled_at timestamptz, currency text, subtotal numeric, discount numeric,
        total numeric, total_paid_by_customer numeric, storefront text, cancel_reason text,
        is_subscription boolean, is_subscription_initial boolean, refunded_amount numeric,
        insights_amount numeric, insights_amount_status text, insights_amount_definition text,
        insights_identity_status text, insights_lines_status text)
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
         partially_paid = excluded.partially_paid,
         insights_amount = excluded.insights_amount,
         insights_amount_status = excluded.insights_amount_status,
         insights_amount_definition = excluded.insights_amount_definition,
         insights_identity_status = excluded.insights_identity_status,
         insights_lines_status = excluded.insights_lines_status;
  get diagnostics v_written = row_count;

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

-- Publica una página del catálogo (0023) y lleva la procedencia del recorrido para M27a.
--
-- p_state: {"next_page": entero >= 2 | null, "store": {...} | null,
--           "new_traversal": bool (true solo en la página 1), "has_omitted_products": bool}
create or replace function worker_api.tn_publish_catalog(
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
  v_omissions  boolean;
  v_constraint text;
begin
  perform private.assert_worker_actor(p_actor_user_id, p_company_id);

  if p_connection_id is null or p_expected_generation is null or p_run_id is null
     or p_lease_token is null or p_products is null or p_state is null or p_complete is null
     or pg_catalog.jsonb_typeof(p_products) <> 'array'
     or pg_catalog.jsonb_array_length(p_products) > 1000
     or not private.meta_has_exact_keys(p_state, array['next_page', 'store', 'new_traversal', 'has_omitted_products'])
     or pg_catalog.jsonb_typeof(p_state->'new_traversal') <> 'boolean'
     or pg_catalog.jsonb_typeof(p_state->'has_omitted_products') <> 'boolean'
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

  -- La página 1 abre un recorrido nuevo; cualquier otra lo continúa.
  if (p_state->>'new_traversal')::boolean <> (v_status.catalog_next_page is null) then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;
  v_omissions := (p_state->>'has_omitted_products')::boolean
    or (not (p_state->>'new_traversal')::boolean and v_status.insights_catalog_has_omissions);

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
         insights_catalog_has_omissions = v_omissions,
         insights_catalog_status = case when not p_complete then 'cycle_incomplete'
                                        when v_omissions then 'omitted_items' else 'complete' end,
         updated_at = now()
   where s.connection_id = p_connection_id;

  return query select v_written, v_deleted, v_next;
exception
  when integrity_constraint_violation then
    get stacked diagnostics v_constraint = constraint_name;
    perform private.raise_worker_integrity_error(v_constraint);
end;
$$;

-- Cierra el paso (0023). Un backfill completo de relectura limpia sus marcas sin publicar; un
-- incremental completo publica el snapshot en la misma transacción. Un error de cálculo
-- revierte el cierre entero: nunca queda un falso completo.
create or replace function worker_api.tn_finish_sync(
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
           incremental_checkpoint = s.watermark,
           insights_rebuild_pending = false, insights_rebuild_started = false
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

  if p_complete and v_run.phase = 'incremental' then
    perform private.tn_refresh_customer_insights(p_connection_id);
  end if;

  return query select v_status.phase, v_status.coverage_until, v_result;
exception
  when integrity_constraint_violation then
    get stacked diagnostics v_constraint = constraint_name;
    perform private.raise_worker_integrity_error(v_constraint);
end;
$$;

-- ---------------------------------------------------------------------------
-- Lectura (SECURITY INVOKER, bajo RLS)
-- ---------------------------------------------------------------------------

create function public.get_tn_customer_insights(p_connection_id uuid, p_currency text)
returns table (as_of_day date, fetched_at timestamptz, ruleset text, payload jsonb)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if p_connection_id is null or p_currency is null or p_currency !~ '^[A-Z]{3}$' then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;
  return query
  select i.as_of_day, i.fetched_at, i.ruleset, i.payload
    from public.tn_customer_insights i
   where i.connection_id = p_connection_id and i.currency = p_currency;
end;
$$;

revoke all on function public.get_tn_customer_insights(uuid, text)
  from public, anon, authenticated, service_role, praxa_integrations;
grant execute on function public.get_tn_customer_insights(uuid, text) to authenticated;
