-- PRAXA 0017 — Desgloses de Insights de Meta: edad y género, país y región
--
-- Decisión del usuario del 2026-11-08, sin microfase (H-E1-202). Cuenta y campaña. Tablas propias:
-- un desglose fallido no toca los cuatro niveles de 0016, su cobertura ni el estado del run.
--
-- MATRIZ DE PRIVILEGIOS
--
--   objeto                              | anon | authenticated   | rol de C          | PUBLIC   | service_role
--   ------------------------------------+------+-----------------+-------------------+----------+-------------
--   public.meta_breakdown_snapshots     | —    | —               | —                 | —        | —
--   public.meta_breakdown_rows          | —    | SELECT por RLS  | —                 | —        | —
--   public.meta_breakdown_coverage      | —    | SELECT por RLS  | —                 | —        | —
--   public.meta_breakdown_status        | —    | SELECT por RLS  | —                 | —        | —
--   worker_api: publish_breakdown,      | —    | —               | EXECUTE, función  | revocado | —
--     record_breakdown_failure          |      |                 | por función       |          |
--   public: get_meta_breakdown,         | —    | EXECUTE         | —                 | revocado | —
--     get_meta_breakdown_status         |      |                 |                   |          |
--     (INVOKER)                         |      |                 |                   |          |
--
-- REGLAS
--
--   * Las filas no llevan IDs externos: solo la referencia opaca de la entidad.
--   * Sin `reach` ni `frequency`: no se pueden sumar y Meta no documenta si los devuelve con
--     estos desgloses. `region` no lleva acciones: Meta no devuelve las de fuera de Meta.
--   * Los valores de Meta son estimados: los totales siguen saliendo de los niveles de 0016.
--   * Posesión: los mismos helpers y el mismo orden de bloqueos que `publish_snapshot`.
--   * La purga y la cascada de la empresa alcanzan estas tablas por sus FK.

-- ---------------------------------------------------------------------------
-- Validación
-- ---------------------------------------------------------------------------

-- Texto del proveedor, no confiable: se acota y se guarda tal cual. Espejo de TypeScript.
create function private.meta_valid_segment(p_value jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case when pg_catalog.jsonb_typeof(p_value) = 'string'
    then pg_catalog.char_length(p_value #>> '{}') between 1 and 128
         and (p_value #>> '{}') !~ '[[:cntrl:]]'
    else false end
$$;

create function private.meta_valid_breakdown_row(p_row jsonb, p_dimension text, p_from date, p_to date)
returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare
  v_date date;
begin
  if not private.meta_has_exact_keys(p_row, array[
       'date', 'external_id', 'segment_primary', 'segment_secondary', 'spend', 'impressions', 'clicks',
       'inline_link_clicks', 'ctr', 'cpc', 'cpm', 'actions'])
     or pg_catalog.jsonb_typeof(p_row->'date') <> 'string'
     or pg_catalog.jsonb_typeof(p_row->'external_id') <> 'string'
     or pg_catalog.jsonb_typeof(p_row->'actions') <> 'array' then
    return false;
  end if;

  v_date := private.meta_try_date(p_row->>'date');
  if v_date is null or v_date < p_from or v_date > p_to then
    return false;
  end if;

  if not private.meta_valid_segment(p_row->'segment_primary') then
    return false;
  end if;
  if p_dimension = 'age_gender' then
    if not private.meta_valid_segment(p_row->'segment_secondary') then
      return false;
    end if;
  elsif pg_catalog.jsonb_typeof(p_row->'segment_secondary') <> 'null' then
    return false;
  end if;

  if p_dimension = 'region' and pg_catalog.jsonb_array_length(p_row->'actions') > 0 then
    return false;
  end if;

  if not (private.meta_valid_decimal(p_row->'spend') and private.meta_valid_decimal(p_row->'ctr')
          and private.meta_valid_decimal(p_row->'cpc') and private.meta_valid_decimal(p_row->'cpm')
          and private.meta_valid_count(p_row->'impressions') and private.meta_valid_count(p_row->'clicks')
          and private.meta_valid_count(p_row->'inline_link_clicks')) then
    return false;
  end if;

  if exists (select 1 from pg_catalog.jsonb_array_elements(p_row->'actions') a
              where not private.meta_valid_action(a)) then
    return false;
  end if;

  return (select pg_catalog.count(*) = pg_catalog.count(distinct (a->>'action_type', a->>'variant'))
            from pg_catalog.jsonb_array_elements(p_row->'actions') a);
end;
$$;

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table public.meta_breakdown_snapshots (
  id            uuid primary key,
  company_id    uuid not null,
  connection_id uuid not null,
  sync_run_id   uuid not null,
  level         text not null,
  dimension     text not null,
  fetched_at    timestamptz not null,
  window_from   date not null,
  window_to     date not null,
  currency      text not null,
  timezone      text not null,
  pages         integer not null,
  duration_ms   integer not null,
  request_hash  text not null,

  constraint meta_breakdown_snapshots_run_fkey
    foreign key (company_id, connection_id, sync_run_id)
    references public.meta_sync_runs (company_id, connection_id, id) on delete cascade,
  constraint meta_breakdown_snapshots_run_key unique (sync_run_id, level, dimension),
  constraint meta_breakdown_snapshots_company_connection_id_key unique (company_id, connection_id, id),
  constraint meta_breakdown_snapshots_scope_key unique (company_id, connection_id, level, dimension, id),
  constraint meta_breakdown_snapshots_level check (level in ('account', 'campaign')),
  constraint meta_breakdown_snapshots_dimension check (dimension in ('age_gender', 'country', 'region')),
  constraint meta_breakdown_snapshots_window check (window_to >= window_from),
  constraint meta_breakdown_snapshots_counters check (pages > 0 and duration_ms >= 0)
);

-- `segment_secondary` vacío significa que la dimensión tiene un solo segmento: la PK no admite null.
create table public.meta_breakdown_rows (
  snapshot_id        uuid not null,
  entity_ref         uuid not null,
  date               date not null,
  segment_primary    text not null,
  segment_secondary  text not null default '',
  company_id         uuid not null,
  connection_id      uuid not null,
  spend              numeric,
  impressions        bigint,
  clicks             bigint,
  inline_link_clicks bigint,
  ctr                numeric,
  cpc                numeric,
  cpm                numeric,
  actions            jsonb not null,

  primary key (snapshot_id, entity_ref, date, segment_primary, segment_secondary),
  constraint meta_breakdown_rows_snapshot_fkey
    foreign key (company_id, connection_id, snapshot_id)
    references public.meta_breakdown_snapshots (company_id, connection_id, id) on delete cascade,
  constraint meta_breakdown_rows_entity_fkey
    foreign key (company_id, connection_id, entity_ref)
    references public.meta_entities (company_id, connection_id, entity_ref) on delete cascade,
  constraint meta_breakdown_rows_nonnegative
    check (spend >= 0 and impressions >= 0 and clicks >= 0 and inline_link_clicks >= 0
           and ctr >= 0 and cpc >= 0 and cpm >= 0),
  constraint meta_breakdown_rows_actions_array check (jsonb_typeof(actions) = 'array')
);

-- Cobertura vigente: el último snapshot completo de cada nivel, dimensión y día.
create table public.meta_breakdown_coverage (
  connection_id           uuid not null,
  level                   text not null,
  dimension               text not null,
  date                    date not null,
  company_id              uuid not null,
  snapshot_id             uuid not null,
  fetched_at              timestamptz not null,
  captured_before_day_end boolean not null,
  currency                text not null,
  timezone                text not null,

  primary key (connection_id, level, dimension, date),
  constraint meta_breakdown_coverage_snapshot_fkey
    foreign key (company_id, connection_id, level, dimension, snapshot_id)
    references public.meta_breakdown_snapshots (company_id, connection_id, level, dimension, id)
    on delete cascade
);

-- Último intento: un fallo no borra la cobertura anterior, pero tampoco queda oculto.
create table public.meta_breakdown_status (
  connection_id   uuid not null,
  level           text not null,
  dimension       text not null,
  company_id      uuid not null,
  last_result     text not null,
  last_reason     text,
  last_attempt_at timestamptz not null,

  primary key (connection_id, level, dimension),
  constraint meta_breakdown_status_connection_fkey
    foreign key (company_id, connection_id)
    references public.integration_connections (company_id, id) on delete cascade,
  constraint meta_breakdown_status_level check (level in ('account', 'campaign')),
  constraint meta_breakdown_status_dimension check (dimension in ('age_gender', 'country', 'region')),
  constraint meta_breakdown_status_classification
    check ((last_result = 'complete' and last_reason is null)
           or (last_result = 'failed'
               and last_reason in ('page_limit', 'duration_limit', 'invalid_response', 'meta_error', 'own_error')))
);

create index meta_breakdown_snapshots_company_connection_idx on public.meta_breakdown_snapshots (company_id, connection_id);
create index meta_breakdown_rows_company_connection_idx on public.meta_breakdown_rows (company_id, connection_id);
create index meta_breakdown_rows_entity_idx on public.meta_breakdown_rows (company_id, connection_id, entity_ref);
create index meta_breakdown_coverage_snapshot_idx
  on public.meta_breakdown_coverage (company_id, connection_id, level, dimension, snapshot_id);
create index meta_breakdown_status_company_connection_idx on public.meta_breakdown_status (company_id, connection_id);

create trigger meta_breakdown_snapshots_immutable
  before update on public.meta_breakdown_snapshots
  for each row execute function private.meta_forbid_snapshot_update();
create trigger meta_breakdown_rows_immutable
  before update on public.meta_breakdown_rows
  for each row execute function private.meta_forbid_snapshot_update();

-- ---------------------------------------------------------------------------
-- RLS y privilegios de tablas
-- ---------------------------------------------------------------------------

revoke all on public.meta_breakdown_snapshots, public.meta_breakdown_rows,
  public.meta_breakdown_coverage, public.meta_breakdown_status
  from public, anon, authenticated, service_role, praxa_integrations;

alter table public.meta_breakdown_snapshots enable row level security;
alter table public.meta_breakdown_snapshots force row level security;
alter table public.meta_breakdown_rows enable row level security;
alter table public.meta_breakdown_rows force row level security;
alter table public.meta_breakdown_coverage enable row level security;
alter table public.meta_breakdown_coverage force row level security;
alter table public.meta_breakdown_status enable row level security;
alter table public.meta_breakdown_status force row level security;

-- Igual que la cobertura de 0016: una conexión desconectada no expone nada mientras se purga.
create policy meta_breakdown_rows_select_member
  on public.meta_breakdown_rows for select to authenticated
  using (
    private.is_company_member(meta_breakdown_rows.company_id)
    and exists (
      select 1 from public.integration_connections c
       where c.id = meta_breakdown_rows.connection_id
         and c.company_id = meta_breakdown_rows.company_id
         and c.status in ('active', 'needs_reauth'))
  );

create policy meta_breakdown_coverage_select_member
  on public.meta_breakdown_coverage for select to authenticated
  using (
    private.is_company_member(meta_breakdown_coverage.company_id)
    and exists (
      select 1 from public.integration_connections c
       where c.id = meta_breakdown_coverage.connection_id
         and c.company_id = meta_breakdown_coverage.company_id
         and c.status in ('active', 'needs_reauth'))
  );

create policy meta_breakdown_status_select_member
  on public.meta_breakdown_status for select to authenticated
  using (
    private.is_company_member(meta_breakdown_status.company_id)
    and exists (
      select 1 from public.integration_connections c
       where c.id = meta_breakdown_status.connection_id
         and c.company_id = meta_breakdown_status.company_id
         and c.status in ('active', 'needs_reauth'))
  );

grant select on public.meta_breakdown_rows, public.meta_breakdown_coverage, public.meta_breakdown_status
  to authenticated;

-- ---------------------------------------------------------------------------
-- Escritura
-- ---------------------------------------------------------------------------

create function worker_api.publish_breakdown(
  p_actor_user_id       uuid,
  p_company_id          uuid,
  p_connection_id       uuid,
  p_expected_generation integer,
  p_run_id              uuid,
  p_ownership_token     text,
  p_snapshot_id         uuid,
  p_level               text,
  p_dimension           text,
  p_fetched_at          timestamptz,
  p_pages               integer,
  p_duration_ms         integer,
  p_payload             jsonb
)
returns table (
  snapshot_id uuid,
  level       text,
  dimension   text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection public.integration_connections;
  v_run        public.meta_sync_runs;
  v_existing   public.meta_breakdown_snapshots;
  v_hash       text;
  v_constraint text;
begin
  perform private.assert_worker_actor(p_actor_user_id, p_company_id);

  if p_connection_id is null or p_expected_generation is null or p_run_id is null
     or p_ownership_token is null or p_snapshot_id is null or p_level is null or p_dimension is null
     or p_fetched_at is null or p_pages is null or p_duration_ms is null or p_payload is null
     or p_ownership_token !~ '^[0-9a-f]{64}$'
     or p_level not in ('account', 'campaign')
     or p_dimension not in ('age_gender', 'country', 'region')
     or p_pages < 1 or p_duration_ms < 0
     or not private.meta_has_exact_keys(p_payload, array['rows'])
     or pg_catalog.jsonb_typeof(p_payload->'rows') <> 'array' then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;

  perform private.lock_company(p_company_id);

  select c.* into v_connection
    from public.integration_connections c
   where c.id = p_connection_id
     and c.company_id = p_company_id
   for update;

  if not found then
    raise exception 'praxa: operación no autorizada' using errcode = 'PX001';
  end if;

  v_run := private.meta_locked_run(v_connection, p_run_id, p_ownership_token, p_expected_generation);

  v_hash := pg_catalog.md5(pg_catalog.jsonb_build_object(
    'level', p_level, 'dimension', p_dimension, 'fetched_at', private.meta_iso(p_fetched_at),
    'pages', p_pages, 'duration_ms', p_duration_ms, 'payload', p_payload)::text);

  select s.* into v_existing
    from public.meta_breakdown_snapshots s
   where s.id = p_snapshot_id
      or (s.sync_run_id = p_run_id and s.level = p_level and s.dimension = p_dimension)
   limit 1;

  if found then
    if v_existing.id <> p_snapshot_id or v_existing.sync_run_id <> p_run_id
       or v_existing.level <> p_level or v_existing.dimension <> p_dimension
       or v_existing.request_hash <> v_hash then
      raise exception 'praxa: argumento inválido' using errcode = '22023';
    end if;
    return query select v_existing.id, v_existing.level, v_existing.dimension;
    return;
  end if;

  perform private.meta_assert_current_run(v_connection, v_run);

  if p_fetched_at < v_run.started_at or p_fetched_at > pg_catalog.clock_timestamp() then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;

  -- Cotas duras: el extractor usa estas mismas con margen.
  if pg_catalog.jsonb_array_length(p_payload->'rows') > 6000
     or pg_catalog.octet_length(p_payload::text) > 5000000 then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;

  if exists (select 1 from pg_catalog.jsonb_array_elements(p_payload->'rows') r
              where not private.meta_valid_breakdown_row(r, p_dimension, v_run.window_from, v_run.window_to)) then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;

  if (select pg_catalog.count(*) <> pg_catalog.count(distinct (r->>'external_id', r->>'date',
                                                               r->>'segment_primary', r->>'segment_secondary'))
        from pg_catalog.jsonb_array_elements(p_payload->'rows') r) then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;

  -- Una entidad que el nivel no publicó no se crea acá: el desglose falla y se reintenta.
  if exists (select 1 from pg_catalog.jsonb_array_elements(p_payload->'rows') r
              where not exists (select 1 from public.meta_entities m
                                 where m.connection_id = p_connection_id
                                   and m.level = p_level
                                   and m.external_id = r->>'external_id')) then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;

  insert into public.meta_breakdown_snapshots
    (id, company_id, connection_id, sync_run_id, level, dimension, fetched_at, window_from, window_to,
     currency, timezone, pages, duration_ms, request_hash)
  values
    (p_snapshot_id, p_company_id, p_connection_id, p_run_id, p_level, p_dimension, p_fetched_at,
     v_run.window_from, v_run.window_to, v_connection.currency, v_connection.timezone, p_pages,
     p_duration_ms, v_hash);

  insert into public.meta_breakdown_rows
    (snapshot_id, entity_ref, date, segment_primary, segment_secondary, company_id, connection_id,
     spend, impressions, clicks, inline_link_clicks, ctr, cpc, cpm, actions)
  select p_snapshot_id, m.entity_ref, (r->>'date')::date, r->>'segment_primary',
         coalesce(r->>'segment_secondary', ''), p_company_id, p_connection_id,
         (r->>'spend')::numeric, (r->>'impressions')::bigint, (r->>'clicks')::bigint,
         (r->>'inline_link_clicks')::bigint, (r->>'ctr')::numeric, (r->>'cpc')::numeric,
         (r->>'cpm')::numeric, r->'actions'
    from pg_catalog.jsonb_array_elements(p_payload->'rows') r
    join public.meta_entities m
      on m.connection_id = p_connection_id and m.level = p_level and m.external_id = r->>'external_id';

  insert into public.meta_breakdown_coverage as c
    (connection_id, level, dimension, date, company_id, snapshot_id, fetched_at,
     captured_before_day_end, currency, timezone)
  select p_connection_id, p_level, p_dimension, v_run.window_from + i, p_company_id, p_snapshot_id,
         p_fetched_at,
         p_fetched_at < ((v_run.window_from + i + 1)::timestamp at time zone v_connection.timezone),
         v_connection.currency, v_connection.timezone
    from pg_catalog.generate_series(0, v_run.window_to - v_run.window_from) as i
  on conflict on constraint meta_breakdown_coverage_pkey do update
     set company_id = excluded.company_id,
         snapshot_id = excluded.snapshot_id,
         fetched_at = excluded.fetched_at,
         captured_before_day_end = excluded.captured_before_day_end,
         currency = excluded.currency,
         timezone = excluded.timezone;

  insert into public.meta_breakdown_status as st
    (connection_id, level, dimension, company_id, last_result, last_reason, last_attempt_at)
  values (p_connection_id, p_level, p_dimension, p_company_id, 'complete', null, p_fetched_at)
  on conflict on constraint meta_breakdown_status_pkey do update
     set last_result = excluded.last_result,
         last_reason = excluded.last_reason,
         last_attempt_at = excluded.last_attempt_at;

  return query select p_snapshot_id, p_level, p_dimension;
exception
  when integrity_constraint_violation then
    get stacked diagnostics v_constraint = constraint_name;
    perform private.raise_worker_integrity_error(v_constraint);
end;
$$;

-- Registra el fallo sin tocar la cobertura vigente ni el estado del run. Repetirlo es idempotente.
create function worker_api.record_breakdown_failure(
  p_actor_user_id       uuid,
  p_company_id          uuid,
  p_connection_id       uuid,
  p_expected_generation integer,
  p_run_id              uuid,
  p_ownership_token     text,
  p_level               text,
  p_dimension           text,
  p_reason              text,
  p_attempted_at        timestamptz
)
returns table (
  level     text,
  dimension text,
  result    text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection public.integration_connections;
  v_run        public.meta_sync_runs;
  v_constraint text;
begin
  perform private.assert_worker_actor(p_actor_user_id, p_company_id);

  if p_connection_id is null or p_expected_generation is null or p_run_id is null
     or p_ownership_token is null or p_level is null or p_dimension is null
     or p_reason is null or p_attempted_at is null
     or p_ownership_token !~ '^[0-9a-f]{64}$'
     or p_level not in ('account', 'campaign')
     or p_dimension not in ('age_gender', 'country', 'region')
     or p_reason not in ('page_limit', 'duration_limit', 'invalid_response', 'meta_error', 'own_error') then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;

  perform private.lock_company(p_company_id);

  select c.* into v_connection
    from public.integration_connections c
   where c.id = p_connection_id
     and c.company_id = p_company_id
   for update;

  if not found then
    raise exception 'praxa: operación no autorizada' using errcode = 'PX001';
  end if;

  v_run := private.meta_locked_run(v_connection, p_run_id, p_ownership_token, p_expected_generation);
  perform private.meta_assert_current_run(v_connection, v_run);

  if p_attempted_at < v_run.started_at or p_attempted_at > pg_catalog.clock_timestamp() then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;

  insert into public.meta_breakdown_status as st
    (connection_id, level, dimension, company_id, last_result, last_reason, last_attempt_at)
  values (p_connection_id, p_level, p_dimension, p_company_id, 'failed', p_reason, p_attempted_at)
  on conflict on constraint meta_breakdown_status_pkey do update
     set last_result = excluded.last_result,
         last_reason = excluded.last_reason,
         last_attempt_at = excluded.last_attempt_at;

  return query select p_level, p_dimension, 'failed'::text;
exception
  when integrity_constraint_violation then
    get stacked diagnostics v_constraint = constraint_name;
    perform private.raise_worker_integrity_error(v_constraint);
end;
$$;

-- ---------------------------------------------------------------------------
-- Lecturas públicas: INVOKER, bajo RLS
-- ---------------------------------------------------------------------------

-- Un día cubierto sin filas devuelve una fila con entidad y segmentos en null; un día sin
-- cobertura no devuelve nada. Así se distingue «sin datos reportados» de «no observado».
create function public.get_meta_breakdown(
  p_connection_id uuid,
  p_level         text,
  p_dimension     text,
  p_from          date,
  p_to            date,
  p_entity_ref    uuid default null
)
returns table (
  day                     date,
  level                   text,
  dimension               text,
  entity_ref              uuid,
  segment_primary         text,
  segment_secondary       text,
  spend                   text,
  impressions             text,
  clicks                  text,
  inline_link_clicks      text,
  ctr                     text,
  cpc                     text,
  cpm                     text,
  actions                 jsonb,
  currency                text,
  timezone                text,
  snapshot_id             uuid,
  fetched_at              timestamptz,
  captured_before_day_end boolean,
  temporal_status         text
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if p_connection_id is null or p_level is null or p_dimension is null or p_from is null or p_to is null
     or p_level not in ('account', 'campaign')
     or p_dimension not in ('age_gender', 'country', 'region')
     or p_to < p_from or p_to - p_from + 1 > 93 then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;

  return query
  select cov.date, cov.level, cov.dimension, r.entity_ref, r.segment_primary,
         nullif(r.segment_secondary, ''),
         r.spend::text, r.impressions::text, r.clicks::text, r.inline_link_clicks::text,
         r.ctr::text, r.cpc::text, r.cpm::text, r.actions,
         cov.currency, cov.timezone, cov.snapshot_id, cov.fetched_at, cov.captured_before_day_end,
         case when pg_catalog.statement_timestamp() < ((cov.date + 1)::timestamp at time zone cov.timezone)
              then 'abierto' else 'cerrado' end
    from public.meta_breakdown_coverage cov
    left join public.meta_breakdown_rows r
      on r.snapshot_id = cov.snapshot_id
     and r.date = cov.date
     and (p_entity_ref is null or r.entity_ref = p_entity_ref)
   where cov.connection_id = p_connection_id
     and cov.level = p_level
     and cov.dimension = p_dimension
     and cov.date between p_from and p_to
   order by cov.date, r.entity_ref nulls first, r.segment_primary collate "C", r.segment_secondary collate "C";
end;
$$;

create function public.get_meta_breakdown_status(p_connection_id uuid)
returns table (
  level           text,
  dimension       text,
  last_result     text,
  last_reason     text,
  last_attempt_at timestamptz,
  covered_from    date,
  covered_to      date,
  covered_days    integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select st.level, st.dimension, st.last_result, st.last_reason, st.last_attempt_at,
         pg_catalog.min(cov.date), pg_catalog.max(cov.date), pg_catalog.count(cov.date)::integer
    from public.meta_breakdown_status st
    left join public.meta_breakdown_coverage cov
      on cov.connection_id = st.connection_id and cov.level = st.level and cov.dimension = st.dimension
   where st.connection_id = p_connection_id
   group by st.level, st.dimension, st.last_result, st.last_reason, st.last_attempt_at
   order by st.level, st.dimension
$$;

-- ---------------------------------------------------------------------------
-- Privilegios de funciones
-- ---------------------------------------------------------------------------

revoke all on function private.meta_valid_segment(jsonb) from public, anon, authenticated, service_role;
revoke all on function private.meta_valid_breakdown_row(jsonb, text, date, date) from public, anon, authenticated, service_role;

revoke all on function worker_api.publish_breakdown(uuid, uuid, uuid, integer, uuid, text, uuid, text, text, timestamptz, integer, integer, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function worker_api.publish_breakdown(uuid, uuid, uuid, integer, uuid, text, uuid, text, text, timestamptz, integer, integer, jsonb)
  to praxa_integrations;

revoke all on function worker_api.record_breakdown_failure(uuid, uuid, uuid, integer, uuid, text, text, text, text, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function worker_api.record_breakdown_failure(uuid, uuid, uuid, integer, uuid, text, text, text, text, timestamptz)
  to praxa_integrations;

revoke all on function public.get_meta_breakdown(uuid, text, text, date, date, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_meta_breakdown(uuid, text, text, date, date, uuid) to authenticated;

revoke all on function public.get_meta_breakdown_status(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_meta_breakdown_status(uuid) to authenticated;
