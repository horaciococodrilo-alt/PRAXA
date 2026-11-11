-- PRAXA 0018 — registro y lecturas del chat (M25a)
-- Matriz: tablas de registro y arriendo sin grants ni políticas; worker_api solo para
-- praxa_integrations; lecturas public.chat_* INVOKER solo para authenticated.

create function private.chat_valid_tool_names(p_names text[])
returns boolean language sql immutable security invoker set search_path = '' as $$
  select p_names is not null and coalesce(pg_catalog.array_ndims(p_names), 1) <= 1
    and pg_catalog.cardinality(p_names) <= 16
    and coalesce((select pg_catalog.bool_and(n is not null and n ~ '^[a-z_]{1,40}$')
                    from pg_catalog.unnest(p_names) n), true)
$$;
revoke all on function private.chat_valid_tool_names(text[]) from public, anon,
  authenticated, service_role, praxa_integrations;

create table public.chat_query_records (
  id uuid primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  connection_id uuid,
  question_redacted text not null,
  tool_names text[] not null default '{}',
  outcome text not null,
  reason text,
  latency_ms integer not null,
  requested_model_id text not null,
  reported_model_id text,
  feedback text,
  created_at timestamptz not null default now(),
  constraint chat_query_records_connection_fkey foreign key (company_id, connection_id)
    references public.integration_connections (company_id, id) on delete cascade,
  constraint chat_query_records_question_length check (pg_catalog.char_length(question_redacted) between 1 and 500),
  constraint chat_query_records_tool_names check (private.chat_valid_tool_names(tool_names)),
  constraint chat_query_records_outcome check (outcome in ('answered','answered_partial_coverage','not_answered')),
  constraint chat_query_records_reason check (reason in ('out_of_scope','no_coverage','connection_not_active',
    'guard_rejected','model_unavailable','tool_error','needs_clarification')),
  constraint chat_query_records_reason_pair check ((outcome = 'not_answered') = (reason is not null)),
  constraint chat_query_records_latency check (latency_ms >= 0),
  constraint chat_query_records_requested_model check (pg_catalog.char_length(requested_model_id) between 1 and 128),
  constraint chat_query_records_reported_model check (pg_catalog.char_length(reported_model_id) between 1 and 128),
  constraint chat_query_records_feedback check (feedback in ('useful','not_useful'))
);
create index chat_query_records_company_connection_idx
  on public.chat_query_records(company_id, connection_id);
revoke all on table public.chat_query_records from public, anon, authenticated,
  service_role, praxa_integrations;
alter table public.chat_query_records enable row level security;
alter table public.chat_query_records force row level security;

create table private.chat_turn_leases (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  turn_id uuid not null,
  expires_at timestamptz not null,
  primary key (company_id, user_id)
);
revoke all on table private.chat_turn_leases from public, anon, authenticated,
  service_role, praxa_integrations;
alter table private.chat_turn_leases enable row level security;
alter table private.chat_turn_leases force row level security;

create function worker_api.begin_chat_turn(
  p_actor_user_id uuid, p_company_id uuid, p_turn_id uuid, p_ttl_seconds integer
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_lease private.chat_turn_leases; v_now timestamptz; v_constraint text;
begin
  perform private.assert_worker_actor(p_actor_user_id, p_company_id);
  if p_turn_id is null or p_ttl_seconds not between 1 and 300 then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;
  perform private.lock_company(p_company_id);
  v_now := pg_catalog.clock_timestamp();
  select * into v_lease from private.chat_turn_leases
   where company_id = p_company_id and user_id = p_actor_user_id for update;
  if found and v_lease.expires_at > v_now and v_lease.turn_id <> p_turn_id then
    raise exception 'praxa: ya hay una consulta en curso' using errcode = 'PX011';
  end if;
  insert into private.chat_turn_leases(company_id,user_id,turn_id,expires_at)
  values (p_company_id,p_actor_user_id,p_turn_id,v_now + pg_catalog.make_interval(secs => p_ttl_seconds))
  on conflict (company_id,user_id) do update set
    turn_id = excluded.turn_id,
    expires_at = case when private.chat_turn_leases.turn_id = excluded.turn_id
      and private.chat_turn_leases.expires_at > v_now then private.chat_turn_leases.expires_at
      else excluded.expires_at end;
  return p_turn_id;
exception when integrity_constraint_violation then
  get stacked diagnostics v_constraint = constraint_name;
  perform private.raise_worker_integrity_error(v_constraint);
  return null;
end;
$$;

create function worker_api.end_chat_turn(
  p_actor_user_id uuid, p_company_id uuid, p_turn_id uuid
) returns boolean language plpgsql security definer set search_path = '' as $$
declare v_constraint text;
begin
  perform private.assert_worker_actor(p_actor_user_id, p_company_id);
  if p_turn_id is null then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;
  perform private.lock_company(p_company_id);
  delete from private.chat_turn_leases
   where company_id = p_company_id and user_id = p_actor_user_id and turn_id = p_turn_id;
  return found;
exception when integrity_constraint_violation then
  get stacked diagnostics v_constraint = constraint_name;
  perform private.raise_worker_integrity_error(v_constraint);
  return false;
end;
$$;

create function worker_api.record_query(
  p_actor_user_id uuid, p_company_id uuid, p_record_id uuid,
  p_connection_id uuid, p_expected_generation integer,
  p_question_redacted text, p_tool_names text[], p_outcome text, p_reason text,
  p_latency_ms integer, p_requested_model_id text, p_reported_model_id text
) returns table(record_id uuid, written boolean)
language plpgsql security definer set search_path = '' as $$
declare v_connection public.integration_connections; v_record public.chat_query_records;
        v_constraint text;
begin
  perform private.assert_worker_actor(p_actor_user_id, p_company_id);
  if p_record_id is null or p_question_redacted is null or p_tool_names is null
     or p_outcome is null or p_latency_ms is null or p_requested_model_id is null
     or pg_catalog.char_length(p_question_redacted) not between 1 and 500
     or not private.chat_valid_tool_names(p_tool_names)
     or p_outcome not in ('answered','answered_partial_coverage','not_answered')
     or (p_outcome = 'not_answered') <> (p_reason is not null)
     or (p_reason is not null and p_reason not in ('out_of_scope','no_coverage',
       'connection_not_active','guard_rejected','model_unavailable','tool_error','needs_clarification'))
     or p_latency_ms < 0 or pg_catalog.char_length(p_requested_model_id) not between 1 and 128
     or (p_reported_model_id is not null and pg_catalog.char_length(p_reported_model_id) not between 1 and 128)
     or (p_connection_id is null and (p_expected_generation is not null
       or p_outcome <> 'not_answered' or p_reason <> 'connection_not_active')) then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;
  perform private.lock_company(p_company_id);
  if p_connection_id is not null then
    select c.* into v_connection from public.integration_connections c
     where c.company_id = p_company_id and c.id = p_connection_id for update;
    if not found or v_connection.credential_generation is distinct from p_expected_generation then
      return query select p_record_id, false; return;
    end if;
    if v_connection.status <> 'active' and not (
      v_connection.status in ('needs_reauth','pending_selection')
      and p_outcome = 'not_answered' and p_reason = 'connection_not_active') then
      return query select p_record_id, false; return;
    end if;
  end if;
  select r.* into v_record from public.chat_query_records r where r.id = p_record_id for update;
  if found then
    if v_record.company_id is distinct from p_company_id
      or v_record.connection_id is distinct from p_connection_id
      or v_record.question_redacted is distinct from p_question_redacted
      or v_record.tool_names is distinct from p_tool_names
      or v_record.outcome is distinct from p_outcome or v_record.reason is distinct from p_reason
      or v_record.latency_ms is distinct from p_latency_ms
      or v_record.requested_model_id is distinct from p_requested_model_id
      or v_record.reported_model_id is distinct from p_reported_model_id then
      raise exception 'praxa: argumento inválido' using errcode = '22023';
    end if;
  else
    insert into public.chat_query_records(id,company_id,connection_id,question_redacted,
      tool_names,outcome,reason,latency_ms,requested_model_id,reported_model_id)
    values (p_record_id,p_company_id,p_connection_id,p_question_redacted,
      p_tool_names,p_outcome,p_reason,p_latency_ms,p_requested_model_id,p_reported_model_id);
  end if;
  return query select p_record_id, true;
exception when integrity_constraint_violation then
  get stacked diagnostics v_constraint = constraint_name;
  perform private.raise_worker_integrity_error(v_constraint);
  return query select p_record_id, false;
end;
$$;

create function worker_api.set_feedback(
  p_actor_user_id uuid, p_company_id uuid, p_record_id uuid, p_feedback text
) returns boolean language plpgsql security definer set search_path = '' as $$
declare v_constraint text;
begin
  perform private.assert_worker_actor(p_actor_user_id, p_company_id);
  if p_record_id is null or p_feedback is null or p_feedback not in ('useful','not_useful') then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;
  perform private.lock_company(p_company_id);
  update public.chat_query_records r set feedback = p_feedback
   where r.company_id = p_company_id and r.id = p_record_id;
  return found;
exception when integrity_constraint_violation then
  get stacked diagnostics v_constraint = constraint_name;
  perform private.raise_worker_integrity_error(v_constraint);
  return false;
end;
$$;

-- Mismo contrato de 0016, con el registro borrado antes de la conexión.
create or replace function worker_api.purge_connection(
  p_actor_user_id uuid, p_company_id uuid, p_connection_id uuid
) returns boolean language plpgsql security definer set search_path = '' as $$
declare v_connection public.integration_connections; v_constraint text;
begin
  perform private.assert_worker_actor(p_actor_user_id, p_company_id);
  if p_connection_id is null then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;
  perform private.lock_company(p_company_id);
  select c.* into v_connection from public.integration_connections c
   where c.id = p_connection_id and c.company_id = p_company_id for update;
  if not found then return false; end if;
  if v_connection.status <> 'disconnected' then
    raise exception 'praxa: transición de estado no permitida' using errcode = 'PX004';
  end if;
  update public.integration_connections c set current_sync_run_id = null where c.id = p_connection_id;
  delete from public.chat_query_records x where x.company_id = p_company_id and x.connection_id = p_connection_id;
  delete from public.meta_daily_coverage x where x.connection_id = p_connection_id;
  delete from public.meta_snapshot_actions x where x.connection_id = p_connection_id;
  delete from public.meta_snapshot_days x where x.connection_id = p_connection_id;
  delete from public.meta_snapshot_entities x where x.connection_id = p_connection_id;
  delete from public.meta_insight_snapshots x where x.connection_id = p_connection_id;
  delete from public.meta_sync_runs x where x.connection_id = p_connection_id;
  delete from public.meta_entities x where x.connection_id = p_connection_id;
  delete from private.integration_credentials k
   where k.connection_id = p_connection_id and k.company_id = p_company_id;
  delete from public.integration_connections c where c.id = p_connection_id and c.company_id = p_company_id;
  return true;
exception when integrity_constraint_violation then
  get stacked diagnostics v_constraint = constraint_name;
  perform private.raise_worker_integrity_error(v_constraint);
  return false;
end;
$$;

revoke all on function worker_api.begin_chat_turn(uuid,uuid,uuid,integer)
  from public,anon,authenticated,service_role,praxa_integrations;
grant execute on function worker_api.begin_chat_turn(uuid,uuid,uuid,integer) to praxa_integrations;
revoke all on function worker_api.end_chat_turn(uuid,uuid,uuid)
  from public,anon,authenticated,service_role,praxa_integrations;
grant execute on function worker_api.end_chat_turn(uuid,uuid,uuid) to praxa_integrations;
revoke all on function worker_api.record_query(uuid,uuid,uuid,uuid,integer,text,text[],text,text,integer,text,text)
  from public,anon,authenticated,service_role,praxa_integrations;
grant execute on function worker_api.record_query(uuid,uuid,uuid,uuid,integer,text,text[],text,text,integer,text,text)
  to praxa_integrations;
revoke all on function worker_api.set_feedback(uuid,uuid,uuid,text)
  from public,anon,authenticated,service_role,praxa_integrations;
grant execute on function worker_api.set_feedback(uuid,uuid,uuid,text) to praxa_integrations;

-- Lecturas: el invocador ve únicamente la cobertura que RLS de 0016 le permite.
create function private.chat_max_period_days() returns integer
language sql immutable security invoker set search_path = '' as $$ select 93 $$;
create function private.chat_assert_period(p_from date, p_to date) returns void
language plpgsql immutable security invoker set search_path = '' as $$
begin
  if p_from is null or p_to is null or p_to < p_from
     or p_to - p_from + 1 > private.chat_max_period_days() then
    raise exception 'praxa: período inválido' using errcode = '22023';
  end if;
end;
$$;
create function private.chat_assert_metric(p_metric text, p_action_type text)
returns void language plpgsql immutable security invoker set search_path = '' as $$
begin
  if p_metric not in ('spend','impressions','reach','clicks','inline_link_clicks',
    'ctr','cpc','cpm','frequency','action_count','action_value')
    or p_metric is null
    or (p_metric in ('action_count','action_value')) <> (p_action_type is not null)
    or (p_action_type is not null and p_action_type !~ '^[A-Za-z0-9._]{1,128}$') then
    raise exception 'praxa: métrica inválida' using errcode = '22023';
  end if;
end;
$$;
create function private.chat_metric_value(p_row jsonb, p_metric text, p_action_type text)
returns text language sql immutable security invoker set search_path = '' as $$
  select case when p_metric = 'action_count' then
    (select a->>'count' from pg_catalog.jsonb_array_elements(coalesce(p_row->'actions','[]'::jsonb)) a
      where a->>'action_type' = p_action_type and a->>'variant' = 'value' limit 1)
  when p_metric = 'action_value' then
    (select a->>'value' from pg_catalog.jsonb_array_elements(coalesce(p_row->'actions','[]'::jsonb)) a
      where a->>'action_type' = p_action_type and a->>'variant' = 'value' limit 1)
  else p_row->>p_metric end
$$;
create function private.chat_attribution_ref(p_attribution jsonb)
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

create function private.chat_entity_days(
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
  select c.level into v_level from public.meta_daily_coverage c
    cross join lateral pg_catalog.jsonb_array_elements(c.entities) e
   where c.connection_id = p_connection_id and e->>'entity_ref' = p_entity_ref::text
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

revoke all on function private.chat_max_period_days() from public,anon,authenticated,service_role,praxa_integrations;
revoke all on function private.chat_assert_period(date,date) from public,anon,authenticated,service_role,praxa_integrations;
revoke all on function private.chat_assert_metric(text,text) from public,anon,authenticated,service_role,praxa_integrations;
revoke all on function private.chat_metric_value(jsonb,text,text) from public,anon,authenticated,service_role,praxa_integrations;
revoke all on function private.chat_attribution_ref(jsonb) from public,anon,authenticated,service_role,praxa_integrations;
revoke all on function private.chat_entity_days(uuid,uuid,date,date) from public,anon,authenticated,service_role,praxa_integrations;
grant execute on function private.chat_max_period_days() to authenticated;
grant execute on function private.chat_assert_period(date,date) to authenticated;
grant execute on function private.chat_assert_metric(text,text) to authenticated;
grant execute on function private.chat_metric_value(jsonb,text,text) to authenticated;
grant execute on function private.chat_attribution_ref(jsonb) to authenticated;
grant execute on function private.chat_entity_days(uuid,uuid,date,date) to authenticated;

create function private.chat_aggregate(
  p_connection_id uuid, p_entity_ref uuid, p_metric text,
  p_from date, p_to date, p_action_type text, p_mode text
) returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  d record;
  v_found boolean := false;
  v_level text;
  v_entity_name text;
  v_parent_ref uuid;
  v_currency text;
  v_timezone text;
  v_mixed_currency boolean := false;
  v_attribution text;
  v_known_attribution text;
  v_unknown_attribution boolean := false;
  v_attribution_mixed boolean := false;
  v_sum numeric := 0;
  v_num numeric := 0;
  v_den numeric := 0;
  v_value numeric;
  v_metric_present boolean;
  v_base_a numeric;
  v_base_b numeric;
  v_days_total integer := 0;
  v_days_with_value integer := 0;
  v_days_metric_missing integer := 0;
  v_days_no_row integer := 0;
  v_days_not_observed integer := 0;
  v_days_open integer := 0;
  v_days_captured_partial integer := 0;
  v_fetched_min timestamptz;
  v_fetched_max timestamptz;
  v_observed_from date;
  v_observed_to date;
  v_composition jsonb;
  v_scope jsonb;
  v_status text := 'ok';
  v_reason text;
  v_unit text;
  v_result text;
  v_path text;
begin
  perform private.chat_assert_period(p_from,p_to);
  perform private.chat_assert_metric(p_metric,p_action_type);
  if p_mode not in ('total','daily_average') or p_mode is null or p_connection_id is null
     or p_entity_ref is null then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;
  for d in select * from private.chat_entity_days(p_connection_id,p_entity_ref,p_from,p_to) loop
    v_found := true;
    v_metric_present := false;
    v_days_total := v_days_total + 1;
    v_level := d.level;
    v_entity_name := coalesce(d.entity_name,v_entity_name);
    v_parent_ref := coalesce(d.parent_ref,v_parent_ref);
    v_timezone := coalesce(d.timezone,v_timezone);
    if d.presence = 'no_observado' then v_days_not_observed := v_days_not_observed + 1;
    elsif d.presence = 'sin_fila_reportada' then v_days_no_row := v_days_no_row + 1;
    else
      v_observed_from := coalesce(v_observed_from,d.day);
      v_observed_to := d.day;
    end if;
    if d.presence = 'sin_fila_reportada' then
      v_observed_from := coalesce(v_observed_from,d.day);
      v_observed_to := d.day;
    end if;
    if d.temporal_status = 'abierto' then v_days_open := v_days_open + 1; end if;
    if d.captured_partial then v_days_captured_partial := v_days_captured_partial + 1; end if;
    if d.fetched_at is not null then
      v_fetched_min := least(v_fetched_min,d.fetched_at);
      v_fetched_max := greatest(v_fetched_max,d.fetched_at);
    end if;
    if p_metric in ('ctr','cpc','cpm') then
      if p_metric = 'ctr' then
        v_base_a := (d.row_data->>'clicks')::numeric;
        v_base_b := (d.row_data->>'impressions')::numeric;
      elsif p_metric = 'cpc' then
        v_base_a := (d.row_data->>'spend')::numeric;
        v_base_b := (d.row_data->>'clicks')::numeric;
      else
        v_base_a := (d.row_data->>'spend')::numeric;
        v_base_b := (d.row_data->>'impressions')::numeric;
      end if;
      if v_base_a is not null and v_base_b is not null then
        v_metric_present := true;
        v_num := v_num + v_base_a;
        v_den := v_den + v_base_b;
        v_days_with_value := v_days_with_value + 1;
      elsif d.presence = 'con_datos' then v_days_metric_missing := v_days_metric_missing + 1; end if;
    else
      v_value := (private.chat_metric_value(d.row_data,p_metric,p_action_type))::numeric;
      if v_value is not null then
        v_metric_present := true;
        v_sum := v_sum + v_value;
        v_days_with_value := v_days_with_value + 1;
        if p_metric in ('action_count','action_value') then
          if d.attribution_ref = 'unknown' then v_unknown_attribution := true;
          elsif v_known_attribution is not null and v_known_attribution <> d.attribution_ref then
            v_attribution_mixed := true;
          else v_known_attribution := d.attribution_ref; end if;
        end if;
      elsif d.presence = 'con_datos' then v_days_metric_missing := v_days_metric_missing + 1; end if;
    end if;
    if v_metric_present and d.currency is not null then
      if v_currency is not null and v_currency <> d.currency then v_mixed_currency := true; end if;
      v_currency := d.currency;
    end if;
  end loop;
  if p_metric in ('action_count','action_value') then
    v_attribution := case when v_unknown_attribution then 'unknown' else v_known_attribution end;
  end if;
  if not v_found then
    return pg_catalog.jsonb_build_object('status','not_found','reason','entity_not_found',
      'scope',pg_catalog.jsonb_build_object('level',null,'entity_ref',p_entity_ref,
        'entity_name',null,'period',pg_catalog.jsonb_build_object('from',p_from,'to',p_to),
        'period_a',null,'period_b',null,'period_defaulted',false,'entity_defaulted',false,
        'timezone',null,'currency',null),
      'values','[]'::jsonb,'composition',pg_catalog.jsonb_build_object(
        'days_total',p_to-p_from+1,'days_with_value',0,'days_metric_missing',0,
        'days_no_row',0,'days_not_observed',p_to-p_from+1,'days_open',0,
        'days_captured_partial',0,'fetched_at_min',null,'fetched_at_max',null,
        'observed_from',null,'observed_to',null,'partial',true),'extra','{}'::jsonb);
  end if;
  v_composition := pg_catalog.jsonb_build_object(
    'days_total',v_days_total,'days_with_value',v_days_with_value,
    'days_metric_missing',v_days_metric_missing,'days_no_row',v_days_no_row,
    'days_not_observed',v_days_not_observed,'days_open',v_days_open,
    'days_captured_partial',v_days_captured_partial,
    'fetched_at_min',case when v_fetched_min is null then null else
      pg_catalog.to_char(v_fetched_min at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') end,
    'fetched_at_max',case when v_fetched_max is null then null else
      pg_catalog.to_char(v_fetched_max at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') end,
    'observed_from',v_observed_from,'observed_to',v_observed_to,
    'partial',v_days_with_value <> v_days_total or v_days_open > 0 or v_days_captured_partial > 0);
  v_scope := pg_catalog.jsonb_build_object('level',v_level,'entity_ref',p_entity_ref,
    'entity_name',v_entity_name,'period',pg_catalog.jsonb_build_object('from',p_from,'to',p_to),
    'period_a',null,'period_b',null,'period_defaulted',false,'entity_defaulted',false,
    'timezone',v_timezone,'currency',v_currency);
  v_unit := case when p_metric in ('spend','cpc','cpm','action_value') then 'money'
    when p_metric = 'ctr' then 'percent' when p_metric = 'frequency' then 'ratio'
    else 'count' end;
  v_path := case when p_mode = 'daily_average' then 'daily_average' else 'total' end;
  if p_metric in ('reach','frequency') then
    v_status := 'not_supported'; v_reason := 'metric_not_additive';
  elsif p_mode = 'daily_average' and p_metric in ('ctr','cpc','cpm') then
    v_status := 'not_supported'; v_reason := 'metric_not_additive';
  elsif v_mixed_currency and v_unit = 'money' then
    v_status := 'not_calculable'; v_reason := 'currency_mixed';
  elsif v_attribution_mixed then
    v_status := 'not_calculable'; v_reason := 'attribution_incompatible';
  elsif v_days_with_value = 0 then
    v_status := 'not_calculable'; v_reason := 'data_absent';
  elsif p_metric in ('ctr','cpc','cpm') and v_den = 0 then
    v_status := 'not_calculable'; v_reason := 'denominator_zero';
  else
    if p_metric = 'ctr' then v_result := pg_catalog.round(100*v_num/v_den,6)::text;
    elsif p_metric = 'cpm' then v_result := pg_catalog.round(1000*v_num/v_den,6)::text;
    elsif p_metric = 'cpc' then v_result := pg_catalog.round(v_num/v_den,6)::text;
    elsif p_mode = 'daily_average' then v_result := pg_catalog.round(v_sum/v_days_with_value,6)::text;
    else v_result := v_sum::text; end if;
  end if;
  return pg_catalog.jsonb_build_object('status',v_status,'reason',v_reason,'scope',v_scope,
    'values',case when v_status <> 'ok' then '[]'::jsonb else
      pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'path_key',v_path,'metric',p_metric,'unit',v_unit,
        'currency',case when v_unit = 'money' then v_currency else null end,
        'action_type',p_action_type,'attribution_ref',v_attribution,
        'period',pg_catalog.jsonb_build_object('from',p_from,'to',p_to),
        'period_a',null,'period_b',null,'day',null,
        'entity_ref',p_entity_ref,'entity_name',v_entity_name,'parent_ref',v_parent_ref,
        'segment_primary',null,'segment_secondary',null,'value',v_result,'absence',null,
        'presence',null,'temporal_status',null,'captured_partial',v_days_captured_partial > 0,
        'fetched_at',null,'composition',v_composition)) end,
    'composition',v_composition,'extra','{}'::jsonb);
end;
$$;
revoke all on function private.chat_aggregate(uuid,uuid,text,date,date,text,text)
  from public,anon,authenticated,service_role,praxa_integrations;
grant execute on function private.chat_aggregate(uuid,uuid,text,date,date,text,text) to authenticated;

create function public.chat_total(
  p_connection_id uuid, p_entity_ref uuid, p_metric text,
  p_from date, p_to date, p_action_type text default null
) returns jsonb language sql stable security invoker set search_path = '' as $$
  select private.chat_aggregate(p_connection_id,p_entity_ref,p_metric,p_from,p_to,p_action_type,'total')
$$;
create function public.chat_daily_average(
  p_connection_id uuid, p_entity_ref uuid, p_metric text,
  p_from date, p_to date, p_action_type text default null
) returns jsonb language sql stable security invoker set search_path = '' as $$
  select private.chat_aggregate(p_connection_id,p_entity_ref,p_metric,p_from,p_to,p_action_type,'daily_average')
$$;
revoke all on function public.chat_total(uuid,uuid,text,date,date,text)
  from public,anon,authenticated,service_role,praxa_integrations;
grant execute on function public.chat_total(uuid,uuid,text,date,date,text) to authenticated;
revoke all on function public.chat_daily_average(uuid,uuid,text,date,date,text)
  from public,anon,authenticated,service_role,praxa_integrations;
grant execute on function public.chat_daily_average(uuid,uuid,text,date,date,text) to authenticated;

create function private.chat_compare(
  p_connection_id uuid, p_entity_ref uuid, p_metric text,
  p_a_from date, p_a_to date, p_b_from date, p_b_to date,
  p_action_type text, p_percent boolean
) returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  a jsonb; b jsonb; av jsonb; bv jsonb;
  ac jsonb; bc jsonb; comp jsonb; scope jsonb; extra jsonb;
  x numeric; y numeric; delta numeric; result_value text;
  status text := 'ok'; reason text;
  values_json jsonb := '[]'::jsonb;
  attr_a text; attr_b text;
begin
  perform private.chat_assert_period(p_a_from,p_a_to);
  perform private.chat_assert_period(p_b_from,p_b_to);
  a := private.chat_aggregate(p_connection_id,p_entity_ref,p_metric,p_a_from,p_a_to,p_action_type,'total');
  b := private.chat_aggregate(p_connection_id,p_entity_ref,p_metric,p_b_from,p_b_to,p_action_type,'total');
  ac := a->'composition'; bc := b->'composition';
  av := a#>'{values,0}'; bv := b#>'{values,0}';
  scope := (a->'scope') || pg_catalog.jsonb_build_object('period',null,
    'period_a',pg_catalog.jsonb_build_object('from',p_a_from,'to',p_a_to),
    'period_b',pg_catalog.jsonb_build_object('from',p_b_from,'to',p_b_to));
  comp := pg_catalog.jsonb_build_object(
    'days_total',(ac->>'days_total')::integer + (bc->>'days_total')::integer,
    'days_with_value',(ac->>'days_with_value')::integer + (bc->>'days_with_value')::integer,
    'days_metric_missing',(ac->>'days_metric_missing')::integer + (bc->>'days_metric_missing')::integer,
    'days_no_row',(ac->>'days_no_row')::integer + (bc->>'days_no_row')::integer,
    'days_not_observed',(ac->>'days_not_observed')::integer + (bc->>'days_not_observed')::integer,
    'days_open',(ac->>'days_open')::integer + (bc->>'days_open')::integer,
    'days_captured_partial',(ac->>'days_captured_partial')::integer + (bc->>'days_captured_partial')::integer,
    'fetched_at_min',least(ac->>'fetched_at_min',bc->>'fetched_at_min'),
    'fetched_at_max',greatest(ac->>'fetched_at_max',bc->>'fetched_at_max'),
    'observed_from',null,'observed_to',null,
    'partial',(ac->>'partial')::boolean or (bc->>'partial')::boolean);
  extra := pg_catalog.jsonb_build_object('period_lengths_differ',p_a_to-p_a_from <> p_b_to-p_b_from,
    'composition_a',ac,'composition_b',bc);
  if a->>'status' <> 'ok' then status := a->>'status'; reason := a->>'reason';
  elsif b->>'status' <> 'ok' then status := b->>'status'; reason := b->>'reason';
  else
    attr_a := av->>'attribution_ref'; attr_b := bv->>'attribution_ref';
    if av->>'currency' is distinct from bv->>'currency' and av->>'unit' = 'money' then
      status := 'not_calculable'; reason := 'currency_mixed';
    elsif attr_a is not null and attr_b is not null and attr_a <> attr_b
      and attr_a <> 'unknown' and attr_b <> 'unknown' then
      status := 'not_calculable'; reason := 'attribution_incompatible';
    else
      x := (av->>'value')::numeric; y := (bv->>'value')::numeric; delta := y-x;
      if p_percent and x = 0 then
        status := 'not_calculable'; reason := 'denominator_zero';
      else
        result_value := case when p_percent then pg_catalog.round(100*delta/x,6)::text
          else delta::text end;
        if p_percent then
          values_json := pg_catalog.jsonb_build_array(
            (bv || pg_catalog.jsonb_build_object('path_key','change','metric',p_metric,
              'unit','percent','currency',null,'value',result_value,'period',null,
              'period_a',pg_catalog.jsonb_build_object('from',p_a_from,'to',p_a_to),
              'period_b',pg_catalog.jsonb_build_object('from',p_b_from,'to',p_b_to),
              'attribution_ref',case when attr_a = 'unknown' or attr_b = 'unknown'
                then 'unknown' else coalesce(attr_b,attr_a) end,'composition',comp,
              'captured_partial',(comp->>'days_captured_partial')::integer>0)));
        else
          values_json := pg_catalog.jsonb_build_array(
            av || pg_catalog.jsonb_build_object('path_key','a'),
            bv || pg_catalog.jsonb_build_object('path_key','b'),
            (bv || pg_catalog.jsonb_build_object('path_key','difference','value',result_value,
              'period',null,'period_a',pg_catalog.jsonb_build_object('from',p_a_from,'to',p_a_to),
              'period_b',pg_catalog.jsonb_build_object('from',p_b_from,'to',p_b_to),
              'attribution_ref',case when attr_a = 'unknown' or attr_b = 'unknown'
                then 'unknown' else coalesce(attr_b,attr_a) end,'composition',comp,
              'captured_partial',(comp->>'days_captured_partial')::integer>0)));
        end if;
        if not p_percent then
          extra := extra || pg_catalog.jsonb_build_object('relation',case
            when x > y then 'a_greater' when y > x then 'b_greater' else 'equal' end);
        end if;
      end if;
    end if;
  end if;
  return pg_catalog.jsonb_build_object('status',status,'reason',reason,'scope',scope,
    'values',values_json,'composition',comp,'extra',extra);
end;
$$;
revoke all on function private.chat_compare(uuid,uuid,text,date,date,date,date,text,boolean)
  from public,anon,authenticated,service_role,praxa_integrations;
grant execute on function private.chat_compare(uuid,uuid,text,date,date,date,date,text,boolean)
  to authenticated;
create function public.chat_compare_periods(
  p_connection_id uuid,p_entity_ref uuid,p_metric text,
  p_a_from date,p_a_to date,p_b_from date,p_b_to date,p_action_type text default null
) returns jsonb language sql stable security invoker set search_path = '' as $$
  select private.chat_compare(p_connection_id,p_entity_ref,p_metric,p_a_from,p_a_to,p_b_from,p_b_to,p_action_type,false)
$$;
create function public.chat_percent_change(
  p_connection_id uuid,p_entity_ref uuid,p_metric text,
  p_a_from date,p_a_to date,p_b_from date,p_b_to date,p_action_type text default null
) returns jsonb language sql stable security invoker set search_path = '' as $$
  select private.chat_compare(p_connection_id,p_entity_ref,p_metric,p_a_from,p_a_to,p_b_from,p_b_to,p_action_type,true)
$$;
revoke all on function public.chat_compare_periods(uuid,uuid,text,date,date,date,date,text)
  from public,anon,authenticated,service_role,praxa_integrations;
grant execute on function public.chat_compare_periods(uuid,uuid,text,date,date,date,date,text) to authenticated;
revoke all on function public.chat_percent_change(uuid,uuid,text,date,date,date,date,text)
  from public,anon,authenticated,service_role,praxa_integrations;
grant execute on function public.chat_percent_change(uuid,uuid,text,date,date,date,date,text) to authenticated;

create function public.chat_daily_series(
  p_connection_id uuid,p_entity_ref uuid,p_metric text,
  p_from date,p_to date,p_action_type text default null
) returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  d record; agg jsonb; vals jsonb := '[]'::jsonb;
  val text; absent text; v_unit text; v_attr text;
  v_scope jsonb; v_comp jsonb; v_count integer := 0;
begin
  perform private.chat_assert_period(p_from,p_to);
  perform private.chat_assert_metric(p_metric,p_action_type);
  agg := private.chat_aggregate(p_connection_id,p_entity_ref,p_metric,p_from,p_to,p_action_type,'total');
  if agg->>'status' = 'not_found' then return agg; end if;
  v_scope := agg->'scope'; v_comp := agg->'composition';
  v_unit := case when p_metric in ('spend','cpc','cpm','action_value') then 'money'
    when p_metric = 'ctr' then 'percent' when p_metric = 'frequency' then 'ratio'
    else 'count' end;
  for d in select * from private.chat_entity_days(p_connection_id,p_entity_ref,p_from,p_to) loop
    val := private.chat_metric_value(d.row_data,p_metric,p_action_type);
    if val is not null then v_count := v_count + 1; end if;
    absent := case when val is not null then null when d.presence = 'no_observado' then 'no_observado'
      when d.presence = 'sin_fila_reportada' then 'sin_fila_reportada' else 'no_informado' end;
    v_attr := case when p_metric in ('action_count','action_value') then d.attribution_ref else null end;
    vals := vals || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'path_key','day','metric',p_metric,'unit',v_unit,
      'currency',case when v_unit = 'money' then d.currency else null end,
      'action_type',p_action_type,'attribution_ref',v_attr,
      'period',pg_catalog.jsonb_build_object('from',p_from,'to',p_to),
      'period_a',null,'period_b',null,'day',d.day,
      'entity_ref',p_entity_ref,'entity_name',d.entity_name,'parent_ref',d.parent_ref,
      'segment_primary',null,'segment_secondary',null,'value',val,'absence',absent,
      'presence',d.presence,'temporal_status',d.temporal_status,
      'captured_partial',d.captured_partial,
      'fetched_at',case when d.fetched_at is null then null else
        pg_catalog.to_char(d.fetched_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') end,
      'composition',null));
  end loop;
  if v_count = 0 then
    return pg_catalog.jsonb_build_object('status','not_calculable','reason','data_absent',
      'scope',v_scope,'values','[]'::jsonb,'composition',v_comp,'extra','{}'::jsonb);
  end if;
  return pg_catalog.jsonb_build_object('status','ok','reason',null,'scope',v_scope,
    'values',vals,'composition',v_comp,'extra','{}'::jsonb);
end;
$$;
revoke all on function public.chat_daily_series(uuid,uuid,text,date,date,text)
  from public,anon,authenticated,service_role,praxa_integrations;
grant execute on function public.chat_daily_series(uuid,uuid,text,date,date,text) to authenticated;

create function public.chat_coverage(
  p_connection_id uuid,p_level text,p_from date,p_to date
) returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  v_company public.integration_connections;
  v_comp jsonb;
  v_extra jsonb;
begin
  perform private.chat_assert_period(p_from,p_to);
  if p_connection_id is null or p_level not in ('account','campaign','adset','ad')
    or p_level is null then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;
  select c.* into v_company from public.integration_connections c
   where c.id = p_connection_id and c.status in ('active','needs_reauth');
  if not found then
    return pg_catalog.jsonb_build_object('status','not_found','reason','entity_not_found',
      'scope',pg_catalog.jsonb_build_object('level',p_level,'entity_ref',null,'entity_name',null,
        'period',pg_catalog.jsonb_build_object('from',p_from,'to',p_to),'period_a',null,'period_b',null,
        'period_defaulted',false,'entity_defaulted',false,'timezone',null,'currency',null),
      'values','[]'::jsonb,'composition',null,'extra','{}'::jsonb);
  end if;
  with days as (
    select p_from+i as day from pg_catalog.generate_series(0,p_to-p_from) i
  ), cov as (
    select d.day,c.* from days d left join public.meta_daily_coverage c
      on c.connection_id=p_connection_id and c.level=p_level and c.date=d.day
  )
  select pg_catalog.jsonb_build_object(
    'days_total',count(*)::integer,
    'days_with_value',count(*) filter (where pg_catalog.jsonb_array_length(coalesce(rows,'[]'::jsonb))>0)::integer,
    'days_metric_missing',0,
    'days_no_row',count(*) filter (where date is not null and pg_catalog.jsonb_array_length(rows)=0)::integer,
    'days_not_observed',count(*) filter (where date is null)::integer,
    'days_open',count(*) filter (where date is not null and
      pg_catalog.statement_timestamp() < ((day+1)::timestamp at time zone timezone))::integer,
    'days_captured_partial',count(*) filter (where captured_before_day_end)::integer,
    'fetched_at_min',case when min(fetched_at) is null then null else
      pg_catalog.to_char(min(fetched_at) at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') end,
    'fetched_at_max',case when max(fetched_at) is null then null else
      pg_catalog.to_char(max(fetched_at) at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') end,
    'observed_from',min(day) filter (where date is not null),
    'observed_to',max(day) filter (where date is not null),
    'partial',count(*) filter (where date is null or pg_catalog.jsonb_array_length(rows)=0
      or captured_before_day_end or pg_catalog.statement_timestamp() <
        ((day+1)::timestamp at time zone timezone))>0)
    into v_comp from cov;
  select pg_catalog.jsonb_build_object(
    'history_from',min(c.date),'history_to',max(c.date),
    'nearest_before',max(c.date) filter (where c.date<p_from),
    'nearest_after',min(c.date) filter (where c.date>p_to))
    into v_extra from public.meta_daily_coverage c
   where c.connection_id=p_connection_id and c.level=p_level;
  return pg_catalog.jsonb_build_object('status','ok','reason',null,
    'scope',pg_catalog.jsonb_build_object('level',p_level,'entity_ref',null,'entity_name',null,
      'period',pg_catalog.jsonb_build_object('from',p_from,'to',p_to),'period_a',null,'period_b',null,
      'period_defaulted',false,'entity_defaulted',false,
      'timezone',v_company.timezone,'currency',v_company.currency),
    'values','[]'::jsonb,'composition',v_comp,'extra',v_extra);
end;
$$;
revoke all on function public.chat_coverage(uuid,text,date,date)
  from public,anon,authenticated,service_role,praxa_integrations;
grant execute on function public.chat_coverage(uuid,text,date,date) to authenticated;

create function public.chat_cost_per_result(
  p_connection_id uuid,p_entity_ref uuid,p_action_type text,p_from date,p_to date
) returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  spend_result jsonb; action_result jsonb; sv jsonb; av jsonb; comp jsonb;
  d record; both_days integer := 0; missing_days integer := 0;
  result_value text; status text := 'ok'; reason text;
begin
  perform private.chat_assert_period(p_from,p_to);
  perform private.chat_assert_metric('action_count',p_action_type);
  spend_result := private.chat_aggregate(p_connection_id,p_entity_ref,'spend',p_from,p_to,null,'total');
  action_result := private.chat_aggregate(p_connection_id,p_entity_ref,'action_count',p_from,p_to,p_action_type,'total');
  sv := spend_result#>'{values,0}'; av := action_result#>'{values,0}';
  for d in select * from private.chat_entity_days(p_connection_id,p_entity_ref,p_from,p_to) loop
    if private.chat_metric_value(d.row_data,'spend',null) is not null
      and private.chat_metric_value(d.row_data,'action_count',p_action_type) is not null then
      both_days := both_days + 1;
    elsif d.presence = 'con_datos' then missing_days := missing_days + 1; end if;
  end loop;
  comp := (spend_result->'composition') || pg_catalog.jsonb_build_object(
    'days_with_value',both_days,'days_metric_missing',missing_days,
    'partial',both_days < (spend_result#>>'{composition,days_total}')::integer
      or (spend_result#>>'{composition,days_open}')::integer > 0
      or (spend_result#>>'{composition,days_captured_partial}')::integer > 0);
  if spend_result->>'status' <> 'ok' then
    status := spend_result->>'status'; reason := spend_result->>'reason';
  elsif action_result->>'status' <> 'ok' then
    status := action_result->>'status'; reason := action_result->>'reason';
  elsif (av->>'value')::numeric = 0 then
    status := 'not_calculable'; reason := 'denominator_zero';
  else
    result_value := pg_catalog.round((sv->>'value')::numeric / (av->>'value')::numeric,6)::text;
  end if;
  return pg_catalog.jsonb_build_object('status',status,'reason',reason,
    'scope',spend_result->'scope',
    'values',case when status <> 'ok' then '[]'::jsonb else
      pg_catalog.jsonb_build_array(sv || pg_catalog.jsonb_build_object(
        'path_key','cost_per_result','metric','cost_per_result','unit','money',
        'action_type',p_action_type,'attribution_ref',av->>'attribution_ref',
        'value',result_value,'composition',comp)) end,
    'composition',comp,'extra','{}'::jsonb);
end;
$$;
revoke all on function public.chat_cost_per_result(uuid,uuid,text,date,date)
  from public,anon,authenticated,service_role,praxa_integrations;
grant execute on function public.chat_cost_per_result(uuid,uuid,text,date,date) to authenticated;

create function public.chat_share(
  p_connection_id uuid,p_entity_ref uuid,p_metric text,
  p_from date,p_to date,p_action_type text default null
) returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  part jsonb; parent jsonb; pv jsonb; totalv jsonb; comp jsonb;
  v_parent_ref uuid; v_attr text; v_mixed boolean := false;
  status text := 'ok'; reason text; result_value text;
begin
  perform private.chat_assert_period(p_from,p_to);
  perform private.chat_assert_metric(p_metric,p_action_type);
  part := private.chat_aggregate(p_connection_id,p_entity_ref,p_metric,p_from,p_to,p_action_type,'total');
  comp := part->'composition';
  if part->>'status' = 'not_found' then return part; end if;
  select d.parent_ref into v_parent_ref from private.chat_entity_days(
    p_connection_id,p_entity_ref,p_from,p_to) d where d.parent_ref is not null limit 1;
  if p_metric in ('reach','frequency','ctr','cpc','cpm') then
    status := 'not_supported'; reason := 'metric_not_additive';
  elsif v_parent_ref is null then
    status := 'not_supported'; reason := 'invalid_scope';
  else
    parent := private.chat_aggregate(p_connection_id,v_parent_ref,p_metric,p_from,p_to,p_action_type,'total');
    pv := part#>'{values,0}'; totalv := parent#>'{values,0}';
    comp := comp || pg_catalog.jsonb_build_object('partial',
      (comp->>'partial')::boolean or (parent#>>'{composition,partial}')::boolean);
    if part->>'status' <> 'ok' then status := part->>'status'; reason := part->>'reason';
    elsif parent->>'status' <> 'ok' then status := parent->>'status'; reason := parent->>'reason';
    elsif pv->>'currency' is distinct from totalv->>'currency' and pv->>'unit' = 'money' then
      status := 'not_calculable'; reason := 'currency_mixed';
    elsif (totalv->>'value')::numeric = 0 then
      status := 'not_calculable'; reason := 'denominator_zero';
    else
      result_value := pg_catalog.round(100*(pv->>'value')::numeric/(totalv->>'value')::numeric,6)::text;
      v_attr := case when pv->>'attribution_ref' = 'unknown' or totalv->>'attribution_ref' = 'unknown'
        then 'unknown' else coalesce(pv->>'attribution_ref',totalv->>'attribution_ref') end;
      v_mixed := pv->>'attribution_ref' is not null and totalv->>'attribution_ref' is not null
        and pv->>'attribution_ref' <> totalv->>'attribution_ref'
        and pv->>'attribution_ref' <> 'unknown' and totalv->>'attribution_ref' <> 'unknown';
    end if;
  end if;
  return pg_catalog.jsonb_build_object('status',status,'reason',reason,'scope',part->'scope',
    'values',case when status <> 'ok' then '[]'::jsonb else
      pg_catalog.jsonb_build_array(pv || pg_catalog.jsonb_build_object(
        'path_key','share','metric','share','unit','percent','currency',null,
        'value',result_value,'attribution_ref',v_attr,'composition',comp,
        'captured_partial',(comp->>'days_captured_partial')::integer>0)) end,
    'composition',comp,'extra',pg_catalog.jsonb_build_object('base_metric',p_metric,
      'attribution_mixed',v_mixed));
end;
$$;
revoke all on function public.chat_share(uuid,uuid,text,date,date,text)
  from public,anon,authenticated,service_role,praxa_integrations;
grant execute on function public.chat_share(uuid,uuid,text,date,date,text) to authenticated;

create function public.chat_ranking(
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
          private.chat_attribution_ref(r->'attribution') as attr_ref
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
          count(distinct raw.currency) filter (where raw.raw_value is not null)::integer
            as entity_currencies,
          min(raw.currency) filter (where raw.raw_value is not null) as entity_currency,
          count(distinct raw.attr_ref) filter (where raw.raw_value is not null
            and raw.attr_ref <> 'unknown')::integer as known_attrs,
          min(raw.attr_ref) filter (where raw.raw_value is not null
            and raw.attr_ref <> 'unknown') as known_attr,
          bool_or(raw.attr_ref='unknown' and raw.raw_value is not null) as has_unknown
        from refs left join raw on raw.entity_ref=refs.entity_ref
        group by refs.entity_ref,refs.entity_name,refs.parent_ref
      ), calc as (
        select a.*,g.*,
          case when a.value_days=0 or a.entity_currencies>1
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
          'partial',item.any_value_days<p_to-p_from+1 or item.open_days>0
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
          if p_include_trend then
            trends := trends || pg_catalog.jsonb_build_object(item.entity_ref::text,
              (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                'day',v->>'day','value',v->>'value','absence',v->>'absence')
                order by v->>'day')
               from pg_catalog.jsonb_array_elements(public.chat_daily_series(
                 p_connection_id,item.entity_ref,p_metric,p_from,p_to,p_action_type)->'values') v));
          end if;
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

create function public.chat_action_types(
  p_connection_id uuid,p_entity_ref uuid,p_from date,p_to date
) returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  d record; item record; c jsonb; v jsonb; vals jsonb := '[]'::jsonb;
  scope jsonb; comp jsonb; found_entity boolean := false;
  v_action_days integer := 0; v_any_partial boolean := false;
begin
  perform private.chat_assert_period(p_from,p_to);
  if p_connection_id is null or p_entity_ref is null then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;
  select * into d from private.chat_entity_days(p_connection_id,p_entity_ref,p_from,p_to) limit 1;
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
revoke all on function public.chat_action_types(uuid,uuid,date,date)
  from public,anon,authenticated,service_role,praxa_integrations;
grant execute on function public.chat_action_types(uuid,uuid,date,date) to authenticated;

create function public.chat_breakdown(
  p_connection_id uuid,p_level text,p_dimension text,p_metric text,
  p_from date,p_to date,p_entity_ref uuid default null,p_action_type text default null,
  p_limit integer default 20
) returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  conn public.integration_connections;
  item record;
  v_values jsonb := '[]'::jsonb;
  v_comp jsonb;
  v_extra jsonb;
  v_scope jsonb;
  v_unit text;
  v_total numeric := 0;
  v_other numeric := 0;
  v_other_has_value boolean := false;
  v_other_partial boolean := false;
  v_any_row_partial boolean := false;
  v_any_value boolean := false;
  v_other_row_days date[] := '{}'::date[];
  v_other_value_days date[] := '{}'::date[];
  v_other_comp jsonb;
  v_other_row_count integer;
  v_other_value_count integer;
  v_segments_total integer := 0;
  v_listed integer := 0;
  v_attr text;
  v_row_comp jsonb;
  v_status text := 'ok';
  v_reason text;
  v_cov_days integer;
  v_missing integer;
  v_not_observed integer;
  v_partial boolean;
  v_last record;
  v_augmented jsonb := '[]'::jsonb;
  v_piece jsonb;
  v_value_days integer;
  v_no_row_days integer;
  v_open_days integer;
  v_partial_days integer;
  v_fetched_min timestamptz;
  v_fetched_max timestamptz;
  v_observed_from date;
  v_observed_to date;
begin
  perform private.chat_assert_period(p_from,p_to);
  perform private.chat_assert_metric(p_metric,p_action_type);
  if p_connection_id is null or p_level not in ('account','campaign')
    or p_dimension not in ('age_gender','country','region')
    or p_limit not between 1 and 20
    or (p_level='campaign' and p_entity_ref is null)
    or (p_level='account' and p_entity_ref is not null) then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;
  select c.* into conn from public.integration_connections c
   where c.id=p_connection_id and c.status in ('active','needs_reauth');
  if not found then
    v_status:='not_found';v_reason:='entity_not_found';
  elsif p_level='campaign' and not exists (
    select 1 from public.meta_daily_coverage cov
    cross join lateral pg_catalog.jsonb_array_elements(cov.entities) e
    where cov.connection_id=p_connection_id and e->>'entity_ref'=p_entity_ref::text
      and e->>'level'='campaign') then
    v_status:='not_found';v_reason:='entity_not_found';
  elsif p_metric in ('reach','frequency')
    or (p_dimension='region' and p_metric in ('action_count','action_value')) then
    v_status:='not_supported';v_reason:='invalid_scope';
  end if;
  v_unit := case when p_metric in ('spend','cpc','cpm','action_value') then 'money'
    when p_metric='ctr' then 'percent' else 'count' end;
  v_scope := pg_catalog.jsonb_build_object('level',p_level,'entity_ref',p_entity_ref,
    'entity_name',null,'period',pg_catalog.jsonb_build_object('from',p_from,'to',p_to),
    'period_a',null,'period_b',null,'period_defaulted',false,'entity_defaulted',false,
    'timezone',conn.timezone,'currency',conn.currency);
  select count(*)::integer,
    count(*) filter (where cov.date is null)::integer,
    count(*) filter (where cov.date is not null)::integer
    into v_cov_days,v_not_observed,v_missing
    from pg_catalog.generate_series(p_from,p_to,interval '1 day') d
    left join public.meta_breakdown_coverage cov
      on cov.connection_id=p_connection_id and cov.level=p_level
      and cov.dimension=p_dimension and cov.date=d::date;
  v_cov_days := coalesce(v_missing,0);
  select count(*) filter (where cov.date is not null and not exists (
    select 1 from public.meta_breakdown_rows r
     where r.snapshot_id=cov.snapshot_id and r.date=d.day::date
       and (p_level='account' or r.entity_ref=p_entity_ref)))::integer
    into v_no_row_days
    from pg_catalog.generate_series(p_from,p_to,interval '1 day') d(day)
    left join public.meta_breakdown_coverage cov
      on cov.connection_id=p_connection_id and cov.level=p_level
      and cov.dimension=p_dimension and cov.date=d.day::date;
  v_comp := pg_catalog.jsonb_build_object('days_total',p_to-p_from+1,
    'days_with_value',0,'days_metric_missing',v_cov_days-v_no_row_days,
    'days_no_row',v_no_row_days,'days_not_observed',v_not_observed,'days_open',0,
    'days_captured_partial',0,'fetched_at_min',null,'fetched_at_max',null,
    'observed_from',null,'observed_to',null,'partial',true);
  select s.last_result,s.last_reason,s.last_attempt_at into v_last
    from public.get_meta_breakdown_status(p_connection_id) s
   where s.level=p_level and s.dimension=p_dimension;
  select pg_catalog.jsonb_build_object('estimated',true,
    'nearest_before',max(c.date) filter (where c.date<p_from),
    'nearest_after',min(c.date) filter (where c.date>p_to),
    'last_result',case when v_last.last_result is null then null else
      pg_catalog.jsonb_build_object('result',v_last.last_result,'reason',v_last.last_reason,
        'attempted_at',v_last.last_attempt_at) end)
    into v_extra from public.meta_breakdown_coverage c
   where c.connection_id=p_connection_id and c.level=p_level and c.dimension=p_dimension;
  if v_status='ok' then
    for item in
      with raw as (
        select r.*,
          private.chat_metric_value(pg_catalog.to_jsonb(r),p_metric,p_action_type) as raw_value,
          case when p_metric='ctr' then r.clicks::numeric
               when p_metric in ('cpc','cpm') then r.spend::numeric end as rate_num,
          case when p_metric in ('ctr','cpm') then r.impressions::numeric
               when p_metric='cpc' then r.clicks::numeric end as rate_den
        from public.get_meta_breakdown(p_connection_id,p_level,p_dimension,
          p_from,p_to,p_entity_ref) r
        where r.segment_primary is not null
      ), grouped as (
        select segment_primary,segment_secondary,
          count(*)::integer as row_days,
          count(*) filter (where case when p_metric in ('ctr','cpc','cpm')
            then rate_num is not null and rate_den is not null
            else raw_value is not null end)::integer as value_days,
          pg_catalog.array_agg(distinct day) as row_dates,
          pg_catalog.array_agg(distinct day) filter (where case
            when p_metric in ('ctr','cpc','cpm') then rate_num is not null and rate_den is not null
            else raw_value is not null end) as value_dates,
          min(fetched_at) as first_fetched,max(fetched_at) as last_fetched,
          min(day) as first_day,max(day) as last_day,
          count(*) filter (where temporal_status='abierto')::integer as open_days,
          count(*) filter (where captured_before_day_end)::integer as partial_days,
          sum(raw_value::numeric) as sum_value,
          sum(rate_num) filter (where rate_den is not null) as num,
          sum(rate_den) filter (where rate_num is not null) as den
        from raw group by segment_primary,segment_secondary
      )
      select *,case when p_metric='ctr' and den<>0 then pg_catalog.round(100*num/den,6)
          when p_metric='cpc' and den<>0 then pg_catalog.round(num/den,6)
          when p_metric='cpm' and den<>0 then pg_catalog.round(1000*num/den,6)
          when p_metric not in ('ctr','cpc','cpm') then sum_value end as value
        from grouped
      order by value desc nulls last,segment_primary collate "C",segment_secondary collate "C"
    loop
      v_segments_total := v_segments_total+1;
      v_row_comp := pg_catalog.jsonb_build_object('days_total',p_to-p_from+1,
        'days_with_value',item.value_days,'days_metric_missing',item.row_days-item.value_days,
        'days_no_row',v_cov_days-item.row_days,'days_not_observed',v_not_observed,
        'days_open',item.open_days,'days_captured_partial',item.partial_days,
        'fetched_at_min',case when item.first_fetched is null then null else
          pg_catalog.to_char(item.first_fetched at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') end,
        'fetched_at_max',case when item.last_fetched is null then null else
          pg_catalog.to_char(item.last_fetched at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') end,
        'observed_from',item.first_day,'observed_to',item.last_day,
        'partial',item.value_days<>p_to-p_from+1 or item.open_days>0 or item.partial_days>0);
      if item.value is not null then
        v_total:=v_total+item.value;
        v_any_value:=true;
      end if;
      if v_listed<p_limit then
        v_attr := case when p_metric in ('action_count','action_value') then 'unknown' else null end;
        v_values := v_values || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
          'path_key','segment','metric',p_metric,'unit',v_unit,
          'currency',case when v_unit='money' then conn.currency else null end,
          'action_type',p_action_type,'attribution_ref',v_attr,
          'period',pg_catalog.jsonb_build_object('from',p_from,'to',p_to),
          'period_a',null,'period_b',null,'day',null,'entity_ref',p_entity_ref,
          'entity_name',null,'parent_ref',null,
          'segment_primary',item.segment_primary,'segment_secondary',item.segment_secondary,
          'value',item.value::text,
          'absence',case when item.value is null then 'no_calculable' else null end,
          'presence',null,'temporal_status',null,'captured_partial',item.partial_days>0,
          'fetched_at',null,'composition',v_row_comp));
        v_listed:=v_listed+1;
      else
        v_other_row_days := v_other_row_days || item.row_dates;
        v_other_value_days := v_other_value_days || coalesce(item.value_dates,'{}'::date[]);
        if (v_row_comp->>'partial')::boolean then v_other_partial := true; end if;
        if p_metric not in ('ctr','cpc','cpm') and item.value is not null then
          v_other:=v_other+item.value;
          v_other_has_value:=true;
        end if;
      end if;
      if (v_row_comp->>'partial')::boolean then
        v_any_row_partial:=true;
      end if;
    end loop;
    if not v_any_value then v_status:='not_calculable';v_reason:='data_absent'; end if;
  end if;
  if v_status='ok' then
    select count(distinct r.day) filter (where case when p_metric='ctr' then
        r.clicks is not null and r.impressions is not null
      when p_metric='cpc' then r.spend is not null and r.clicks is not null
      when p_metric='cpm' then r.spend is not null and r.impressions is not null
      else private.chat_metric_value(pg_catalog.to_jsonb(r),p_metric,p_action_type) is not null end)::integer,
      count(distinct r.day) filter (where r.segment_primary is null)::integer,
      count(distinct r.day) filter (where r.temporal_status='abierto')::integer,
      count(distinct r.day) filter (where r.captured_before_day_end)::integer,
      min(r.fetched_at),max(r.fetched_at),min(r.day),max(r.day)
      into v_value_days,v_no_row_days,v_open_days,v_partial_days,
        v_fetched_min,v_fetched_max,v_observed_from,v_observed_to
      from public.get_meta_breakdown(p_connection_id,p_level,p_dimension,
        p_from,p_to,p_entity_ref) r;
    v_comp := pg_catalog.jsonb_build_object('days_total',p_to-p_from+1,
      'days_with_value',v_value_days,
      'days_metric_missing',v_cov_days-v_value_days-v_no_row_days,
      'days_no_row',v_no_row_days,'days_not_observed',v_not_observed,
      'days_open',v_open_days,'days_captured_partial',v_partial_days,
      'fetched_at_min',case when v_fetched_min is null then null else
        pg_catalog.to_char(v_fetched_min at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') end,
      'fetched_at_max',case when v_fetched_max is null then null else
        pg_catalog.to_char(v_fetched_max at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') end,
      'observed_from',v_observed_from,'observed_to',v_observed_to,
      'partial',v_value_days<p_to-p_from+1 or v_open_days>0 or v_partial_days>0
        or v_any_row_partial);
    for v_piece in select x from pg_catalog.jsonb_array_elements(v_values) x loop
      v_augmented:=v_augmented || pg_catalog.jsonb_build_array(v_piece);
      if p_metric not in ('ctr','cpc','cpm') then
        v_augmented:=v_augmented || pg_catalog.jsonb_build_array(
          v_piece || pg_catalog.jsonb_build_object('path_key','segment_share',
            'metric','share','unit','percent','currency',null,
            'value',case when v_total=0 or v_piece->>'value' is null then null else
              pg_catalog.round(100*(v_piece->>'value')::numeric/v_total,6)::text end,
            'absence',case when v_total=0 or v_piece->>'value' is null then 'no_calculable' else null end));
      end if;
    end loop;
    v_values:=v_augmented;
    if v_segments_total>p_limit and p_metric not in ('ctr','cpc','cpm') then
      select count(distinct x.day)::integer into v_other_row_count
        from pg_catalog.unnest(v_other_row_days) x(day);
      select count(distinct x.day)::integer into v_other_value_count
        from pg_catalog.unnest(v_other_value_days) x(day);
      v_other_comp := v_comp || pg_catalog.jsonb_build_object(
        'days_with_value',v_other_value_count,
        'days_metric_missing',v_other_row_count-v_other_value_count,
        'days_no_row',v_cov_days-v_other_row_count,
        'partial',v_other_partial or v_other_value_count<p_to-p_from+1
          or v_open_days>0 or v_partial_days>0);
      v_values:=v_values || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'path_key','segment','metric',p_metric,'unit',v_unit,
        'currency',case when v_unit='money' then conn.currency else null end,
        'action_type',p_action_type,
        'attribution_ref',case when p_metric in ('action_count','action_value') then 'unknown' else null end,
        'period',pg_catalog.jsonb_build_object('from',p_from,'to',p_to),
        'period_a',null,'period_b',null,'day',null,'entity_ref',p_entity_ref,
        'entity_name',null,'parent_ref',null,'segment_primary','otros','segment_secondary',null,
        'value',case when v_other_has_value then v_other::text else null end,
        'absence',case when v_other_has_value then null else 'no_calculable' end,
        'presence',null,'temporal_status',null,
        'captured_partial',v_partial_days>0,'fetched_at',null,'composition',v_other_comp));
      v_values:=v_values || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'path_key','segment_share','metric','share','unit','percent','currency',null,
        'action_type',p_action_type,
        'attribution_ref',case when p_metric in ('action_count','action_value') then 'unknown' else null end,
        'period',pg_catalog.jsonb_build_object('from',p_from,'to',p_to),
        'period_a',null,'period_b',null,'day',null,'entity_ref',p_entity_ref,
        'entity_name',null,'parent_ref',null,'segment_primary','otros','segment_secondary',null,
        'value',case when not v_other_has_value or v_total=0 then null else
          pg_catalog.round(100*v_other/v_total,6)::text end,
        'absence',case when not v_other_has_value or v_total=0 then 'no_calculable' else null end,
        'presence',null,'temporal_status',null,'captured_partial',v_partial_days>0,
        'fetched_at',null,'composition',v_other_comp));
    end if;
    v_values:=v_values || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'path_key','list_count','metric','list_count','unit','count','currency',null,
      'action_type',null,'attribution_ref',null,
      'period',pg_catalog.jsonb_build_object('from',p_from,'to',p_to),
      'period_a',null,'period_b',null,'day',null,'entity_ref',null,'entity_name',null,
      'parent_ref',null,'segment_primary',null,'segment_secondary',null,
      'value',v_segments_total::text,'absence',null,'presence',null,'temporal_status',null,
      'captured_partial',false,'fetched_at',null,'composition',null));
  end if;
  v_extra:=v_extra || pg_catalog.jsonb_build_object('segments_total',v_segments_total);
  return pg_catalog.jsonb_build_object('status',v_status,'reason',v_reason,'scope',v_scope,
    'values',case when v_status='ok' then v_values else '[]'::jsonb end,
    'composition',v_comp,'extra',v_extra);
end;
$$;
revoke all on function public.chat_breakdown(uuid,text,text,text,date,date,uuid,text,integer)
  from public,anon,authenticated,service_role,praxa_integrations;
grant execute on function public.chat_breakdown(uuid,text,text,text,date,date,uuid,text,integer)
  to authenticated;
