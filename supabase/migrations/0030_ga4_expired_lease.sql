-- H-E1-268: un paso interrumpido conserva su checkpoint y libera el lease vencido.
-- Misma firma, validaciones, rol y grants de 0027. El bloqueo de empresa y
-- conexion serializa el cierre del lease anterior con el inicio del nuevo.
create or replace function worker_api.ga4_start_sync(
  p_actor_user_id uuid, p_company_id uuid, p_connection_id uuid,
  p_generation integer, p_run_id uuid, p_lease_token uuid,
  p_lease_expires_at timestamptz, p_phase text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare v_connection public.integration_connections;
        v_previous private.ga4_sync_runs;
begin
  v_connection := private.ga4_locked_connection(
    p_actor_user_id, p_company_id, p_connection_id, p_generation);
  if p_run_id is null or p_lease_token is null or p_lease_expires_at is null
     or p_lease_expires_at <= now() or p_lease_expires_at > now() + interval '15 minutes'
     or p_phase is null or p_phase not in ('backfill', 'incremental') then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;

  update private.ga4_sync_runs r
     set status = 'incomplete', finished_at = now(), error_kind = 'transitorio'
   where r.connection_id = p_connection_id and r.company_id = p_company_id
     and r.status = 'running' and r.lease_expires_at <= now();
  if exists (select 1 from private.ga4_sync_runs r where r.connection_id = p_connection_id
             and r.status = 'running') then
    raise exception 'praxa: ya hay una sincronización en curso' using errcode = 'PX003';
  end if;
  select r.* into v_previous from private.ga4_sync_runs r
   where r.connection_id = p_connection_id and r.company_id = p_company_id
     and r.credential_generation = p_generation and r.phase = p_phase
     and r.status = 'incomplete'
   order by r.finished_at desc limit 1;
  insert into private.ga4_sync_runs
    (id, company_id, connection_id, credential_generation, lease_token, phase,
     status, started_at, lease_expires_at, target_reports, preflight, checkpoint)
  values (p_run_id, p_company_id, p_connection_id, p_generation, p_lease_token,
          p_phase, 'running', now(), p_lease_expires_at,
          coalesce(v_previous.target_reports, '{}'::text[]),
          coalesce(v_previous.preflight, '{}'::jsonb),
          coalesce(v_previous.checkpoint, '{}'::jsonb));
  insert into public.ga4_sync_status (company_id, connection_id, phase, last_step_at, last_step_status)
  values (p_company_id, p_connection_id, p_phase, now(), 'running')
  on conflict (connection_id) do update
    set phase = excluded.phase, last_step_at = excluded.last_step_at,
        last_step_status = excluded.last_step_status, updated_at = now();
  return true;
end;
$$;
