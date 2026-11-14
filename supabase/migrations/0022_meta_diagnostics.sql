-- PRAXA 0022 — Diagnóstico de Meta Ads (M26a)
--
-- MATRIZ
--   public.diagnostic_settings            : SELECT authenticated (miembro). Sin escritura directa.
--   public.diagnostic_reports             : SELECT authenticated (miembro y conexión active o
--                                           needs_reauth). Sin escritura directa. Sin FK a la
--                                           conexión (retención, meta_first/spec.md §16).
--   private.meta_diagnostic_reservations  : sin grants ni políticas.
--   worker_api.save_diagnostic_settings, reserve_diagnostic, release_diagnostic,
--     publish_diagnostic                  : DEFINER, solo praxa_integrations.
--   public.meta_diagnostic_*              : INVOKER, STABLE, solo authenticated, bajo RLS.
--   private.meta_diagnostic_eligibility_core y auxiliares de lectura: INVOKER, EXECUTE solo
--                                           authenticated (las llaman las lecturas públicas).
--
-- REGLAS
--   * Orden de bloqueos: autorización → cerrojo de empresa → conexión FOR UPDATE → reserva
--     FOR UPDATE. El reloj es clock_timestamp() después de esos bloqueos.
--   * La elegibilidad vive en una sola función; la pantalla y la reserva no pueden discrepar.
--   * Toda cifra sale como texto decimal exacto; null es «no calculable» o «sin dato», nunca 0.
--     'mixed' en currency o attribution indica monedas o atribuciones conocidas distintas.
--   * Las funciones nuevas devuelven un outcome; no hay SQLSTATE nuevos.
--   * publish_diagnostic borra el informe anterior en la misma transacción que inserta el
--     nuevo: es la excepción de reversibilidad aprobada solo para esta operación (§16).

-- ---------------------------------------------------------------------------
-- Auxiliares de forma (dueño)
-- ---------------------------------------------------------------------------

create function private.meta_diagnostic_valid_settings(p_goal_kind text, p_metric_ref text)
returns boolean language sql immutable security invoker set search_path = '' as $$
  select coalesce(
    (p_goal_kind = 'traffic' and p_metric_ref = 'inline_link_clicks')
    or (p_goal_kind in ('purchase','inquiry') and p_metric_ref ~ '^actions:[A-Za-z0-9._]{1,128}$'),
    false)
$$;
revoke all on function private.meta_diagnostic_valid_settings(text,text)
  from public, anon, authenticated, service_role, praxa_integrations;

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table public.diagnostic_settings (
  company_id uuid primary key references public.companies(id) on delete cascade,
  goal_kind  text not null,
  metric_ref text not null,
  updated_at timestamptz not null default now(),
  -- Sin FK a auth.users: no impide borrar al usuario (CA-67).
  updated_by uuid not null,
  constraint diagnostic_settings_goal check (private.meta_diagnostic_valid_settings(goal_kind, metric_ref))
);
revoke all on table public.diagnostic_settings from public, anon, authenticated, service_role, praxa_integrations;
alter table public.diagnostic_settings enable row level security;
alter table public.diagnostic_settings force row level security;
create policy diagnostic_settings_select_member
  on public.diagnostic_settings for select to authenticated
  using (private.is_company_member(diagnostic_settings.company_id));
grant select on public.diagnostic_settings to authenticated;

create table public.diagnostic_reports (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references public.companies(id) on delete cascade,
  connection_id         uuid not null,
  credential_generation integer not null,
  request_id            uuid not null,
  generated_at          timestamptz not null,
  window_from           date not null,
  window_to             date not null,
  prev_from             date,
  prev_to               date,
  sync_finished_at      timestamptz not null,
  schema_version        integer not null,
  methodology_version   text not null,
  settings              jsonb not null,
  evidence              jsonb not null,
  output                jsonb not null,
  web_sources           jsonb not null,
  model_requested       text not null,
  model_reported        text,
  usage                 jsonb not null,
  constraint diagnostic_reports_request_key unique (request_id),
  constraint diagnostic_reports_company_key unique (company_id),
  constraint diagnostic_reports_window check (window_to - window_from = 27),
  constraint diagnostic_reports_prev check ((prev_from is null and prev_to is null)
    or (prev_to = window_from - 1 and prev_to - prev_from = 27)),
  constraint diagnostic_reports_generation check (credential_generation >= 0),
  constraint diagnostic_reports_versions check (schema_version = 1 and methodology_version = 'meta-diag-1'),
  constraint diagnostic_reports_models check (pg_catalog.char_length(model_requested) between 1 and 128
    and (model_reported is null or pg_catalog.char_length(model_reported) between 1 and 128)),
  constraint diagnostic_reports_size check (
    pg_catalog.octet_length(settings::text) + pg_catalog.octet_length(evidence::text)
    + pg_catalog.octet_length(output::text) + pg_catalog.octet_length(web_sources::text)
    + pg_catalog.octet_length(usage::text) <= 1048576)
);
revoke all on table public.diagnostic_reports from public, anon, authenticated, service_role, praxa_integrations;
alter table public.diagnostic_reports enable row level security;
alter table public.diagnostic_reports force row level security;
-- La base, no solo la pantalla, oculta el informe tras desconectar o reconectar a otra conexión.
create policy diagnostic_reports_select_member
  on public.diagnostic_reports for select to authenticated
  using (
    private.is_company_member(diagnostic_reports.company_id)
    and exists (
      select 1 from public.integration_connections c
       where c.id = diagnostic_reports.connection_id
         and c.company_id = diagnostic_reports.company_id
         and c.status in ('active', 'needs_reauth'))
  );
grant select on public.diagnostic_reports to authenticated;

create table private.meta_diagnostic_reservations (
  company_id            uuid primary key references public.companies(id) on delete cascade,
  request_id            uuid not null,
  connection_id         uuid not null,
  credential_generation integer not null,
  sync_finished_at      timestamptz not null,
  started_at            timestamptz not null,
  expires_at            timestamptz not null,
  constraint meta_diagnostic_reservations_expiry check (expires_at > started_at)
);
revoke all on table private.meta_diagnostic_reservations
  from public, anon, authenticated, service_role, praxa_integrations;
alter table private.meta_diagnostic_reservations enable row level security;
alter table private.meta_diagnostic_reservations force row level security;

-- ---------------------------------------------------------------------------
-- Auxiliares de lectura (INVOKER; las llaman las lecturas públicas como authenticated)
-- ---------------------------------------------------------------------------

create function private.meta_diagnostic_assert_window(p_from date, p_to date)
returns void language plpgsql immutable security invoker set search_path = '' as $$
begin
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from + 1 > 28 then
    raise exception 'praxa: período inválido' using errcode = '22023';
  end if;
end;
$$;

create function private.meta_diagnostic_assert_metric(p_metric_ref text)
returns void language plpgsql immutable security invoker set search_path = '' as $$
begin
  if p_metric_ref is null
     or not (p_metric_ref = 'inline_link_clicks' or p_metric_ref ~ '^actions:[A-Za-z0-9._]{1,128}$') then
    raise exception 'praxa: métrica inválida' using errcode = '22023';
  end if;
end;
$$;

-- Misma semántica que la referencia de atribución del chat, sin llamarla.
create function private.meta_diagnostic_attribution_ref(p_attribution jsonb)
returns text language sql immutable security invoker set search_path = '' as $$
  select case when coalesce((p_attribution->>'known')::boolean,false) is false then 'unknown'
    else 'attr_' || pg_catalog.md5(
      coalesce(p_attribution->>'report_time','') || '|' ||
      coalesce(p_attribution->>'unified','') || '|' ||
      coalesce((select pg_catalog.jsonb_agg(distinct w.window_set order by w.window_set)::text
        from (select coalesce((select pg_catalog.jsonb_agg(distinct x.item order by x.item)
            from pg_catalog.jsonb_array_elements(coalesce(s.setting->'windows','[]'::jsonb)) x(item)),
            '[]'::jsonb) as window_set
          from pg_catalog.jsonb_array_elements(coalesce(p_attribution->'settings','[]'::jsonb)) s(setting)) w),
        '[]')
      ) end
$$;

-- Suma del conteo o del valor de un tipo de acción, solo variant = 'value'. Sin coincidencias, null.
create function private.meta_diagnostic_action_sum(p_actions jsonb, p_metric_ref text, p_part text)
returns numeric language sql immutable security invoker set search_path = '' as $$
  select case when p_metric_ref like 'actions:%' then
    (select pg_catalog.sum((a->>p_part)::numeric)
       from pg_catalog.jsonb_array_elements(coalesce(p_actions,'[]'::jsonb)) a
      where a->>'action_type' = pg_catalog.substr(p_metric_ref, 9) and a->>'variant' = 'value')
  end
$$;

-- Actividad observada en una fila: gasto, impresiones, clics o alguna acción mayor que cero.
create function private.meta_diagnostic_row_active(p_row jsonb)
returns boolean language sql immutable security invoker set search_path = '' as $$
  select coalesce((p_row->>'spend')::numeric,0) > 0 or coalesce((p_row->>'impressions')::numeric,0) > 0
      or coalesce((p_row->>'clicks')::numeric,0) > 0 or coalesce((p_row->>'inline_link_clicks')::numeric,0) > 0
      or exists (select 1 from pg_catalog.jsonb_array_elements(coalesce(p_row->'actions','[]'::jsonb)) a
                  where coalesce((a->>'count')::numeric,0) > 0)
$$;

-- Cociente con escala; denominador cero o base ausente da null (no calculable).
create function private.meta_diagnostic_ratio(p_num numeric, p_den numeric, p_scale numeric)
returns numeric language sql immutable security invoker set search_path = '' as $$
  select case when p_num is null or p_den is null or p_den = 0 then null else p_scale * p_num / p_den end
$$;

create function private.meta_diagnostic_text(p_value numeric)
returns text language sql immutable security invoker set search_path = '' as $$
  select case when p_value is null then null else pg_catalog.round(p_value, 6)::text end
$$;

create function private.meta_diagnostic_variation(p_cur numeric, p_prev numeric)
returns text language sql immutable security invoker set search_path = '' as $$
  select case when p_cur is null or p_prev is null or p_prev = 0 then null
    else pg_catalog.round(100 * (p_cur - p_prev) / p_prev, 6)::text end
$$;

revoke all on function private.meta_diagnostic_assert_window(date,date) from public,anon,authenticated,service_role,praxa_integrations;
revoke all on function private.meta_diagnostic_assert_metric(text) from public,anon,authenticated,service_role,praxa_integrations;
revoke all on function private.meta_diagnostic_attribution_ref(jsonb) from public,anon,authenticated,service_role,praxa_integrations;
revoke all on function private.meta_diagnostic_action_sum(jsonb,text,text) from public,anon,authenticated,service_role,praxa_integrations;
revoke all on function private.meta_diagnostic_row_active(jsonb) from public,anon,authenticated,service_role,praxa_integrations;
revoke all on function private.meta_diagnostic_ratio(numeric,numeric,numeric) from public,anon,authenticated,service_role,praxa_integrations;
revoke all on function private.meta_diagnostic_text(numeric) from public,anon,authenticated,service_role,praxa_integrations;
revoke all on function private.meta_diagnostic_variation(numeric,numeric) from public,anon,authenticated,service_role,praxa_integrations;
grant execute on function private.meta_diagnostic_assert_window(date,date) to authenticated;
grant execute on function private.meta_diagnostic_assert_metric(text) to authenticated;
grant execute on function private.meta_diagnostic_attribution_ref(jsonb) to authenticated;
grant execute on function private.meta_diagnostic_action_sum(jsonb,text,text) to authenticated;
grant execute on function private.meta_diagnostic_row_active(jsonb) to authenticated;
grant execute on function private.meta_diagnostic_ratio(numeric,numeric,numeric) to authenticated;
grant execute on function private.meta_diagnostic_text(numeric) to authenticated;
grant execute on function private.meta_diagnostic_variation(numeric,numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- Elegibilidad: una sola regla para la pantalla (INVOKER, bajo RLS) y la reserva (DEFINER)
-- ---------------------------------------------------------------------------

create function private.meta_diagnostic_eligibility_core(p_company_id uuid, p_connection_id uuid)
returns table (eligible boolean, reason text, available_at text, sync_finished_at text, window_to date)
language plpgsql stable security invoker set search_path = '' as $$
declare
  v_connection public.integration_connections;
  v_summary    jsonb;
  v_status     text;
  v_now        timestamptz := pg_catalog.clock_timestamp();
  v_finished   timestamptz;
  v_window_to  date;
  v_iso        text;
  v_report_at  timestamptz;
begin
  if p_company_id is null or p_connection_id is null then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;
  -- 1. Objetivo guardado.
  if not exists (select 1 from public.diagnostic_settings s where s.company_id = p_company_id) then
    return query select false, 'no_settings'::text, null::text, null::text, null::date; return;
  end if;
  -- 2. Conexión activa de la empresa.
  select c.* into v_connection from public.integration_connections c
   where c.id = p_connection_id and c.company_id = p_company_id;
  if not found or v_connection.status <> 'active' then
    return query select false, 'connection_not_active'::text, null::text, null::text, null::date; return;
  end if;
  -- 3 a 5. Resumen del último intento.
  v_summary := v_connection.meta_sync_summary;
  if v_summary is null then
    return query select false, 'sync_missing'::text, null::text, null::text, null::date; return;
  end if;
  v_status := v_summary->>'status';
  if v_status = 'running' and (v_summary->>'lease_expires_at')::timestamptz > v_now then
    return query select false, 'sync_running'::text, null::text, null::text, null::date; return;
  end if;
  if v_status not in ('completed', 'partial') or v_summary->>'finished_at' is null
     or (v_status = 'partial' and v_summary#>>'{levels,account,status}' is distinct from 'complete') then
    return query select false, 'sync_not_usable'::text, null::text, null::text, null::date; return;
  end if;
  v_finished := (v_summary->>'finished_at')::timestamptz;
  v_window_to := (v_summary->>'window_to')::date;
  v_iso := pg_catalog.to_char(v_finished at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
  -- 6. Sincronización de menos de 24 h (instante absoluto, reloj de la base).
  if v_finished <= v_now - interval '24 hours' then
    return query select false, 'sync_stale'::text, null::text, v_iso, v_window_to; return;
  end if;
  -- 7 y 8. Informe vigente de la misma conexión.
  select pg_catalog.max(r.generated_at) into v_report_at from public.diagnostic_reports r
   where r.company_id = p_company_id and r.connection_id = p_connection_id;
  if v_report_at is not null and v_finished <= v_report_at then
    return query select false, 'sync_not_after_report'::text, null::text, v_iso, v_window_to; return;
  end if;
  if v_report_at is not null and v_now < v_report_at + interval '24 hours' then
    return query select false, 'too_soon'::text,
      pg_catalog.to_char((v_report_at + interval '24 hours') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      v_iso, v_window_to;
    return;
  end if;
  return query select true, null::text, null::text, v_iso, v_window_to;
end;
$$;
revoke all on function private.meta_diagnostic_eligibility_core(uuid,uuid)
  from public, anon, authenticated, service_role, praxa_integrations;
grant execute on function private.meta_diagnostic_eligibility_core(uuid,uuid) to authenticated;

create function public.meta_diagnostic_eligibility(p_connection_id uuid)
returns table (eligible boolean, reason text, available_at text, sync_finished_at text, window_to date)
language plpgsql stable security invoker set search_path = '' as $$
declare v_company uuid;
begin
  if p_connection_id is null then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;
  -- La empresa sale de la conexión visible bajo RLS; nunca del navegador.
  select c.company_id into v_company from public.integration_connections c where c.id = p_connection_id;
  if not found then
    return query select false, 'connection_not_active'::text, null::text, null::text, null::date; return;
  end if;
  return query select * from private.meta_diagnostic_eligibility_core(v_company, p_connection_id);
end;
$$;
revoke all on function public.meta_diagnostic_eligibility(uuid)
  from public, anon, authenticated, service_role, praxa_integrations;
grant execute on function public.meta_diagnostic_eligibility(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Escrituras (worker_api)
-- ---------------------------------------------------------------------------

create function worker_api.save_diagnostic_settings(
  p_actor_user_id uuid, p_company_id uuid, p_goal_kind text, p_metric_ref text
) returns text language plpgsql security definer set search_path = '' as $$
declare v_constraint text;
begin
  perform private.assert_worker_actor(p_actor_user_id, p_company_id);
  if not private.meta_diagnostic_valid_settings(p_goal_kind, p_metric_ref) then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;
  perform private.lock_company(p_company_id);
  insert into public.diagnostic_settings as s (company_id, goal_kind, metric_ref, updated_at, updated_by)
  values (p_company_id, p_goal_kind, p_metric_ref, pg_catalog.clock_timestamp(), p_actor_user_id)
  on conflict (company_id) do update
     set goal_kind = excluded.goal_kind, metric_ref = excluded.metric_ref,
         updated_at = excluded.updated_at, updated_by = excluded.updated_by
   where (s.goal_kind, s.metric_ref) is distinct from (excluded.goal_kind, excluded.metric_ref);
  return 'saved';
exception when integrity_constraint_violation then
  get stacked diagnostics v_constraint = constraint_name;
  perform private.raise_worker_integrity_error(v_constraint);
  return null;
end;
$$;

create function worker_api.reserve_diagnostic(
  p_actor_user_id uuid, p_company_id uuid, p_request_id uuid, p_connection_id uuid,
  p_expected_generation integer, p_expected_sync_finished_at timestamptz, p_ttl_seconds integer
) returns text language plpgsql security definer set search_path = '' as $$
declare
  v_connection public.integration_connections;
  v_connection_found boolean;
  v_reservation private.meta_diagnostic_reservations;
  v_eligibility record;
  v_now timestamptz;
  v_constraint text;
begin
  perform private.assert_worker_actor(p_actor_user_id, p_company_id);
  if p_request_id is null or p_connection_id is null or p_expected_generation is null
     or p_expected_sync_finished_at is null or p_ttl_seconds is null
     or p_ttl_seconds not between 1 and 900 then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;
  perform private.lock_company(p_company_id);
  select c.* into v_connection from public.integration_connections c
   where c.id = p_connection_id and c.company_id = p_company_id for update;
  v_connection_found := found;
  select r.* into v_reservation from private.meta_diagnostic_reservations r
   where r.company_id = p_company_id for update;
  v_now := pg_catalog.clock_timestamp();
  if found and v_reservation.expires_at > v_now then
    if v_reservation.request_id = p_request_id then return 'already_reserved'; end if;
    return 'in_progress';
  end if;
  if not v_connection_found or v_connection.credential_generation <> p_expected_generation then
    return 'connection_changed';
  end if;
  -- La misma regla que ve la pantalla, con el reloj posterior a los bloqueos.
  select * into v_eligibility from private.meta_diagnostic_eligibility_core(p_company_id, p_connection_id);
  if not v_eligibility.eligible then return v_eligibility.reason; end if;
  if (v_connection.meta_sync_summary->>'finished_at')::timestamptz is distinct from p_expected_sync_finished_at then
    return 'sync_changed';
  end if;
  insert into private.meta_diagnostic_reservations as r
    (company_id, request_id, connection_id, credential_generation, sync_finished_at, started_at, expires_at)
  values (p_company_id, p_request_id, p_connection_id, v_connection.credential_generation,
          p_expected_sync_finished_at, v_now, v_now + pg_catalog.make_interval(secs => p_ttl_seconds))
  on conflict (company_id) do update
     set request_id = excluded.request_id, connection_id = excluded.connection_id,
         credential_generation = excluded.credential_generation,
         sync_finished_at = excluded.sync_finished_at, started_at = excluded.started_at,
         expires_at = excluded.expires_at;
  return 'reserved';
exception when integrity_constraint_violation then
  get stacked diagnostics v_constraint = constraint_name;
  perform private.raise_worker_integrity_error(v_constraint);
  return null;
end;
$$;

create function worker_api.release_diagnostic(
  p_actor_user_id uuid, p_company_id uuid, p_request_id uuid
) returns boolean language plpgsql security definer set search_path = '' as $$
declare v_constraint text;
begin
  perform private.assert_worker_actor(p_actor_user_id, p_company_id);
  if p_request_id is null then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;
  perform private.lock_company(p_company_id);
  delete from private.meta_diagnostic_reservations r
   where r.company_id = p_company_id and r.request_id = p_request_id;
  return found;
exception when integrity_constraint_violation then
  get stacked diagnostics v_constraint = constraint_name;
  perform private.raise_worker_integrity_error(v_constraint);
  return false;
end;
$$;

-- Forma persistida (claves exactas) y coherencia con la reserva y la sincronización.
create function private.meta_diagnostic_valid_report(p_report jsonb, p_window_to date, p_sync_finished_at timestamptz)
returns boolean language sql stable security invoker set search_path = '' as $$
  select coalesce(
    private.meta_has_exact_keys(p_report, array['schema_version','methodology_version','window',
      'settings','sync_finished_at','evidence','output','web_sources','model_requested',
      'model_reported','usage'])
    and pg_catalog.octet_length(p_report::text) <= 1048576
    and p_report->'schema_version' = '1'::jsonb
    and p_report->>'methodology_version' = 'meta-diag-1'
    and private.meta_has_exact_keys(p_report->'window', array['from','to','prev_from','prev_to'])
    and private.meta_try_date(p_report#>>'{window,to}') = p_window_to
    and private.meta_try_date(p_report#>>'{window,from}') = p_window_to - 27
    and ((p_report#>'{window,prev_from}' = 'null'::jsonb and p_report#>'{window,prev_to}' = 'null'::jsonb)
      or (private.meta_try_date(p_report#>>'{window,prev_to}') = p_window_to - 28
          and private.meta_try_date(p_report#>>'{window,prev_from}') = p_window_to - 55))
    and private.meta_has_exact_keys(p_report->'settings', array['goal_kind','metric_ref'])
    and private.meta_diagnostic_valid_settings(p_report#>>'{settings,goal_kind}', p_report#>>'{settings,metric_ref}')
    and pg_catalog.jsonb_typeof(p_report->'sync_finished_at') = 'string'
    and private.meta_try_timestamptz(p_report->>'sync_finished_at') = p_sync_finished_at
    and private.meta_has_exact_keys(p_report->'evidence', array['items','totals','manifest'])
    and pg_catalog.jsonb_typeof(p_report#>'{evidence,items}') = 'array'
    and pg_catalog.jsonb_typeof(p_report#>'{evidence,totals}') = 'object'
    and pg_catalog.jsonb_typeof(p_report#>'{evidence,manifest}') = 'object'
    and pg_catalog.jsonb_typeof(p_report->'output') = 'object'
    and pg_catalog.jsonb_typeof(p_report->'web_sources') = 'array'
    and pg_catalog.jsonb_typeof(p_report->'model_requested') = 'string'
    and pg_catalog.char_length(p_report->>'model_requested') between 1 and 128
    and (p_report->'model_reported' = 'null'::jsonb
      or (pg_catalog.jsonb_typeof(p_report->'model_reported') = 'string'
          and pg_catalog.char_length(p_report->>'model_reported') between 1 and 128))
    and private.meta_has_exact_keys(p_report->'usage', array['calls','batches','steps'])
    and private.meta_valid_int(p_report#>'{usage,calls}', 0)
    and private.meta_valid_int(p_report#>'{usage,batches}', 0)
    and pg_catalog.jsonb_typeof(p_report#>'{usage,steps}') = 'array',
    false)
$$;
revoke all on function private.meta_diagnostic_valid_report(jsonb,date,timestamptz)
  from public, anon, authenticated, service_role, praxa_integrations;

create function worker_api.publish_diagnostic(
  p_actor_user_id uuid, p_company_id uuid, p_request_id uuid, p_connection_id uuid,
  p_expected_generation integer, p_report jsonb
) returns text language plpgsql security definer set search_path = '' as $$
declare
  v_connection public.integration_connections;
  v_connection_found boolean;
  v_reservation private.meta_diagnostic_reservations;
  v_reservation_found boolean;
  v_now timestamptz;
  v_constraint text;
begin
  perform private.assert_worker_actor(p_actor_user_id, p_company_id);
  if p_request_id is null or p_connection_id is null or p_expected_generation is null or p_report is null then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;
  perform private.lock_company(p_company_id);
  if exists (select 1 from public.diagnostic_reports r
              where r.company_id = p_company_id and r.request_id = p_request_id) then
    return 'already_published';
  end if;
  select c.* into v_connection from public.integration_connections c
   where c.id = p_connection_id and c.company_id = p_company_id for update;
  v_connection_found := found;
  select r.* into v_reservation from private.meta_diagnostic_reservations r
   where r.company_id = p_company_id and r.request_id = p_request_id for update;
  v_reservation_found := found;
  v_now := pg_catalog.clock_timestamp();
  if not v_reservation_found or v_reservation.expires_at <= v_now
     or v_reservation.connection_id <> p_connection_id then
    return 'reservation_lost';
  end if;
  if not v_connection_found or v_connection.status <> 'active'
     or v_connection.credential_generation <> p_expected_generation
     or v_connection.credential_generation <> v_reservation.credential_generation then
    return 'connection_changed';
  end if;
  if v_connection.meta_sync_summary->>'status' is distinct from 'completed'
       and v_connection.meta_sync_summary->>'status' is distinct from 'partial'
     or (v_connection.meta_sync_summary->>'finished_at')::timestamptz
          is distinct from v_reservation.sync_finished_at then
    return 'sync_changed';
  end if;
  if not private.meta_diagnostic_valid_report(p_report,
       (v_connection.meta_sync_summary->>'window_to')::date, v_reservation.sync_finished_at) then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;
  -- Una sola transacción: borrar el anterior, insertar el nuevo y soltar la reserva.
  delete from public.diagnostic_reports r where r.company_id = p_company_id;
  insert into public.diagnostic_reports (company_id, connection_id, credential_generation, request_id,
    generated_at, window_from, window_to, prev_from, prev_to, sync_finished_at, schema_version,
    methodology_version, settings, evidence, output, web_sources, model_requested, model_reported, usage)
  values (p_company_id, p_connection_id, v_connection.credential_generation, p_request_id, v_now,
    (p_report#>>'{window,from}')::date, (p_report#>>'{window,to}')::date,
    (p_report#>>'{window,prev_from}')::date, (p_report#>>'{window,prev_to}')::date,
    v_reservation.sync_finished_at, 1, p_report->>'methodology_version', p_report->'settings',
    p_report->'evidence', p_report->'output', p_report->'web_sources', p_report->>'model_requested',
    p_report->>'model_reported', p_report->'usage');
  delete from private.meta_diagnostic_reservations r where r.company_id = p_company_id;
  return 'published';
exception when integrity_constraint_violation then
  get stacked diagnostics v_constraint = constraint_name;
  perform private.raise_worker_integrity_error(v_constraint);
  return null;
end;
$$;

revoke all on function worker_api.save_diagnostic_settings(uuid,uuid,text,text)
  from public,anon,authenticated,service_role,praxa_integrations;
grant execute on function worker_api.save_diagnostic_settings(uuid,uuid,text,text) to praxa_integrations;
revoke all on function worker_api.reserve_diagnostic(uuid,uuid,uuid,uuid,integer,timestamptz,integer)
  from public,anon,authenticated,service_role,praxa_integrations;
grant execute on function worker_api.reserve_diagnostic(uuid,uuid,uuid,uuid,integer,timestamptz,integer)
  to praxa_integrations;
revoke all on function worker_api.release_diagnostic(uuid,uuid,uuid)
  from public,anon,authenticated,service_role,praxa_integrations;
grant execute on function worker_api.release_diagnostic(uuid,uuid,uuid) to praxa_integrations;
revoke all on function worker_api.publish_diagnostic(uuid,uuid,uuid,uuid,integer,jsonb)
  from public,anon,authenticated,service_role,praxa_integrations;
grant execute on function worker_api.publish_diagnostic(uuid,uuid,uuid,uuid,integer,jsonb) to praxa_integrations;

-- ---------------------------------------------------------------------------
-- Lecturas (INVOKER, bajo RLS de la cobertura; máximo 28 días por ventana)
-- ---------------------------------------------------------------------------

create function public.meta_diagnostic_action_types(p_connection_id uuid, p_from date, p_to date)
returns table (action_type text, observed_days integer, total_count text)
language plpgsql stable security invoker set search_path = '' as $$
begin
  if p_connection_id is null then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;
  perform private.meta_diagnostic_assert_window(p_from, p_to);
  return query
  select x.kind, pg_catalog.count(distinct x.day)::integer, pg_catalog.sum(x.amount)::text
    from (select c.date as day, a.item->>'action_type' as kind, (a.item->>'count')::numeric as amount
            from public.meta_daily_coverage c
           cross join lateral pg_catalog.jsonb_array_elements(c.rows) r(row_data)
           cross join lateral pg_catalog.jsonb_array_elements(
             coalesce(r.row_data->'actions','[]'::jsonb)) a(item)
           where c.connection_id = p_connection_id and c.level = 'account'
             and c.date between p_from and p_to and a.item->>'variant' = 'value') x
   group by x.kind
   order by x.kind collate "C";
end;
$$;

create function public.meta_diagnostic_account_metrics(
  p_connection_id uuid, p_from date, p_to date, p_prev_from date, p_prev_to date, p_metric_ref text
) returns table (
  period text, spend text, impressions text, clicks text, link_clicks text, result_count text,
  result_value text, ctr text, cpc text, cpm text, cost_per_result text, attributed_return text,
  currency text, attribution text, days_with_data integer, days_no_row integer,
  days_not_observed integer, days_open integer, days_partial integer, activity_status text,
  fetched_at_min text, fetched_at_max text, open_dates date[], partial_dates date[]
) language plpgsql stable security invoker set search_path = '' as $$
begin
  if p_connection_id is null or (p_prev_from is null) <> (p_prev_to is null) then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;
  perform private.meta_diagnostic_assert_window(p_from, p_to);
  if p_prev_from is not null then perform private.meta_diagnostic_assert_window(p_prev_from, p_prev_to); end if;
  perform private.meta_diagnostic_assert_metric(p_metric_ref);
  return query
  with periods as (
    select 'current'::text as per, p_from as f, p_to as t
    union all select 'previous', p_prev_from, p_prev_to where p_prev_from is not null
  ), cov as materialized (
    select p.per, p.f + i as day, c.date is not null as covered, c.currency as cur_code, c.timezone,
           c.fetched_at, c.captured_before_day_end, c.rows
      from periods p
     cross join lateral pg_catalog.generate_series(0, p.t - p.f) i
      left join public.meta_daily_coverage c
        on c.connection_id = p_connection_id and c.level = 'account' and c.date = p.f + i
  ), stats as (
    select c.per,
      pg_catalog.count(*) filter (where c.covered and pg_catalog.jsonb_array_length(c.rows) > 0)::integer as d_data,
      pg_catalog.count(*) filter (where c.covered and pg_catalog.jsonb_array_length(c.rows) = 0)::integer as d_no_row,
      pg_catalog.count(*) filter (where not c.covered)::integer as d_not_obs,
      pg_catalog.array_agg(c.day order by c.day) filter (where c.covered
        and pg_catalog.statement_timestamp() < ((c.day + 1)::timestamp at time zone c.timezone)) as open_d,
      pg_catalog.array_agg(c.day order by c.day) filter (where c.covered and c.captured_before_day_end) as part_d,
      pg_catalog.min(c.fetched_at) as f_min, pg_catalog.max(c.fetched_at) as f_max
    from cov c group by c.per
  ), raw as (
    select c.per, c.cur_code,
      (r->>'spend')::numeric as sp, (r->>'impressions')::numeric as im, (r->>'clicks')::numeric as cl,
      (r->>'inline_link_clicks')::numeric as lk,
      case when p_metric_ref = 'inline_link_clicks' then (r->>'inline_link_clicks')::numeric
        else private.meta_diagnostic_action_sum(r->'actions', p_metric_ref, 'count') end as rc,
      private.meta_diagnostic_action_sum(r->'actions', p_metric_ref, 'value') as rv,
      private.meta_diagnostic_attribution_ref(r->'attribution') as at,
      private.meta_diagnostic_row_active(r) as act
    from cov c cross join lateral pg_catalog.jsonb_array_elements(c.rows) r
    where c.covered
  ), agg as (
    select x.per, pg_catalog.sum(x.sp) as sp, pg_catalog.sum(x.im) as im, pg_catalog.sum(x.cl) as cl,
      pg_catalog.sum(x.lk) as lk, pg_catalog.sum(x.rc) as rc, pg_catalog.sum(x.rv) as rv,
      pg_catalog.count(distinct x.cur_code) filter (where x.sp is not null or x.rv is not null)::integer as n_cur,
      pg_catalog.min(x.cur_code) filter (where x.sp is not null or x.rv is not null) as cur_code,
      pg_catalog.count(distinct x.at) filter (where x.at <> 'unknown' and (x.rc is not null or x.rv is not null))::integer as n_known,
      pg_catalog.min(x.at) filter (where x.at <> 'unknown' and (x.rc is not null or x.rv is not null)) as known_at,
      coalesce(pg_catalog.bool_or(x.at = 'unknown' and (x.rc is not null or x.rv is not null)), false) as has_unknown,
      coalesce(pg_catalog.bool_or(x.act), false) as act
    from raw x group by x.per
  ), calc as (
    select s.*, a.sp, a.im, a.cl, a.lk, a.rv, a.n_cur, a.cur_code, a.n_known, a.known_at, a.has_unknown,
      coalesce(a.act, false) as act,
      coalesce(a.n_cur, 0) <= 1 as money_ok,
      (p_metric_ref = 'inline_link_clicks' or coalesce(a.n_known, 0) <= 1) as attr_ok,
      a.rc
    from periods p join stats s on s.per = p.per left join agg a on a.per = p.per
  )
  select k.per,
    case when k.money_ok then k.sp::text end,
    k.im::text, k.cl::text, k.lk::text,
    case when k.attr_ok then k.rc::text end,
    case when k.attr_ok and k.money_ok then k.rv::text end,
    private.meta_diagnostic_text(private.meta_diagnostic_ratio(k.cl, k.im, 100)),
    case when k.money_ok then private.meta_diagnostic_text(private.meta_diagnostic_ratio(k.sp, k.cl, 1)) end,
    case when k.money_ok then private.meta_diagnostic_text(private.meta_diagnostic_ratio(k.sp, k.im, 1000)) end,
    case when k.money_ok and k.attr_ok then private.meta_diagnostic_text(private.meta_diagnostic_ratio(k.sp, k.rc, 1)) end,
    case when k.money_ok and k.attr_ok and p_metric_ref <> 'inline_link_clicks'
      then private.meta_diagnostic_text(private.meta_diagnostic_ratio(k.rv, k.sp, 1)) end,
    case when not k.money_ok then 'mixed' else k.cur_code end,
    case when k.n_known > 1 then 'mixed' when k.has_unknown or k.known_at is null then 'unknown' else k.known_at end,
    k.d_data, k.d_no_row, k.d_not_obs, coalesce(pg_catalog.cardinality(k.open_d), 0),
    coalesce(pg_catalog.cardinality(k.part_d), 0),
    case when k.act then 'active' when k.d_not_obs = 0 then 'zero' else 'no_coverage' end,
    case when k.f_min is null then null else pg_catalog.to_char(k.f_min at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') end,
    case when k.f_max is null then null else pg_catalog.to_char(k.f_max at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') end,
    coalesce(k.open_d, '{}'::date[]), coalesce(k.part_d, '{}'::date[])
  from calc k
  order by case k.per when 'current' then 0 else 1 end;
end;
$$;

create function public.meta_diagnostic_entity_metrics(
  p_connection_id uuid, p_level text, p_from date, p_to date, p_prev_from date, p_prev_to date,
  p_metric_ref text, p_after_spend text, p_after_ref uuid, p_limit integer
) returns table (
  entity_ref uuid, name text, parent_ref uuid, effective_status text, objective text,
  currency text, attribution text,
  cur_spend text, cur_impressions text, cur_clicks text, cur_result_count text, cur_result_value text,
  cur_ctr text, cur_cpc text, cur_cpm text, cur_cost_per_result text, cur_attributed_return text,
  prev_spend text, prev_impressions text, prev_clicks text, prev_result_count text, prev_result_value text,
  prev_ctr text, prev_cpc text, prev_cpm text, prev_cost_per_result text, prev_attributed_return text,
  var_spend text, var_ctr text, var_cost_per_result text, var_attributed_return text,
  days_with_row integer, days_open integer
) language plpgsql stable security invoker set search_path = '' as $$
declare
  v_after numeric;
  v_traffic boolean := p_metric_ref = 'inline_link_clicks';
  v_action text := case when p_metric_ref like 'actions:%' then pg_catalog.substr(p_metric_ref, 9) end;
begin
  if p_connection_id is null or p_level is null or p_level not in ('campaign','adset','ad')
     or (p_prev_from is null) <> (p_prev_to is null)
     or p_limit is null or p_limit not between 1 and 500
     or (p_after_spend is not null and (p_after_spend !~ '^[0-9]{1,20}([.][0-9]{1,12})?$' or p_after_ref is null)) then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;
  perform private.meta_diagnostic_assert_window(p_from, p_to);
  if p_prev_from is not null then perform private.meta_diagnostic_assert_window(p_prev_from, p_prev_to); end if;
  perform private.meta_diagnostic_assert_metric(p_metric_ref);
  v_after := p_after_spend::numeric;
  return query
  with cov as materialized (
    select c.date, c.currency as cur_code, c.timezone, c.rows, c.entities,
           case when c.date between p_from and p_to then 'cur' else 'prev' end as per
      from public.meta_daily_coverage c
     where c.connection_id = p_connection_id and c.level = p_level
       and (c.date between p_from and p_to
            or (p_prev_from is not null and c.date between p_prev_from and p_prev_to))
  ), raw0 as materialized (
    -- Sin auxiliares por fila: una función con SET no se inlinea y su costo domina con
    -- decenas de miles de filas. Las acciones se recorren una sola vez por fila.
    select c.per, c.cur_code,
      c.per = 'cur' and pg_catalog.statement_timestamp() < ((c.date + 1)::timestamp at time zone c.timezone) as op,
      (r.x->>'entity_ref')::uuid as ref,
      (r.x->>'spend')::numeric as sp, (r.x->>'impressions')::numeric as im, (r.x->>'clicks')::numeric as cl,
      case when v_traffic then (r.x->>'inline_link_clicks')::numeric else act.rc end as rc,
      case when v_traffic then null::numeric else act.rv end as rv,
      case when coalesce((r.x#>>'{attribution,known}')::boolean, false) then r.x->'attribution' end as aj,
      coalesce((r.x->>'spend')::numeric, 0) > 0 or coalesce((r.x->>'impressions')::numeric, 0) > 0
        or coalesce((r.x->>'clicks')::numeric, 0) > 0 or coalesce((r.x->>'inline_link_clicks')::numeric, 0) > 0
        or coalesce(act.any_act, false) as act
    from cov c
    cross join lateral pg_catalog.jsonb_array_elements(c.rows) r(x)
    left join lateral (
      select pg_catalog.sum((a.y->>'count')::numeric)
               filter (where a.y->>'action_type' = v_action and a.y->>'variant' = 'value') as rc,
             pg_catalog.sum((a.y->>'value')::numeric)
               filter (where a.y->>'action_type' = v_action and a.y->>'variant' = 'value') as rv,
             pg_catalog.bool_or(coalesce((a.y->>'count')::numeric, 0) > 0) as any_act
        from pg_catalog.jsonb_array_elements(coalesce(r.x->'actions', '[]'::jsonb)) a(y)
    ) act on true
  ), refs as (
    -- La referencia de atribución se calcula una vez por configuración distinta.
    select d.aj, private.meta_diagnostic_attribution_ref(d.aj) as at
      from (select distinct x.aj from raw0 x where x.aj is not null) d
  ), raw as (
    select x.per, x.cur_code, x.op, x.ref, x.sp, x.im, x.cl, x.rc, x.rv, x.act,
           coalesce(f.at, 'unknown') as at
      from raw0 x left join refs f on f.aj = x.aj
  ), agg as (
    select x.ref,
      pg_catalog.sum(x.sp) filter (where x.per = 'cur') as c_sp, pg_catalog.sum(x.im) filter (where x.per = 'cur') as c_im,
      pg_catalog.sum(x.cl) filter (where x.per = 'cur') as c_cl, pg_catalog.sum(x.rc) filter (where x.per = 'cur') as c_rc,
      pg_catalog.sum(x.rv) filter (where x.per = 'cur') as c_rv,
      pg_catalog.sum(x.sp) filter (where x.per = 'prev') as p_sp, pg_catalog.sum(x.im) filter (where x.per = 'prev') as p_im,
      pg_catalog.sum(x.cl) filter (where x.per = 'prev') as p_cl, pg_catalog.sum(x.rc) filter (where x.per = 'prev') as p_rc,
      pg_catalog.sum(x.rv) filter (where x.per = 'prev') as p_rv,
      pg_catalog.count(*) filter (where x.per = 'cur')::integer as d_row,
      pg_catalog.count(*) filter (where x.op)::integer as d_open,
      pg_catalog.count(distinct x.cur_code) filter (where x.per = 'cur' and (x.sp is not null or x.rv is not null))::integer as c_ncur,
      pg_catalog.min(x.cur_code) filter (where x.per = 'cur' and (x.sp is not null or x.rv is not null)) as c_cur,
      pg_catalog.count(distinct x.cur_code) filter (where x.per = 'prev' and (x.sp is not null or x.rv is not null))::integer as p_ncur,
      pg_catalog.min(x.cur_code) filter (where x.per = 'prev' and (x.sp is not null or x.rv is not null)) as p_cur,
      pg_catalog.count(distinct x.at) filter (where x.per = 'cur' and x.at <> 'unknown' and (x.rc is not null or x.rv is not null))::integer as c_nk,
      pg_catalog.min(x.at) filter (where x.per = 'cur' and x.at <> 'unknown' and (x.rc is not null or x.rv is not null)) as c_k,
      coalesce(pg_catalog.bool_or(x.at = 'unknown' and (x.rc is not null or x.rv is not null)) filter (where x.per = 'cur'), false) as c_unk,
      pg_catalog.count(distinct x.at) filter (where x.per = 'prev' and x.at <> 'unknown' and (x.rc is not null or x.rv is not null))::integer as p_nk,
      pg_catalog.min(x.at) filter (where x.per = 'prev' and x.at <> 'unknown' and (x.rc is not null or x.rv is not null)) as p_k,
      coalesce(pg_catalog.bool_or(x.act) filter (where x.per = 'cur'), false) as act
    from raw x group by x.ref
  ), meta as (
    -- Metadatos de la captura más reciente de la ventana actual, solo del nivel pedido.
    select distinct on ((e->>'entity_ref')::uuid) (e->>'entity_ref')::uuid as ref,
           e->>'name' as nm, (e->>'parent_ref')::uuid as parent, e->>'effective_status' as st,
           e->>'objective' as obj
      from cov c cross join lateral pg_catalog.jsonb_array_elements(c.entities) e
     where c.per = 'cur' and e->>'level' = p_level
     order by (e->>'entity_ref')::uuid, c.date desc
  ), calc as (
    select a.*, m.nm, m.parent, m.st, m.obj,
      a.c_ncur <= 1 as c_money, a.p_ncur <= 1 as p_money,
      (p_metric_ref = 'inline_link_clicks' or a.c_nk <= 1) as c_attr,
      (p_metric_ref = 'inline_link_clicks' or a.p_nk <= 1) as p_attr,
      (a.c_cur is not distinct from a.p_cur or a.c_cur is null or a.p_cur is null) as same_cur,
      (p_metric_ref = 'inline_link_clicks' or a.c_k is null or a.p_k is null or a.c_k = a.p_k) as same_attr,
      case when a.c_ncur <= 1 then a.c_sp end as sort_spend
    from agg a join meta m on m.ref = a.ref
    where a.act
  ), out as (
    select k.*,
      case when k.c_money and k.c_attr then private.meta_diagnostic_ratio(k.c_sp, k.c_rc, 1) end as c_cpr,
      case when k.p_money and k.p_attr then private.meta_diagnostic_ratio(k.p_sp, k.p_rc, 1) end as p_cpr,
      case when k.c_money and k.c_attr and p_metric_ref <> 'inline_link_clicks'
        then private.meta_diagnostic_ratio(k.c_rv, k.c_sp, 1) end as c_ret,
      case when k.p_money and k.p_attr and p_metric_ref <> 'inline_link_clicks'
        then private.meta_diagnostic_ratio(k.p_rv, k.p_sp, 1) end as p_ret
    from calc k
  )
  select o.ref, o.nm, o.parent, o.st, o.obj,
    case when not o.c_money then 'mixed' else o.c_cur end,
    case when o.c_nk > 1 then 'mixed' when o.c_unk or o.c_k is null then 'unknown' else o.c_k end,
    o.sort_spend::text, o.c_im::text, o.c_cl::text,
    case when o.c_attr then o.c_rc::text end,
    case when o.c_attr and o.c_money then o.c_rv::text end,
    private.meta_diagnostic_text(private.meta_diagnostic_ratio(o.c_cl, o.c_im, 100)),
    case when o.c_money then private.meta_diagnostic_text(private.meta_diagnostic_ratio(o.c_sp, o.c_cl, 1)) end,
    case when o.c_money then private.meta_diagnostic_text(private.meta_diagnostic_ratio(o.c_sp, o.c_im, 1000)) end,
    private.meta_diagnostic_text(o.c_cpr), private.meta_diagnostic_text(o.c_ret),
    case when o.p_money then o.p_sp::text end, o.p_im::text, o.p_cl::text,
    case when o.p_attr then o.p_rc::text end,
    case when o.p_attr and o.p_money then o.p_rv::text end,
    private.meta_diagnostic_text(private.meta_diagnostic_ratio(o.p_cl, o.p_im, 100)),
    case when o.p_money then private.meta_diagnostic_text(private.meta_diagnostic_ratio(o.p_sp, o.p_cl, 1)) end,
    case when o.p_money then private.meta_diagnostic_text(private.meta_diagnostic_ratio(o.p_sp, o.p_im, 1000)) end,
    private.meta_diagnostic_text(o.p_cpr), private.meta_diagnostic_text(o.p_ret),
    case when o.c_money and o.p_money and o.same_cur then private.meta_diagnostic_variation(o.c_sp, o.p_sp) end,
    private.meta_diagnostic_variation(private.meta_diagnostic_ratio(o.c_cl, o.c_im, 100),
                                      private.meta_diagnostic_ratio(o.p_cl, o.p_im, 100)),
    case when o.same_cur and o.same_attr then private.meta_diagnostic_variation(o.c_cpr, o.p_cpr) end,
    case when o.same_cur and o.same_attr then private.meta_diagnostic_variation(o.c_ret, o.p_ret) end,
    o.d_row, o.d_open
  from out o
  where p_after_ref is null
     or (v_after is not null and (o.sort_spend < v_after or o.sort_spend is null
                                  or (o.sort_spend = v_after and o.ref > p_after_ref)))
     or (v_after is null and o.sort_spend is null and o.ref > p_after_ref)
  order by o.sort_spend desc nulls last, o.ref
  limit p_limit;
end;
$$;

create function public.meta_diagnostic_breakdown_metrics(
  p_connection_id uuid, p_level text, p_dimension text, p_from date, p_to date, p_metric_ref text
) returns table (
  dimension text, segment_key text, segment_label text, spend text, impressions text, clicks text,
  result_count text, ctr text, cpc text, cost_per_result text, currency text, attribution text,
  last_attempt_status text, segments_total integer
) language plpgsql stable security invoker set search_path = '' as $$
declare v_status text;
begin
  if p_connection_id is null or p_level is null or p_level not in ('account','campaign')
     or p_dimension is null or p_dimension not in ('age_gender','country','region') then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;
  perform private.meta_diagnostic_assert_window(p_from, p_to);
  perform private.meta_diagnostic_assert_metric(p_metric_ref);
  select st.last_result into v_status from public.meta_breakdown_status st
   where st.connection_id = p_connection_id and st.level = p_level and st.dimension = p_dimension;
  return query
  with raw as (
    select r.segment_primary as sp1, r.segment_secondary as sp2, cov.currency as cur_code,
      r.spend as sp, r.impressions::numeric as im, r.clicks::numeric as cl,
      -- La región no trae acciones: su resultado no está disponible (nunca cero).
      case when p_dimension = 'region' then null
           when p_metric_ref = 'inline_link_clicks' then r.inline_link_clicks::numeric
           else private.meta_diagnostic_action_sum(r.actions, p_metric_ref, 'count') end as rc
      from public.meta_breakdown_coverage cov
      join public.meta_breakdown_rows r on r.snapshot_id = cov.snapshot_id and r.date = cov.date
     where cov.connection_id = p_connection_id and cov.level = p_level
       and cov.dimension = p_dimension and cov.date between p_from and p_to
  ), agg as (
    select x.sp1, x.sp2, pg_catalog.sum(x.sp) as sp, pg_catalog.sum(x.im) as im, pg_catalog.sum(x.cl) as cl,
      pg_catalog.sum(x.rc) as rc,
      pg_catalog.count(distinct x.cur_code) filter (where x.sp is not null)::integer as n_cur,
      pg_catalog.min(x.cur_code) filter (where x.sp is not null) as cur_code
    from raw x group by x.sp1, x.sp2
  ), calc as (
    select a.*, a.n_cur <= 1 as money_ok,
      case when a.n_cur <= 1 then a.sp end as out_sp,
      case when a.sp2 = '' then a.sp1 else a.sp1 || '|' || a.sp2 end as seg_key,
      pg_catalog.count(*) over ()::integer as total
    from agg a
  )
  select p_dimension, k.seg_key,
    case when k.sp2 = '' then k.sp1 else k.sp1 || ' · ' || k.sp2 end,
    k.out_sp::text, k.im::text, k.cl::text, k.rc::text,
    private.meta_diagnostic_text(private.meta_diagnostic_ratio(k.cl, k.im, 100)),
    case when k.money_ok then private.meta_diagnostic_text(private.meta_diagnostic_ratio(k.sp, k.cl, 1)) end,
    case when k.money_ok then private.meta_diagnostic_text(private.meta_diagnostic_ratio(k.sp, k.rc, 1)) end,
    case when not k.money_ok then 'mixed' else k.cur_code end,
    -- 0017 no guarda atribución por fila: todo desglose es de atribución desconocida.
    'unknown'::text, v_status, k.total
  from calc k
  order by k.out_sp desc nulls last, k.seg_key collate "C"
  limit 50;
end;
$$;

revoke all on function public.meta_diagnostic_action_types(uuid,date,date)
  from public,anon,authenticated,service_role,praxa_integrations;
grant execute on function public.meta_diagnostic_action_types(uuid,date,date) to authenticated;
revoke all on function public.meta_diagnostic_account_metrics(uuid,date,date,date,date,text)
  from public,anon,authenticated,service_role,praxa_integrations;
grant execute on function public.meta_diagnostic_account_metrics(uuid,date,date,date,date,text) to authenticated;
revoke all on function public.meta_diagnostic_entity_metrics(uuid,text,date,date,date,date,text,text,uuid,integer)
  from public,anon,authenticated,service_role,praxa_integrations;
grant execute on function public.meta_diagnostic_entity_metrics(uuid,text,date,date,date,date,text,text,uuid,integer)
  to authenticated;
revoke all on function public.meta_diagnostic_breakdown_metrics(uuid,text,text,date,date,text)
  from public,anon,authenticated,service_role,praxa_integrations;
grant execute on function public.meta_diagnostic_breakdown_metrics(uuid,text,text,date,date,text) to authenticated;
