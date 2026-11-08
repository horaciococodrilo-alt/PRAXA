-- PRAXA 0016 — Insights de Meta: ejecuciones, snapshots por nivel, cobertura y lecturas
--
-- M16c. Catálogo y semántica: §11 de la spec de la ruta (DEC-22). Contratos exactos:
-- docs/FASES/FASE1/M16c/spec.md.
--
-- MATRIZ DE PRIVILEGIOS (spec de la ruta, sección 7)
--
--   objeto                              | anon | authenticated   | rol de C          | PUBLIC   | service_role
--   ------------------------------------+------+-----------------+-------------------+----------+-------------
--   public.meta_daily_coverage          | —    | SELECT por RLS  | —                 | —        | —
--   public.meta_sync_runs               | —    | —               | —                 | —        | —
--   public.meta_entities                | —    | —               | —                 | —        | —
--   public.meta_insight_snapshots       | —    | —               | —                 | —        | —
--   public.meta_snapshot_entities       | —    | —               | —                 | —        | —
--   public.meta_snapshot_days           | —    | —               | —                 | —        | —
--   public.meta_snapshot_actions        | —    | —               | —                 | —        | —
--   worker_api: start_sync_run,         | —    | —               | EXECUTE, función  | revocado | —
--     publish_snapshot, fail_sync_run,  |      |                 | por función       |          |
--     record_connection_error           |      |                 |                   |          |
--   public: get_meta_daily_coverage,    | —    | EXECUTE         | —                 | revocado | —
--     list_meta_entities,               |      |                 |                   |          |
--     get_meta_sync_status (INVOKER)    |      |                 |                   |          |
--
-- REGLAS
--
--   * `integration_connections.meta_sync_summary` es una proyección segura del último
--     intento, legible por el SELECT y la RLS que la conexión ya tiene. La construye solo
--     SQL; no se copia ningún JSON recibido. Las lecturas públicas no tocan tablas ocultas.
--   * Orden de bloqueos: autorización → cerrojo de empresa → conexión FOR UPDATE → run FOR
--     UPDATE. El reloj es `clock_timestamp()` después de esperar esos bloqueos (CA-59).
--   * La vigencia es token + puntero + lease + generación + estado, también al fallar y al
--     pedir reautorización. `mark_needs_reauth` se ejecuta dentro de `fail_sync_run`.
--   * Métricas como `numeric`/`bigint`; salen siempre como texto (CA-44b).
--   * Las funciones nuevas o reemplazadas traducen la clase 23 con
--     `private.raise_worker_integrity_error` (H-E1-27), sin reescribir las de 0012. Ese
--     helper no menciona credenciales: pgTAP 09, T-14, prohíbe nombrarlas fuera de worker_api.
--
-- CATÁLOGO DE ERRORES: se suman a los de 0012
--
--   SQLSTATE | clave               | cuándo
--   ---------+---------------------+-------------------------------------------------------
--   PX009    | sync_in_progress    | ya hay un run vigente de la misma generación
--   PX010    | sync_ownership_lost | el run venció, terminó, fue reemplazado o el token no coincide
--   55000    | —                   | UPDATE sobre datos inmutables de un snapshot

-- ---------------------------------------------------------------------------
-- Rol de C (H-E1-36)
-- ---------------------------------------------------------------------------

-- 0012 aceptaba un rol preexistente con `CONNECTION LIMIT 0` o `VALID UNTIL` vencido y el
-- cliente no podía conectarse. Corrige solo esos dos atributos: ALTER ROLE no toca la
-- contraseña ni los grants. No reejecuta el bloque de 0012, que exige ACL vacía y fallaría
-- sobre el rol vivo. run-pgtap prueba este mismo bloque sobre un rol sintético.
do $$
begin
  alter role praxa_integrations connection limit -1 valid until 'infinity';
end;
$$;

-- ---------------------------------------------------------------------------
-- Helpers privados de validación
-- ---------------------------------------------------------------------------

-- Traducción única de la clase 23 (H-E1-27). Solo las restricciones de las tablas que
-- escriben las funciones de esta migración; todo lo demás es 22023 sin detalle.
create function private.raise_worker_integrity_error(p_constraint_name text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_constraint_name = 'integration_connections_account_key' then
    raise exception 'praxa: la cuenta ya está vinculada' using errcode = 'PX007';
  elsif p_constraint_name = 'integration_connections_one_live_per_company' then
    raise exception 'praxa: la empresa ya tiene una conexión' using errcode = 'PX003';
  elsif p_constraint_name in ('integration_connections_pkey', 'meta_sync_runs_pkey') then
    raise exception 'praxa: operación no autorizada' using errcode = 'PX001';
  elsif p_constraint_name = 'meta_sync_runs_one_running' then
    raise exception 'praxa: ya hay una sincronización en curso' using errcode = 'PX009';
  else
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;
end;
$$;

create function private.meta_iso(p_at timestamptz)
returns text
language sql
stable
set search_path = ''
as $$
  select pg_catalog.to_char(p_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
$$;

create function private.meta_has_exact_keys(p_value jsonb, p_keys text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case when pg_catalog.jsonb_typeof(p_value) = 'object'
    then (select pg_catalog.count(*) = pg_catalog.cardinality(p_keys)
                 and pg_catalog.bool_and(k = any (p_keys))
            from pg_catalog.jsonb_object_keys(p_value) as k)
    else false end
$$;

create function private.meta_level_rank(p_level text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_level when 'account' then 0 when 'campaign' then 1
                      when 'adset' then 2 when 'ad' then 3 end
$$;

create function private.meta_parent_level(p_level text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_level when 'campaign' then 'account' when 'adset' then 'campaign'
                      when 'ad' then 'adset' end
$$;

-- Cadena JSON con el patrón decimal de la spec, o null JSON. Espejo del patrón de TypeScript.
create function private.meta_valid_decimal(p_value jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case pg_catalog.jsonb_typeof(p_value)
    when 'null' then true
    when 'string' then pg_catalog.char_length(p_value #>> '{}') <= 128
                       and (p_value #>> '{}') ~ '^[0-9]+([.][0-9]+)?$'
    else false end
$$;

-- Conteo base: entero en cadena que cabe en bigint, o null JSON.
create function private.meta_valid_count(p_value jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case pg_catalog.jsonb_typeof(p_value)
    when 'null' then true
    when 'string' then
      case when pg_catalog.char_length(p_value #>> '{}') <= 128 and (p_value #>> '{}') ~ '^[0-9]+$'
        then (p_value #>> '{}')::numeric <= 9223372036854775807
        else false end
    else false end
$$;

-- Entero JSON no negativo dentro de int4.
create function private.meta_valid_int(p_value jsonb, p_min integer default 0)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case when pg_catalog.jsonb_typeof(p_value) = 'number' and (p_value #>> '{}') ~ '^[0-9]{1,10}$'
    then (p_value #>> '{}')::bigint between p_min and 2147483647
    else false end
$$;

create function private.meta_try_date(p_value text)
returns date
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_value is null or p_value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    return null;
  end if;
  return p_value::date;
exception when others then
  return null;
end;
$$;

create function private.meta_try_timestamptz(p_value text)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_value is null
     or p_value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]{1,6})?Z$' then
    return null;
  end if;
  return p_value::timestamptz;
exception when others then
  return null;
end;
$$;

-- p_limits de start_sync_run: claves cerradas, enteros positivos y lease según la fórmula de
-- la spec, `ceil((maxDurationMs + finalizationReserveMs) / 1000)`.
create function private.valid_meta_sync_limits(p_limits jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  if not private.meta_has_exact_keys(p_limits, array[
       'lookbackDays', 'maxWindowDays', 'maxPagesPerLevel', 'maxMetadataPages', 'maxEntities',
       'maxPayloadBytes', 'maxDurationMs', 'finalizationReserveMs', 'leaseSeconds', 'maxRetries',
       'retryDelayMs']) then
    return false;
  end if;
  if not (private.meta_valid_int(p_limits->'lookbackDays', 1)
          and private.meta_valid_int(p_limits->'maxWindowDays', 1)
          and private.meta_valid_int(p_limits->'maxPagesPerLevel', 1)
          and private.meta_valid_int(p_limits->'maxMetadataPages', 1)
          and private.meta_valid_int(p_limits->'maxEntities', 1)
          and private.meta_valid_int(p_limits->'maxPayloadBytes', 1)
          and private.meta_valid_int(p_limits->'maxDurationMs', 1)
          and private.meta_valid_int(p_limits->'finalizationReserveMs', 1)
          and private.meta_valid_int(p_limits->'leaseSeconds', 1)
          and private.meta_valid_int(p_limits->'maxRetries', 0)
          and private.meta_valid_int(p_limits->'retryDelayMs', 0)) then
    return false;
  end if;
  return (p_limits->>'maxWindowDays')::integer >= (p_limits->>'lookbackDays')::integer
     and (p_limits->>'leaseSeconds')::bigint = pg_catalog.ceil(
           ((p_limits->>'maxDurationMs')::numeric + (p_limits->>'finalizationReserveMs')::numeric) / 1000);
end;
$$;

create function private.meta_valid_summary_instant(p_value jsonb, p_nullable boolean)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case pg_catalog.jsonb_typeof(p_value)
    when 'null' then p_nullable
    when 'string' then (p_value #>> '{}')
      ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]{1,6})?Z$'
    else false end
$$;

create function private.valid_meta_level_summary(p_level jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_status text := p_level->>'status';
  v_reason text := p_level->>'reason';
begin
  if not private.meta_has_exact_keys(p_level, array['status', 'reason', 'fetched_at', 'finished_at'])
     or not private.meta_valid_summary_instant(p_level->'fetched_at', true)
     or not private.meta_valid_summary_instant(p_level->'finished_at', true) then
    return false;
  end if;
  if v_status in ('pending', 'not_attempted') then
    return v_reason is null and p_level->>'fetched_at' is null and p_level->>'finished_at' is null;
  elsif v_status = 'complete' then
    return v_reason = 'complete' and p_level->>'fetched_at' is not null and p_level->>'finished_at' is not null;
  elsif v_status in ('incomplete', 'failed') then
    return v_reason in ('page_limit', 'duration_limit', 'invalid_response', 'meta_error', 'own_error')
       and p_level->>'fetched_at' is not null and p_level->>'finished_at' is not null;
  end if;
  return false;
end;
$$;

-- Forma cerrada de meta_sync_summary: sin payload, nombres, importes, IDs, run_id ni token.
create function private.valid_meta_sync_summary(p_summary jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  if not private.meta_has_exact_keys(p_summary, array[
       'version', 'credential_generation', 'window_from', 'window_to', 'max_window_days',
       'started_at', 'lease_expires_at', 'finished_at', 'status', 'levels'])
     or p_summary->'version' <> '1'::jsonb
     or not private.meta_valid_int(p_summary->'credential_generation', 0)
     or not private.meta_valid_int(p_summary->'max_window_days', 1)
     or private.meta_try_date(p_summary->>'window_from') is null
     or private.meta_try_date(p_summary->>'window_to') is null
     or not private.meta_valid_summary_instant(p_summary->'started_at', false)
     or not private.meta_valid_summary_instant(p_summary->'lease_expires_at', false)
     or not private.meta_valid_summary_instant(p_summary->'finished_at', true)
     or coalesce(p_summary->>'status', '') not in ('running', 'completed', 'partial', 'failed')
     or not private.meta_has_exact_keys(p_summary->'levels', array['account', 'campaign', 'adset', 'ad']) then
    return false;
  end if;
  return private.valid_meta_level_summary(p_summary->'levels'->'account')
     and private.valid_meta_level_summary(p_summary->'levels'->'campaign')
     and private.valid_meta_level_summary(p_summary->'levels'->'adset')
     and private.valid_meta_level_summary(p_summary->'levels'->'ad');
end;
$$;

-- Atribución de entrada, con IDs externos de conjuntos: se transforma antes de persistir.
create function private.meta_valid_attribution(p_attribution jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_setting jsonb;
  v_window  jsonb;
begin
  if not private.meta_has_exact_keys(p_attribution, array['known', 'report_time', 'unified', 'settings'])
     or pg_catalog.jsonb_typeof(p_attribution->'known') <> 'boolean'
     or p_attribution->'report_time' <> '"impression"'::jsonb
     or p_attribution->'unified' <> 'true'::jsonb
     or pg_catalog.jsonb_typeof(p_attribution->'settings') <> 'array' then
    return false;
  end if;
  -- Sin acreditar no se inventa ventana; acreditada exige al menos una configuración.
  if (p_attribution->>'known')::boolean <> (pg_catalog.jsonb_array_length(p_attribution->'settings') > 0) then
    return false;
  end if;
  for v_setting in select * from pg_catalog.jsonb_array_elements(p_attribution->'settings') loop
    if not private.meta_has_exact_keys(v_setting, array['adset_external_id', 'windows'])
       or pg_catalog.jsonb_typeof(v_setting->'adset_external_id') <> 'string'
       or (v_setting->>'adset_external_id') !~ '^[0-9]{1,32}$'
       or pg_catalog.jsonb_typeof(v_setting->'windows') <> 'array'
       or pg_catalog.jsonb_array_length(v_setting->'windows') = 0 then
      return false;
    end if;
    for v_window in select * from pg_catalog.jsonb_array_elements(v_setting->'windows') loop
      if not private.meta_has_exact_keys(v_window, array['event_type', 'days'])
         or pg_catalog.jsonb_typeof(v_window->'event_type') <> 'string'
         or (v_window->>'event_type') !~ '^[A-Za-z][A-Za-z0-9_]{0,63}$'
         or not private.meta_valid_int(v_window->'days', 1)
         or (v_window->>'days')::bigint > 365 then
        return false;
      end if;
    end loop;
    if (select pg_catalog.count(*) <> pg_catalog.count(distinct w)
          from pg_catalog.jsonb_array_elements(v_setting->'windows') w) then
      return false;
    end if;
  end loop;
  return (select pg_catalog.count(*) = pg_catalog.count(distinct s->>'adset_external_id')
            from pg_catalog.jsonb_array_elements(p_attribution->'settings') s);
end;
$$;

create function private.meta_valid_entity(p_entity jsonb, p_root text, p_started_at timestamptz)
returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare
  v_level    text;
  v_ext      text;
  v_captured timestamptz;
begin
  if not private.meta_has_exact_keys(p_entity, array[
       'level', 'external_id', 'parent_external_id', 'name', 'effective_status', 'objective',
       'metadata_fetched_at', 'attribution'])
     or pg_catalog.jsonb_typeof(p_entity->'level') <> 'string'
     or pg_catalog.jsonb_typeof(p_entity->'external_id') <> 'string'
     or pg_catalog.jsonb_typeof(p_entity->'metadata_fetched_at') <> 'string'
     or pg_catalog.jsonb_typeof(p_entity->'parent_external_id') not in ('string', 'null')
     or pg_catalog.jsonb_typeof(p_entity->'name') not in ('string', 'null')
     or pg_catalog.jsonb_typeof(p_entity->'effective_status') not in ('string', 'null')
     or pg_catalog.jsonb_typeof(p_entity->'objective') not in ('string', 'null') then
    return false;
  end if;

  v_level := p_entity->>'level';
  v_ext := p_entity->>'external_id';
  if v_level = 'account' then
    if v_ext !~ '^act_[0-9]{1,60}$' or v_ext is distinct from p_root
       or p_entity->>'parent_external_id' is not null then
      return false;
    end if;
  elsif v_level = 'campaign' then
    if v_ext !~ '^[0-9]{1,32}$' or p_entity->>'parent_external_id' is distinct from p_root then
      return false;
    end if;
  elsif v_level in ('adset', 'ad') then
    if v_ext !~ '^[0-9]{1,32}$' or coalesce(p_entity->>'parent_external_id', '') !~ '^[0-9]{1,32}$' then
      return false;
    end if;
  else
    return false;
  end if;

  if pg_catalog.char_length(coalesce(p_entity->>'name', '')) > 1024
     or pg_catalog.char_length(coalesce(p_entity->>'effective_status', '')) > 128
     or pg_catalog.char_length(coalesce(p_entity->>'objective', '')) > 128
     or (v_level <> 'campaign' and p_entity->>'objective' is not null) then
    return false;
  end if;

  v_captured := private.meta_try_timestamptz(p_entity->>'metadata_fetched_at');
  if v_captured is null or v_captured < p_started_at or v_captured > pg_catalog.clock_timestamp() then
    return false;
  end if;

  return private.meta_valid_attribution(p_entity->'attribution');
end;
$$;

create function private.meta_valid_action(p_action jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case when private.meta_has_exact_keys(p_action, array['action_type', 'variant', 'count', 'value'])
              and pg_catalog.jsonb_typeof(p_action->'action_type') = 'string'
              and pg_catalog.jsonb_typeof(p_action->'variant') = 'string'
    then (p_action->>'action_type') ~ '^[A-Za-z0-9._]{1,128}$'
         and (p_action->>'variant') ~ '^[A-Za-z][A-Za-z0-9_]{0,63}$'
         and private.meta_valid_decimal(p_action->'count')
         and private.meta_valid_decimal(p_action->'value')
         and (p_action->>'count' is not null or p_action->>'value' is not null)
    else false end
$$;

create function private.meta_valid_day(p_day jsonb, p_level text, p_from date, p_to date)
returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare
  v_date date;
begin
  if not private.meta_has_exact_keys(p_day, array[
       'date', 'level', 'external_id', 'spend', 'impressions', 'reach', 'clicks', 'inline_link_clicks',
       'ctr', 'cpc', 'cpm', 'frequency', 'actions'])
     or pg_catalog.jsonb_typeof(p_day->'date') <> 'string'
     or pg_catalog.jsonb_typeof(p_day->'external_id') <> 'string'
     or pg_catalog.jsonb_typeof(p_day->'actions') <> 'array'
     or p_day->>'level' is distinct from p_level then
    return false;
  end if;

  v_date := private.meta_try_date(p_day->>'date');
  if v_date is null or v_date < p_from or v_date > p_to then
    return false;
  end if;

  if not (private.meta_valid_decimal(p_day->'spend') and private.meta_valid_decimal(p_day->'ctr')
          and private.meta_valid_decimal(p_day->'cpc') and private.meta_valid_decimal(p_day->'cpm')
          and private.meta_valid_decimal(p_day->'frequency')
          and private.meta_valid_count(p_day->'impressions') and private.meta_valid_count(p_day->'reach')
          and private.meta_valid_count(p_day->'clicks') and private.meta_valid_count(p_day->'inline_link_clicks')) then
    return false;
  end if;

  if exists (select 1 from pg_catalog.jsonb_array_elements(p_day->'actions') a
              where not private.meta_valid_action(a)) then
    return false;
  end if;

  return (select pg_catalog.count(*) = pg_catalog.count(distinct (a->>'action_type', a->>'variant'))
            from pg_catalog.jsonb_array_elements(p_day->'actions') a);
end;
$$;

-- Revalidación de lo que el extractor ya normalizó. SQL no corrige nada: rechaza con 22023.
create function private.meta_assert_payload(
  p_payload    jsonb,
  p_level      text,
  p_root       text,
  p_window_from date,
  p_window_to  date,
  p_started_at timestamptz,
  p_limits     jsonb
)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not private.meta_has_exact_keys(p_payload, array['entities', 'days'])
     or pg_catalog.jsonb_typeof(p_payload->'entities') <> 'array'
     or pg_catalog.jsonb_typeof(p_payload->'days') <> 'array'
     or pg_catalog.octet_length(p_payload::text) > (p_limits->>'maxPayloadBytes')::bigint
     or pg_catalog.jsonb_array_length(p_payload->'entities') > (p_limits->>'maxEntities')::integer then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;

  -- Cada entidad, sus duplicados, su nivel respecto del snapshot y su parentesco.
  if exists (
       select 1 from pg_catalog.jsonb_array_elements(p_payload->'entities') e
        where not coalesce(private.meta_valid_entity(e, p_root, p_started_at), false)
           or private.meta_level_rank(e->>'level') > private.meta_level_rank(p_level)
     )
     or exists (
       select 1 from pg_catalog.jsonb_array_elements(p_payload->'entities') e
        group by e->>'level', e->>'external_id' having pg_catalog.count(*) > 1
     )
     or exists (
       select 1 from pg_catalog.jsonb_array_elements(p_payload->'entities') e
        where e->>'level' <> 'account'
          and not exists (
            select 1 from pg_catalog.jsonb_array_elements(p_payload->'entities') parent
             where parent->>'level' = private.meta_parent_level(e->>'level')
               and parent->>'external_id' = e->>'parent_external_id')
     ) then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;

  -- Cada fila es del nivel, tiene metadata en el payload y no se repite.
  if exists (
       select 1 from pg_catalog.jsonb_array_elements(p_payload->'days') d
        where not coalesce(private.meta_valid_day(d, p_level, p_window_from, p_window_to), false)
           or not exists (
             select 1 from pg_catalog.jsonb_array_elements(p_payload->'entities') e
              where e->>'level' = p_level and e->>'external_id' = d->>'external_id')
     )
     or exists (
       select 1 from pg_catalog.jsonb_array_elements(p_payload->'days') d
        group by d->>'external_id', d->>'date' having pg_catalog.count(*) > 1
     ) then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;
end;
$$;

-- Parámetros sin credenciales: fijos del catálogo, nunca copiados del cliente.
create function private.meta_snapshot_parameters(p_level text, p_from date, p_to date)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'level', p_level,
    'time_increment', 1,
    'time_range', pg_catalog.jsonb_build_object('since', p_from::text, 'until', p_to::text),
    'action_report_time', 'impression',
    'use_unified_attribution_setting', true,
    'fields', pg_catalog.jsonb_build_array('spend', 'impressions', 'reach', 'clicks', 'inline_link_clicks',
                                           'ctr', 'cpc', 'cpm', 'frequency', 'actions', 'action_values'))
$$;

-- Proyección pública cerrada: claves exactas y sin IDs externos, construida por SQL.
create function private.valid_meta_coverage_projection(p_entities jsonb, p_rows jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case when pg_catalog.jsonb_typeof(p_entities) = 'array' and pg_catalog.jsonb_typeof(p_rows) = 'array'
    then not exists (
           select 1 from pg_catalog.jsonb_array_elements(p_entities) e
            where not private.meta_has_exact_keys(e, array['entity_ref', 'level', 'parent_ref', 'name',
                    'effective_status', 'objective', 'metadata_fetched_at', 'attribution']))
         and not exists (
           select 1 from pg_catalog.jsonb_array_elements(p_rows) r
            where not private.meta_has_exact_keys(r, array['entity_ref', 'spend', 'impressions', 'reach',
                    'clicks', 'inline_link_clicks', 'ctr', 'cpc', 'cpm', 'frequency', 'actions', 'attribution']))
    else false end
$$;

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

alter table public.integration_connections
  add column meta_sync_summary jsonb,
  add constraint integration_connections_meta_sync_summary_shape
    check (meta_sync_summary is null or private.valid_meta_sync_summary(meta_sync_summary));

create table public.meta_sync_runs (
  id                    uuid primary key,
  company_id            uuid not null,
  connection_id         uuid not null,
  credential_generation integer not null,
  ownership_token       text not null,
  started_at            timestamptz not null,
  lease_expires_at      timestamptz not null,
  finished_at           timestamptz,
  window_from           date not null,
  window_to             date not null,
  status                text not null,
  limits                jsonb not null,

  constraint meta_sync_runs_connection_fkey
    foreign key (company_id, connection_id)
    references public.integration_connections (company_id, id) on delete cascade,
  constraint meta_sync_runs_company_connection_id_key unique (company_id, connection_id, id),
  constraint meta_sync_runs_generation_nonnegative check (credential_generation >= 0),
  constraint meta_sync_runs_token_format check (ownership_token ~ '^[0-9a-f]{64}$'),
  constraint meta_sync_runs_lease_after_start check (lease_expires_at > started_at),
  constraint meta_sync_runs_window check (window_to >= window_from),
  constraint meta_sync_runs_status
    check (status in ('running', 'completed', 'partial', 'failed', 'superseded')),
  constraint meta_sync_runs_terminal_finished check ((status = 'running') = (finished_at is null)),
  constraint meta_sync_runs_limits_shape check (private.valid_meta_sync_limits(limits))
);

-- CA-58: una sola ejecución vigente por conexión.
create unique index meta_sync_runs_one_running
  on public.meta_sync_runs (connection_id)
  where status = 'running';

alter table public.integration_connections
  add constraint integration_connections_current_sync_run_fkey
    foreign key (company_id, id, current_sync_run_id)
    references public.meta_sync_runs (company_id, connection_id, id);

-- Registro estable de referencias opacas. No guarda nombres actuales que reescriban historia.
create table public.meta_entities (
  entity_ref    uuid primary key default gen_random_uuid(),
  company_id    uuid not null,
  connection_id uuid not null,
  level         text not null,
  external_id   text not null,
  parent_ref    uuid,

  constraint meta_entities_connection_fkey
    foreign key (company_id, connection_id)
    references public.integration_connections (company_id, id) on delete cascade,
  constraint meta_entities_connection_level_external_key unique (connection_id, level, external_id),
  constraint meta_entities_company_connection_ref_key unique (company_id, connection_id, entity_ref),
  constraint meta_entities_parent_fkey
    foreign key (company_id, connection_id, parent_ref)
    references public.meta_entities (company_id, connection_id, entity_ref) on delete cascade,
  constraint meta_entities_level check (level in ('account', 'campaign', 'adset', 'ad')),
  constraint meta_entities_root_without_parent check (level <> 'account' or parent_ref is null)
);

create table public.meta_insight_snapshots (
  id              uuid primary key,
  company_id      uuid not null,
  connection_id   uuid not null,
  sync_run_id     uuid not null,
  level           text not null,
  fetched_at      timestamptz not null,
  window_from     date not null,
  window_to       date not null,
  currency        text not null,
  timezone        text not null,
  pages           integer not null,
  validated_pages integer not null,
  complete        boolean not null,
  result          text not null,
  failure_reason  text,
  error_class     text,
  parameters      jsonb not null,
  duration_ms     integer not null,
  request_payload jsonb not null,

  constraint meta_insight_snapshots_run_fkey
    foreign key (company_id, connection_id, sync_run_id)
    references public.meta_sync_runs (company_id, connection_id, id) on delete cascade,
  constraint meta_insight_snapshots_run_level_key unique (sync_run_id, level),
  constraint meta_insight_snapshots_company_connection_id_key unique (company_id, connection_id, id),
  constraint meta_insight_snapshots_company_connection_level_id_key
    unique (company_id, connection_id, level, id),
  constraint meta_insight_snapshots_level check (level in ('account', 'campaign', 'adset', 'ad')),
  constraint meta_insight_snapshots_window check (window_to >= window_from),
  constraint meta_insight_snapshots_duration check (duration_ms >= 0),
  constraint meta_insight_snapshots_counters check (validated_pages >= 0 and validated_pages <= pages),
  constraint meta_insight_snapshots_result_values check (result in ('complete', 'incomplete', 'failed')),
  constraint meta_insight_snapshots_reason_values
    check (failure_reason in ('page_limit', 'duration_limit', 'invalid_response', 'meta_error', 'own_error')),
  constraint meta_insight_snapshots_error_class
    check (error_class in ('authentication', 'user_action', 'permission', 'asset_access',
                           'rate_limit', 'temporary', 'own_error', 'transport', 'unknown')),
  -- Clasificación determinística: result, complete, contadores, razón y clase van juntos.
  constraint meta_insight_snapshots_classification
    check ((result = 'complete' and complete and validated_pages = pages and pages > 0
            and failure_reason is null and error_class is null)
           or (result = 'incomplete' and not complete and validated_pages > 0
               and failure_reason is not null and error_class is not null)
           or (result = 'failed' and not complete and validated_pages = 0
               and failure_reason is not null and error_class is not null))
);

-- La metadata pertenece a la captura, no al día medido.
create table public.meta_snapshot_entities (
  snapshot_id         uuid not null,
  entity_ref          uuid not null,
  company_id          uuid not null,
  connection_id       uuid not null,
  name                text,
  effective_status    text,
  objective           text,
  parent_ref          uuid,
  metadata_fetched_at timestamptz not null,
  attribution         jsonb not null,

  primary key (snapshot_id, entity_ref),
  constraint meta_snapshot_entities_snapshot_fkey
    foreign key (company_id, connection_id, snapshot_id)
    references public.meta_insight_snapshots (company_id, connection_id, id) on delete cascade,
  constraint meta_snapshot_entities_entity_fkey
    foreign key (company_id, connection_id, entity_ref)
    references public.meta_entities (company_id, connection_id, entity_ref) on delete cascade,
  constraint meta_snapshot_entities_parent_fkey
    foreign key (snapshot_id, parent_ref)
    references public.meta_snapshot_entities (snapshot_id, entity_ref) on delete cascade,
  constraint meta_snapshot_entities_composite_key
    unique (company_id, connection_id, snapshot_id, entity_ref),
  constraint meta_snapshot_entities_name_length check (char_length(name) <= 1024),
  constraint meta_snapshot_entities_status_length check (char_length(effective_status) <= 128),
  constraint meta_snapshot_entities_objective_length check (char_length(objective) <= 128),
  constraint meta_snapshot_entities_attribution_object check (jsonb_typeof(attribution) = 'object')
);

create table public.meta_snapshot_days (
  snapshot_id        uuid not null,
  entity_ref         uuid not null,
  date               date not null,
  company_id         uuid not null,
  connection_id      uuid not null,
  spend              numeric,
  impressions        bigint,
  reach              bigint,
  clicks             bigint,
  inline_link_clicks bigint,
  ctr                numeric,
  cpc                numeric,
  cpm                numeric,
  frequency          numeric,

  primary key (snapshot_id, entity_ref, date),
  constraint meta_snapshot_days_entity_fkey
    foreign key (company_id, connection_id, snapshot_id, entity_ref)
    references public.meta_snapshot_entities (company_id, connection_id, snapshot_id, entity_ref)
    on delete cascade,
  constraint meta_snapshot_days_composite_key
    unique (company_id, connection_id, snapshot_id, entity_ref, date),
  constraint meta_snapshot_days_nonnegative
    check (spend >= 0 and impressions >= 0 and reach >= 0 and clicks >= 0 and inline_link_clicks >= 0
           and ctr >= 0 and cpc >= 0 and cpm >= 0 and frequency >= 0)
);

-- Sin total por tipo: las variantes de atribución no se suman.
create table public.meta_snapshot_actions (
  snapshot_id   uuid not null,
  entity_ref    uuid not null,
  date          date not null,
  action_type   text not null,
  variant       text not null,
  company_id    uuid not null,
  connection_id uuid not null,
  count         numeric,
  value         numeric,

  primary key (snapshot_id, entity_ref, date, action_type, variant),
  constraint meta_snapshot_actions_day_fkey
    foreign key (company_id, connection_id, snapshot_id, entity_ref, date)
    references public.meta_snapshot_days (company_id, connection_id, snapshot_id, entity_ref, date)
    on delete cascade,
  constraint meta_snapshot_actions_type check (action_type ~ '^[A-Za-z0-9._]{1,128}$'),
  constraint meta_snapshot_actions_variant check (variant ~ '^[A-Za-z][A-Za-z0-9_]{0,63}$'),
  constraint meta_snapshot_actions_some_value check (num_nonnulls(count, value) > 0),
  constraint meta_snapshot_actions_nonnegative check (count >= 0 and value >= 0)
);

-- CA-43: cobertura vigente por conexión, nivel y día. entities y rows son una proyección
-- cerrada construida por SQL, sin IDs externos: es lo único que un usuario puede leer.
create table public.meta_daily_coverage (
  connection_id           uuid not null,
  level                   text not null,
  date                    date not null,
  company_id              uuid not null,
  snapshot_id             uuid not null,
  fetched_at              timestamptz not null,
  captured_before_day_end boolean not null,
  currency                text not null,
  timezone                text not null,
  entities                jsonb not null,
  rows                    jsonb not null,

  primary key (connection_id, level, date),
  constraint meta_daily_coverage_snapshot_fkey
    foreign key (company_id, connection_id, level, snapshot_id)
    references public.meta_insight_snapshots (company_id, connection_id, level, id) on delete cascade,
  constraint meta_daily_coverage_level check (level in ('account', 'campaign', 'adset', 'ad')),
  constraint meta_daily_coverage_projection
    check (private.valid_meta_coverage_projection(entities, rows))
);

create index meta_sync_runs_company_connection_idx on public.meta_sync_runs (company_id, connection_id);
create index meta_entities_parent_idx on public.meta_entities (company_id, connection_id, parent_ref);
create index meta_insight_snapshots_company_connection_idx on public.meta_insight_snapshots (company_id, connection_id);
create index meta_snapshot_entities_entity_idx on public.meta_snapshot_entities (company_id, connection_id, entity_ref);
create index meta_snapshot_entities_parent_idx on public.meta_snapshot_entities (snapshot_id, parent_ref);
create index meta_snapshot_days_company_connection_idx on public.meta_snapshot_days (company_id, connection_id);
create index meta_snapshot_actions_company_connection_idx on public.meta_snapshot_actions (company_id, connection_id);
create index meta_daily_coverage_snapshot_idx on public.meta_daily_coverage (company_id, connection_id, level, snapshot_id);

-- ---------------------------------------------------------------------------
-- Triggers de integridad
-- ---------------------------------------------------------------------------

-- Un padre existe y es del nivel inmediato superior. La FK ya garantiza la misma conexión.
create function private.meta_entities_check_parent()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.parent_ref is not null and not exists (
       select 1 from public.meta_entities p
        where p.entity_ref = new.parent_ref
          and p.level = private.meta_parent_level(new.level)
     ) then
    raise exception 'praxa: jerarquía de entidades inválida' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger meta_entities_parent_level
  before insert or update on public.meta_entities
  for each row execute function private.meta_entities_check_parent();

-- Días y cobertura dentro de la ventana del snapshot; la cobertura, solo de uno completo.
create function private.meta_check_within_snapshot()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_snapshot public.meta_insight_snapshots;
begin
  select s.* into v_snapshot from public.meta_insight_snapshots s where s.id = new.snapshot_id;
  if not found or new.date < v_snapshot.window_from or new.date > v_snapshot.window_to
     or (tg_table_name = 'meta_daily_coverage' and not v_snapshot.complete) then
    raise exception 'praxa: fila fuera del snapshot' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger meta_snapshot_days_within_snapshot
  before insert or update on public.meta_snapshot_days
  for each row execute function private.meta_check_within_snapshot();

create trigger meta_daily_coverage_within_snapshot
  before insert or update on public.meta_daily_coverage
  for each row execute function private.meta_check_within_snapshot();

-- CA-41: inmutables también para las funciones privilegiadas. El borrado queda para la purga
-- legítima y la cascada administrativa de la empresa.
create function private.meta_forbid_snapshot_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'praxa: los datos de un snapshot son inmutables' using errcode = '55000';
end;
$$;

create trigger meta_insight_snapshots_immutable
  before update on public.meta_insight_snapshots
  for each row execute function private.meta_forbid_snapshot_update();
create trigger meta_snapshot_entities_immutable
  before update on public.meta_snapshot_entities
  for each row execute function private.meta_forbid_snapshot_update();
create trigger meta_snapshot_days_immutable
  before update on public.meta_snapshot_days
  for each row execute function private.meta_forbid_snapshot_update();
create trigger meta_snapshot_actions_immutable
  before update on public.meta_snapshot_actions
  for each row execute function private.meta_forbid_snapshot_update();

-- ---------------------------------------------------------------------------
-- RLS y privilegios de tablas
-- ---------------------------------------------------------------------------

revoke all on public.meta_sync_runs, public.meta_entities, public.meta_insight_snapshots,
  public.meta_snapshot_entities, public.meta_snapshot_days, public.meta_snapshot_actions,
  public.meta_daily_coverage
  from public, anon, authenticated, service_role, praxa_integrations;

alter table public.meta_sync_runs enable row level security;
alter table public.meta_sync_runs force row level security;
alter table public.meta_entities enable row level security;
alter table public.meta_entities force row level security;
alter table public.meta_insight_snapshots enable row level security;
alter table public.meta_insight_snapshots force row level security;
alter table public.meta_snapshot_entities enable row level security;
alter table public.meta_snapshot_entities force row level security;
alter table public.meta_snapshot_days enable row level security;
alter table public.meta_snapshot_days force row level security;
alter table public.meta_snapshot_actions enable row level security;
alter table public.meta_snapshot_actions force row level security;
alter table public.meta_daily_coverage enable row level security;
alter table public.meta_daily_coverage force row level security;

-- Una conexión desconectada no expone cobertura mientras se purga.
create policy meta_daily_coverage_select_member
  on public.meta_daily_coverage for select to authenticated
  using (
    private.is_company_member(meta_daily_coverage.company_id)
    and exists (
      select 1 from public.integration_connections c
       where c.id = meta_daily_coverage.connection_id
         and c.company_id = meta_daily_coverage.company_id
         and c.status in ('active', 'needs_reauth'))
  );

grant select on public.meta_daily_coverage to authenticated;

-- ---------------------------------------------------------------------------
-- Helpers de escritura (corren como dueño, llamados solo desde worker_api)
-- ---------------------------------------------------------------------------

-- Guardas comunes de publicar y fallar, con la empresa y la conexión ya bloqueadas. Devuelve
-- el run bloqueado. El estado active y el lease se miran después, porque un reintento
-- idéntico de algo ya confirmado se reconoce aunque el run haya terminado.
create function private.meta_locked_run(
  p_connection public.integration_connections,
  p_run_id     uuid,
  p_token      text,
  p_generation integer
)
returns public.meta_sync_runs
language plpgsql
set search_path = ''
as $$
declare
  v_run public.meta_sync_runs;
begin
  select r.* into v_run
    from public.meta_sync_runs r
   where r.id = p_run_id
     and r.connection_id = p_connection.id
     and r.company_id = p_connection.company_id
     and r.ownership_token = p_token
   for update;

  if not found then
    raise exception 'praxa: la sincronización venció o fue reemplazada' using errcode = 'PX010';
  end if;

  if p_connection.status not in ('active', 'needs_reauth') then
    raise exception 'praxa: transición de estado no permitida' using errcode = 'PX004';
  end if;

  if p_connection.credential_generation <> p_generation then
    raise exception 'praxa: la credencial cambió; volvé a empezar' using errcode = 'PX006';
  end if;

  if v_run.credential_generation <> p_generation
     or p_connection.current_sync_run_id is distinct from v_run.id then
    raise exception 'praxa: la sincronización venció o fue reemplazada' using errcode = 'PX010';
  end if;

  return v_run;
end;
$$;

-- Guardas de una escritura nueva, con el reloj real después de los bloqueos (CA-59).
create function private.meta_assert_current_run(
  p_connection public.integration_connections,
  p_run        public.meta_sync_runs
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_connection.status <> 'active' then
    raise exception 'praxa: transición de estado no permitida' using errcode = 'PX004';
  end if;
  if p_run.status <> 'running' or p_run.lease_expires_at <= pg_catalog.clock_timestamp() then
    raise exception 'praxa: la sincronización venció o fue reemplazada' using errcode = 'PX010';
  end if;
end;
$$;

-- Crea o reutiliza las referencias opacas, de la raíz hacia abajo. La entrada ya está validada.
create function private.meta_upsert_entities(p_connection public.integration_connections, p_payload jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_level text;
begin
  foreach v_level in array array['account', 'campaign', 'adset', 'ad'] loop
    insert into public.meta_entities as m (company_id, connection_id, level, external_id, parent_ref)
    select p_connection.company_id, p_connection.id, v_level, e->>'external_id',
           (select p.entity_ref from public.meta_entities p
             where p.connection_id = p_connection.id
               and p.level = private.meta_parent_level(v_level)
               and p.external_id = e->>'parent_external_id')
      from pg_catalog.jsonb_array_elements(p_payload->'entities') e
     where e->>'level' = v_level
    on conflict on constraint meta_entities_connection_level_external_key
    do update set parent_ref = excluded.parent_ref
     where m.parent_ref is distinct from excluded.parent_ref;
  end loop;

  -- Un conjunto referido solo por la atribución de un ancestro entra al registro sin padre
  -- conocido; su propia captura lo completa después.
  insert into public.meta_entities (company_id, connection_id, level, external_id)
  select distinct p_connection.company_id, p_connection.id, 'adset', s->>'adset_external_id'
    from pg_catalog.jsonb_array_elements(p_payload->'entities') e
   cross join lateral pg_catalog.jsonb_array_elements(e->'attribution'->'settings') s
  on conflict on constraint meta_entities_connection_level_external_key do nothing;
end;
$$;

-- Forma persistida: referencias internas, orden canónico y ninguna clave libre.
create function private.meta_resolve_attribution(p_connection_id uuid, p_attribution jsonb)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'known', p_attribution->'known',
    'report_time', p_attribution->'report_time',
    'unified', p_attribution->'unified',
    'settings', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'adset_ref', m.entity_ref,
               'windows', (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                                    'event_type', w->>'event_type', 'days', (w->>'days')::integer)
                                  order by w->>'event_type' collate "C", (w->>'days')::integer)
                             from pg_catalog.jsonb_array_elements(s->'windows') w))
             order by m.entity_ref)
        from pg_catalog.jsonb_array_elements(p_attribution->'settings') s
        join public.meta_entities m
          on m.connection_id = p_connection_id and m.level = 'adset'
         and m.external_id = s->>'adset_external_id'), '[]'::jsonb))
$$;

-- Snapshot, metadata, días y acciones. La entrada ya pasó por meta_assert_payload.
create function private.meta_write_snapshot(
  p_connection      public.integration_connections,
  p_run             public.meta_sync_runs,
  p_snapshot_id     uuid,
  p_level           text,
  p_fetched_at      timestamptz,
  p_pages           integer,
  p_validated_pages integer,
  p_duration_ms     integer,
  p_result          text,
  p_failure_reason  text,
  p_error_class     text,
  p_request         jsonb,
  p_payload         jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform private.meta_upsert_entities(p_connection, p_payload);

  insert into public.meta_insight_snapshots
    (id, company_id, connection_id, sync_run_id, level, fetched_at, window_from, window_to,
     currency, timezone, pages, validated_pages, complete, result, failure_reason, error_class,
     parameters, duration_ms, request_payload)
  values
    (p_snapshot_id, p_connection.company_id, p_connection.id, p_run.id, p_level, p_fetched_at,
     p_run.window_from, p_run.window_to, p_connection.currency, p_connection.timezone, p_pages,
     p_validated_pages, p_result = 'complete', p_result, p_failure_reason, p_error_class,
     private.meta_snapshot_parameters(p_level, p_run.window_from, p_run.window_to),
     p_duration_ms, p_request);

  insert into public.meta_snapshot_entities
    (snapshot_id, entity_ref, company_id, connection_id, name, effective_status, objective,
     parent_ref, metadata_fetched_at, attribution)
  select p_snapshot_id, m.entity_ref, p_connection.company_id, p_connection.id,
         e->>'name', e->>'effective_status', e->>'objective', m.parent_ref,
         (e->>'metadata_fetched_at')::timestamptz,
         private.meta_resolve_attribution(p_connection.id, e->'attribution')
    from pg_catalog.jsonb_array_elements(p_payload->'entities') e
    join public.meta_entities m
      on m.connection_id = p_connection.id and m.level = e->>'level'
     and m.external_id = e->>'external_id';

  insert into public.meta_snapshot_days
    (snapshot_id, entity_ref, date, company_id, connection_id, spend, impressions, reach, clicks,
     inline_link_clicks, ctr, cpc, cpm, frequency)
  select p_snapshot_id, m.entity_ref, (d->>'date')::date, p_connection.company_id, p_connection.id,
         (d->>'spend')::numeric, (d->>'impressions')::bigint, (d->>'reach')::bigint,
         (d->>'clicks')::bigint, (d->>'inline_link_clicks')::bigint, (d->>'ctr')::numeric,
         (d->>'cpc')::numeric, (d->>'cpm')::numeric, (d->>'frequency')::numeric
    from pg_catalog.jsonb_array_elements(p_payload->'days') d
    join public.meta_entities m
      on m.connection_id = p_connection.id and m.level = p_level
     and m.external_id = d->>'external_id';

  insert into public.meta_snapshot_actions
    (snapshot_id, entity_ref, date, action_type, variant, company_id, connection_id, count, value)
  select p_snapshot_id, m.entity_ref, (d->>'date')::date, a->>'action_type', a->>'variant',
         p_connection.company_id, p_connection.id, (a->>'count')::numeric, (a->>'value')::numeric
    from pg_catalog.jsonb_array_elements(p_payload->'days') d
    join public.meta_entities m
      on m.connection_id = p_connection.id and m.level = p_level
     and m.external_id = d->>'external_id'
   cross join lateral pg_catalog.jsonb_array_elements(d->'actions') a;
end;
$$;

-- Sustitución completa de la cobertura del nivel para TODOS los días del rango (CA-43).
-- captured_before_day_end se calcula acá y no cambia al consultar (CA-43b). El fin del día no
-- suma 24 horas a un instante: es la medianoche local del día siguiente.
create function private.meta_publish_coverage(
  p_connection  public.integration_connections,
  p_run         public.meta_sync_runs,
  p_snapshot_id uuid,
  p_level       text,
  p_fetched_at  timestamptz
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_entities jsonb;
begin
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'entity_ref', se.entity_ref,
           'level', m.level,
           'parent_ref', se.parent_ref,
           'name', se.name,
           'effective_status', se.effective_status,
           'objective', se.objective,
           'metadata_fetched_at', private.meta_iso(se.metadata_fetched_at),
           'attribution', se.attribution)
         order by private.meta_level_rank(m.level), se.entity_ref), '[]'::jsonb)
    into v_entities
    from public.meta_snapshot_entities se
    join public.meta_entities m on m.entity_ref = se.entity_ref
   where se.snapshot_id = p_snapshot_id;

  insert into public.meta_daily_coverage as c
    (connection_id, level, date, company_id, snapshot_id, fetched_at, captured_before_day_end,
     currency, timezone, entities, rows)
  select p_connection.id, p_level, p_run.window_from + i, p_connection.company_id, p_snapshot_id,
         p_fetched_at,
         p_fetched_at < ((p_run.window_from + i + 1)::timestamp at time zone p_connection.timezone),
         p_connection.currency, p_connection.timezone, v_entities,
         coalesce((
           select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                    'entity_ref', d.entity_ref,
                    'spend', d.spend::text,
                    'impressions', d.impressions::text,
                    'reach', d.reach::text,
                    'clicks', d.clicks::text,
                    'inline_link_clicks', d.inline_link_clicks::text,
                    'ctr', d.ctr::text,
                    'cpc', d.cpc::text,
                    'cpm', d.cpm::text,
                    'frequency', d.frequency::text,
                    'attribution', se.attribution,
                    'actions', coalesce((
                      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                               'action_type', a.action_type, 'variant', a.variant,
                               'count', a.count::text, 'value', a.value::text)
                             order by a.action_type collate "C", a.variant collate "C")
                        from public.meta_snapshot_actions a
                       where a.snapshot_id = d.snapshot_id and a.entity_ref = d.entity_ref
                         and a.date = d.date), '[]'::jsonb))
                  order by d.entity_ref)
             from public.meta_snapshot_days d
             join public.meta_snapshot_entities se
               on se.snapshot_id = d.snapshot_id and se.entity_ref = d.entity_ref
            where d.snapshot_id = p_snapshot_id and d.date = p_run.window_from + i), '[]'::jsonb)
    from pg_catalog.generate_series(0, p_run.window_to - p_run.window_from) as i
  on conflict on constraint meta_daily_coverage_pkey do update
     set company_id = excluded.company_id,
         snapshot_id = excluded.snapshot_id,
         fetched_at = excluded.fetched_at,
         captured_before_day_end = excluded.captured_before_day_end,
         currency = excluded.currency,
         timezone = excluded.timezone,
         entities = excluded.entities,
         rows = excluded.rows;
end;
$$;

-- Registra el resultado del nivel y deriva el estado del run: sigue running mientras falte
-- un nivel. Detener marca los pendientes not_attempted, sin snapshot inventado.
create function private.meta_apply_level_result(
  p_connection_id  uuid,
  p_run_id         uuid,
  p_level          text,
  p_status         text,
  p_reason         text,
  p_fetched_at     timestamptz,
  p_stop_remaining boolean
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_summary  jsonb;
  v_levels   jsonb;
  v_now      timestamptz := pg_catalog.clock_timestamp();
  v_name     text;
  v_status   text := 'running';
  v_pending  integer;
  v_complete integer;
begin
  select c.meta_sync_summary into v_summary
    from public.integration_connections c where c.id = p_connection_id;

  v_levels := v_summary->'levels' || pg_catalog.jsonb_build_object(p_level, pg_catalog.jsonb_build_object(
    'status', p_status, 'reason', p_reason, 'fetched_at', private.meta_iso(p_fetched_at),
    'finished_at', private.meta_iso(v_now)));

  if p_stop_remaining then
    foreach v_name in array array['account', 'campaign', 'adset', 'ad'] loop
      if v_levels->v_name->>'status' = 'pending' then
        v_levels := v_levels || pg_catalog.jsonb_build_object(v_name, pg_catalog.jsonb_build_object(
          'status', 'not_attempted', 'reason', null, 'fetched_at', null, 'finished_at', null));
      end if;
    end loop;
  end if;

  select pg_catalog.count(*) filter (where value->>'status' = 'pending'),
         pg_catalog.count(*) filter (where value->>'status' = 'complete')
    into v_pending, v_complete
    from pg_catalog.jsonb_each(v_levels);

  if v_pending = 0 then
    v_status := case when v_complete = 4 then 'completed' when v_complete > 0 then 'partial' else 'failed' end;
    update public.meta_sync_runs r set status = v_status, finished_at = v_now where r.id = p_run_id;
    v_summary := v_summary || pg_catalog.jsonb_build_object('status', v_status, 'finished_at', private.meta_iso(v_now));
  end if;

  update public.integration_connections c
     set meta_sync_summary = v_summary || pg_catalog.jsonb_build_object('levels', v_levels)
   where c.id = p_connection_id;

  return v_status;
end;
$$;

-- ---------------------------------------------------------------------------
-- Funciones de worker_api
-- ---------------------------------------------------------------------------

create function worker_api.start_sync_run(
  p_actor_user_id       uuid,
  p_company_id          uuid,
  p_connection_id       uuid,
  p_expected_generation integer,
  p_run_id              uuid,
  p_ownership_token     text,
  p_window_from         date,
  p_window_to           date,
  p_limits              jsonb
)
returns table (
  run_id                uuid,
  credential_generation integer,
  started_at            timestamptz,
  lease_expires_at      timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection public.integration_connections;
  v_run        public.meta_sync_runs;
  v_now        timestamptz;
  v_lease      timestamptz;
  v_constraint text;
begin
  perform private.assert_worker_actor(p_actor_user_id, p_company_id);

  if p_connection_id is null or p_expected_generation is null or p_run_id is null
     or p_ownership_token is null or p_window_from is null or p_window_to is null or p_limits is null
     or p_ownership_token !~ '^[0-9a-f]{64}$'
     or p_window_to < p_window_from
     or not private.valid_meta_sync_limits(p_limits)
     or p_window_to - p_window_from + 1 > (p_limits->>'maxWindowDays')::integer then
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

  if v_connection.status <> 'active' then
    raise exception 'praxa: transición de estado no permitida' using errcode = 'PX004';
  end if;

  if v_connection.credential_generation <> p_expected_generation then
    raise exception 'praxa: la credencial cambió; volvé a empezar' using errcode = 'PX006';
  end if;

  -- Un id ya usado solo es un reintento si coincide en todo; el reintento no renueva el lease.
  select r.* into v_run from public.meta_sync_runs r where r.id = p_run_id for update;

  if found then
    if v_run.company_id <> p_company_id or v_run.connection_id <> p_connection_id
       or v_run.ownership_token <> p_ownership_token
       or v_run.credential_generation <> p_expected_generation
       or v_run.window_from <> p_window_from or v_run.window_to <> p_window_to
       or v_run.limits <> p_limits then
      raise exception 'praxa: operación no autorizada' using errcode = 'PX001';
    end if;
    if v_run.status <> 'running' or v_run.lease_expires_at <= pg_catalog.clock_timestamp()
       or v_connection.current_sync_run_id is distinct from v_run.id then
      raise exception 'praxa: la sincronización venció o fue reemplazada' using errcode = 'PX010';
    end if;
    return query select v_run.id, v_run.credential_generation, v_run.started_at, v_run.lease_expires_at;
    return;
  end if;

  select r.* into v_run
    from public.meta_sync_runs r
   where r.connection_id = p_connection_id
     and r.status = 'running'
   for update;

  if found then
    if v_run.lease_expires_at > pg_catalog.clock_timestamp()
       and v_run.credential_generation = v_connection.credential_generation then
      raise exception 'praxa: ya hay una sincronización en curso' using errcode = 'PX009';
    end if;
    -- Vencido o de otra generación: ya no podrá escribir, porque la posesión exige ambas.
    update public.meta_sync_runs r
       set status = 'superseded', finished_at = pg_catalog.clock_timestamp()
     where r.id = v_run.id;
  end if;

  -- Milisegundos: el cliente lee este instante como Date de JavaScript y lo reenvía como
  -- límite inferior de la captura. Con microsegundos se perdería en el redondeo y SQL
  -- rechazaría esa captura como anterior al inicio.
  v_now := pg_catalog.date_trunc('milliseconds', pg_catalog.clock_timestamp());
  v_lease := v_now + pg_catalog.make_interval(secs => (p_limits->>'leaseSeconds')::double precision);

  insert into public.meta_sync_runs
    (id, company_id, connection_id, credential_generation, ownership_token, started_at,
     lease_expires_at, window_from, window_to, status, limits)
  values
    (p_run_id, p_company_id, p_connection_id, p_expected_generation, p_ownership_token, v_now,
     v_lease, p_window_from, p_window_to, 'running', p_limits);

  update public.integration_connections c
     set current_sync_run_id = p_run_id,
         meta_sync_summary = pg_catalog.jsonb_build_object(
           'version', 1,
           'credential_generation', p_expected_generation,
           'window_from', p_window_from::text,
           'window_to', p_window_to::text,
           'max_window_days', (p_limits->>'maxWindowDays')::integer,
           'started_at', private.meta_iso(v_now),
           'lease_expires_at', private.meta_iso(v_lease),
           'finished_at', null,
           'status', 'running',
           'levels', pg_catalog.jsonb_build_object(
             'account', '{"status":"pending","reason":null,"fetched_at":null,"finished_at":null}'::jsonb,
             'campaign', '{"status":"pending","reason":null,"fetched_at":null,"finished_at":null}'::jsonb,
             'adset', '{"status":"pending","reason":null,"fetched_at":null,"finished_at":null}'::jsonb,
             'ad', '{"status":"pending","reason":null,"fetched_at":null,"finished_at":null}'::jsonb))
   where c.id = p_connection_id;

  return query select p_run_id, p_expected_generation, v_now, v_lease;
exception
  when integrity_constraint_violation then
    get stacked diagnostics v_constraint = constraint_name;
    perform private.raise_worker_integrity_error(v_constraint);
end;
$$;

create function worker_api.publish_snapshot(
  p_actor_user_id       uuid,
  p_company_id          uuid,
  p_connection_id       uuid,
  p_expected_generation integer,
  p_run_id              uuid,
  p_ownership_token     text,
  p_snapshot_id         uuid,
  p_level               text,
  p_fetched_at          timestamptz,
  p_pages               integer,
  p_duration_ms         integer,
  p_payload             jsonb
)
returns table (
  snapshot_id uuid,
  level       text,
  complete    boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection public.integration_connections;
  v_run        public.meta_sync_runs;
  v_existing   public.meta_insight_snapshots;
  v_request    jsonb;
  v_status     text;
  v_constraint text;
begin
  perform private.assert_worker_actor(p_actor_user_id, p_company_id);

  if p_connection_id is null or p_expected_generation is null or p_run_id is null
     or p_ownership_token is null or p_snapshot_id is null or p_level is null or p_fetched_at is null
     or p_pages is null or p_duration_ms is null or p_payload is null
     or p_ownership_token !~ '^[0-9a-f]{64}$'
     or p_level not in ('account', 'campaign', 'adset', 'ad')
     or p_pages < 1 or p_duration_ms < 0
     or not private.meta_has_exact_keys(p_payload, array['entities', 'days']) then
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

  v_request := pg_catalog.jsonb_build_object(
    'kind', 'publish', 'level', p_level, 'fetched_at', private.meta_iso(p_fetched_at),
    'pages', p_pages, 'duration_ms', p_duration_ms, 'payload', p_payload);

  select s.* into v_existing
    from public.meta_insight_snapshots s
   where s.id = p_snapshot_id or (s.sync_run_id = p_run_id and s.level = p_level)
   limit 1;

  if found then
    if v_existing.id <> p_snapshot_id or v_existing.sync_run_id <> p_run_id
       or v_existing.level <> p_level or v_existing.request_payload <> v_request then
      raise exception 'praxa: argumento inválido' using errcode = '22023';
    end if;
    return query select v_existing.id, v_existing.level, v_existing.complete;
    return;
  end if;

  perform private.meta_assert_current_run(v_connection, v_run);

  if p_fetched_at < v_run.started_at or p_fetched_at > pg_catalog.clock_timestamp()
     or p_pages > (v_run.limits->>'maxPagesPerLevel')::integer + (v_run.limits->>'maxMetadataPages')::integer then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;

  perform private.meta_assert_payload(p_payload, p_level, v_connection.external_account_id,
    v_run.window_from, v_run.window_to, v_run.started_at, v_run.limits);

  perform private.meta_write_snapshot(v_connection, v_run, p_snapshot_id, p_level, p_fetched_at,
    p_pages, p_pages, p_duration_ms, 'complete', null, null, v_request, p_payload);

  perform private.meta_publish_coverage(v_connection, v_run, p_snapshot_id, p_level, p_fetched_at);

  v_status := private.meta_apply_level_result(p_connection_id, p_run_id, p_level, 'complete', 'complete',
    p_fetched_at, false);

  -- Solo un run completed limpia el error; partial o failed conservan el último (CA-39).
  if v_status = 'completed' then
    update public.integration_connections c
       set last_error_class = null, last_error_message = null
     where c.id = p_connection_id and c.status = 'active';
  end if;

  return query select p_snapshot_id, p_level, true;
exception
  when integrity_constraint_violation then
    get stacked diagnostics v_constraint = constraint_name;
    perform private.raise_worker_integrity_error(v_constraint);
end;
$$;

create function worker_api.fail_sync_run(
  p_actor_user_id       uuid,
  p_company_id          uuid,
  p_connection_id       uuid,
  p_expected_generation integer,
  p_run_id              uuid,
  p_ownership_token     text,
  p_snapshot_id         uuid,
  p_level               text,
  p_fetched_at          timestamptz,
  p_pages               integer,
  p_duration_ms         integer,
  p_payload             jsonb,
  p_validated_pages     integer,
  p_failure_reason      text,
  p_error_class         text,
  p_error_message       text,
  p_stop_remaining      boolean
)
returns table (
  run_id          uuid,
  level           text,
  status          text,
  snapshot_result text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection public.integration_connections;
  v_run        public.meta_sync_runs;
  v_existing   public.meta_insight_snapshots;
  v_request    jsonb;
  v_result     text;
  v_status     text;
  v_stored_at  timestamptz;
  v_constraint text;
  v_reauth     boolean;
begin
  perform private.assert_worker_actor(p_actor_user_id, p_company_id);

  v_reauth := p_error_class in ('authentication', 'user_action', 'permission', 'asset_access');

  if p_connection_id is null or p_expected_generation is null or p_run_id is null
     or p_ownership_token is null or p_snapshot_id is null or p_level is null or p_fetched_at is null
     or p_pages is null or p_duration_ms is null or p_payload is null or p_validated_pages is null
     or p_failure_reason is null or p_error_class is null or p_error_message is null
     or p_stop_remaining is null
     or p_ownership_token !~ '^[0-9a-f]{64}$'
     or p_level not in ('account', 'campaign', 'adset', 'ad')
     or p_pages < 0 or p_duration_ms < 0 or p_validated_pages < 0 or p_validated_pages > p_pages
     or p_failure_reason not in ('page_limit', 'duration_limit', 'invalid_response', 'meta_error', 'own_error')
     or p_error_class not in ('authentication', 'user_action', 'permission', 'asset_access',
                              'rate_limit', 'temporary', 'own_error', 'transport', 'unknown')
     or char_length(p_error_message) not between 1 and 500
     -- Toda razón local usa la clase own_error; solo meta_error conserva la clase de Graph.
     or (p_failure_reason <> 'meta_error' and p_error_class <> 'own_error')
     -- Estas causas no dejan seguir con los demás niveles.
     or (not p_stop_remaining
         and (p_failure_reason = 'duration_limit' or p_error_class = 'rate_limit' or v_reauth))
     or not private.meta_has_exact_keys(p_payload, array['entities', 'days'])
     or pg_catalog.jsonb_typeof(p_payload->'entities') <> 'array'
     or pg_catalog.jsonb_typeof(p_payload->'days') <> 'array'
     -- Sin progreso válido no hay nada que conservar.
     or (p_validated_pages = 0
         and (pg_catalog.jsonb_array_length(p_payload->'entities') > 0
              or pg_catalog.jsonb_array_length(p_payload->'days') > 0)) then
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

  v_request := pg_catalog.jsonb_build_object(
    'kind', 'fail', 'level', p_level, 'fetched_at', private.meta_iso(p_fetched_at),
    'pages', p_pages, 'duration_ms', p_duration_ms, 'payload', p_payload,
    'validated_pages', p_validated_pages, 'failure_reason', p_failure_reason,
    'error_class', p_error_class, 'error_message', p_error_message,
    'stop_remaining', p_stop_remaining);

  select s.* into v_existing
    from public.meta_insight_snapshots s
   where s.id = p_snapshot_id or (s.sync_run_id = p_run_id and s.level = p_level)
   limit 1;

  if found then
    if v_existing.id <> p_snapshot_id or v_existing.sync_run_id <> p_run_id
       or v_existing.level <> p_level or v_existing.request_payload <> v_request then
      raise exception 'praxa: argumento inválido' using errcode = '22023';
    end if;
    return query select v_run.id, v_existing.level, v_run.status, v_existing.result;
    return;
  end if;

  perform private.meta_assert_current_run(v_connection, v_run);

  -- Excepción de reloj, solo acá: con un instante futuro se registra la hora de la base. Es
  -- la hora del fallo, no frescura de datos, y nunca publica cobertura. `request_payload`
  -- conserva el instante pedido para reconocer un reintento idéntico.
  v_stored_at := least(p_fetched_at, pg_catalog.clock_timestamp());

  if p_fetched_at < v_run.started_at
     or p_pages > (v_run.limits->>'maxPagesPerLevel')::integer + (v_run.limits->>'maxMetadataPages')::integer then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;

  perform private.meta_assert_payload(p_payload, p_level, v_connection.external_account_id,
    v_run.window_from, v_run.window_to, v_run.started_at, v_run.limits);

  v_result := case when p_validated_pages > 0 then 'incomplete' else 'failed' end;

  perform private.meta_write_snapshot(v_connection, v_run, p_snapshot_id, p_level, v_stored_at,
    p_pages, p_validated_pages, p_duration_ms, v_result, p_failure_reason, p_error_class, v_request, p_payload);

  if v_reauth then
    perform worker_api.mark_needs_reauth(p_actor_user_id, p_company_id, p_connection_id,
      p_expected_generation, p_error_class, p_error_message);
  else
    update public.integration_connections c
       set last_error_class = p_error_class, last_error_message = p_error_message
     where c.id = p_connection_id;
  end if;

  v_status := private.meta_apply_level_result(p_connection_id, p_run_id, p_level, v_result, p_failure_reason,
    v_stored_at, p_stop_remaining);

  return query select p_run_id, p_level, v_status, v_result;
exception
  when integrity_constraint_violation then
    get stacked diagnostics v_constraint = constraint_name;
    perform private.raise_worker_integrity_error(v_constraint);
end;
$$;

-- Registro general de lifecycle (H-E1-22), nunca una salida alternativa de sync. Sobre
-- needs_reauth rechaza sin escribir: esa conexión conserva su error de autorización.
create function worker_api.record_connection_error(
  p_actor_user_id       uuid,
  p_company_id          uuid,
  p_connection_id       uuid,
  p_expected_generation integer,
  p_error_class         text,
  p_error_message       text
)
returns table (
  connection_id         uuid,
  status                text,
  credential_generation integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection public.integration_connections;
  v_constraint text;
begin
  perform private.assert_worker_actor(p_actor_user_id, p_company_id);

  if p_connection_id is null or p_expected_generation is null
     or p_error_class is null or p_error_message is null
     or p_error_class not in ('rate_limit', 'temporary', 'transport', 'own_error', 'unknown')
     or char_length(p_error_message) not between 1 and 500 then
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

  if v_connection.status <> 'active' then
    raise exception 'praxa: transición de estado no permitida' using errcode = 'PX004';
  end if;

  if v_connection.credential_generation <> p_expected_generation then
    raise exception 'praxa: la credencial cambió; volvé a empezar' using errcode = 'PX006';
  end if;

  update public.integration_connections c
     set last_error_class = p_error_class, last_error_message = p_error_message
   where c.id = p_connection_id;

  return query select v_connection.id, v_connection.status::text, v_connection.credential_generation;
exception
  when integrity_constraint_violation then
    get stacked diagnostics v_constraint = constraint_name;
    perform private.raise_worker_integrity_error(v_constraint);
end;
$$;

-- Reemplazo con la misma firma y resultado. Anula el puntero antes de borrar para vencer el
-- ciclo con meta_sync_runs. Conserva la repetibilidad: inexistente o ajena devuelven false.
create or replace function worker_api.purge_connection(
  p_actor_user_id uuid,
  p_company_id    uuid,
  p_connection_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_connection public.integration_connections;
  v_constraint text;
begin
  perform private.assert_worker_actor(p_actor_user_id, p_company_id);

  if p_connection_id is null then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;

  perform private.lock_company(p_company_id);

  select c.* into v_connection
    from public.integration_connections c
   where c.id = p_connection_id
     and c.company_id = p_company_id
   for update;

  if not found then
    return false;
  end if;

  if v_connection.status <> 'disconnected' then
    raise exception 'praxa: transición de estado no permitida' using errcode = 'PX004';
  end if;

  update public.integration_connections c
     set current_sync_run_id = null
   where c.id = p_connection_id;

  delete from public.meta_daily_coverage x where x.connection_id = p_connection_id;
  delete from public.meta_snapshot_actions x where x.connection_id = p_connection_id;
  delete from public.meta_snapshot_days x where x.connection_id = p_connection_id;
  delete from public.meta_snapshot_entities x where x.connection_id = p_connection_id;
  delete from public.meta_insight_snapshots x where x.connection_id = p_connection_id;
  delete from public.meta_sync_runs x where x.connection_id = p_connection_id;
  delete from public.meta_entities x where x.connection_id = p_connection_id;

  delete from private.integration_credentials k
   where k.connection_id = p_connection_id
     and k.company_id = p_company_id;

  delete from public.integration_connections c
   where c.id = p_connection_id
     and c.company_id = p_company_id;

  return true;
exception
  when integrity_constraint_violation then
    get stacked diagnostics v_constraint = constraint_name;
    perform private.raise_worker_integrity_error(v_constraint);
    return false;
end;
$$;

-- ---------------------------------------------------------------------------
-- Lecturas públicas: INVOKER, bajo la RLS de la conexión y la cobertura
-- ---------------------------------------------------------------------------

-- `no_observado`: sin cobertura nivel/día. `sin_fila_reportada`: cubierto y la entidad sin fila;
-- un día cubierto y vacío se representa con una fila sin entidad, sin inventar ninguna.
-- `con_datos`: fila presente, aun con métricas null. Devuelve tasas diarias informadas por
-- Meta: los totales por período son de M25a.1.
create function public.get_meta_daily_coverage(
  p_connection_id uuid,
  p_level         text,
  p_from          date,
  p_to            date,
  p_entity_ref    uuid default null
)
returns table (
  day                     date,
  level                   text,
  entity_ref              uuid,
  parent_ref              uuid,
  name                    text,
  effective_status        text,
  objective               text,
  metadata_fetched_at     text,
  presence                text,
  spend                   text,
  impressions             text,
  reach                   text,
  clicks                  text,
  inline_link_clicks      text,
  ctr                     text,
  cpc                     text,
  cpm                     text,
  frequency               text,
  actions                 jsonb,
  attribution             jsonb,
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
declare
  v_timezone text;
  v_summary  jsonb;
begin
  if p_connection_id is null or p_level is null or p_from is null or p_to is null
     or p_level not in ('account', 'campaign', 'adset', 'ad')
     or p_to < p_from then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;

  select c.timezone, c.meta_sync_summary into v_timezone, v_summary
    from public.integration_connections c
   where c.id = p_connection_id
     and c.status in ('active', 'needs_reauth');

  if not found then
    return;
  end if;

  if p_to - p_from + 1 > coalesce((v_summary->>'max_window_days')::integer, 28) then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;

  -- Una referencia que ninguna captura visible conoce no recibe calendario.
  if p_entity_ref is not null and not exists (
       select 1
         from public.meta_daily_coverage cov
        cross join lateral pg_catalog.jsonb_array_elements(cov.entities) e
        where cov.connection_id = p_connection_id
          and e->>'entity_ref' = p_entity_ref::text
     ) then
    return;
  end if;

  return query
  with days as (
    select p_from + i as d from pg_catalog.generate_series(0, p_to - p_from) as i
  ),
  cov as (
    select c.* from public.meta_daily_coverage c
     where c.connection_id = p_connection_id
       and c.level = p_level
       and c.date between p_from and p_to
  ),
  targets as (
    select days.d, p_entity_ref as ref from days where p_entity_ref is not null
    union all
    select days.d, (e->>'entity_ref')::uuid
      from days
      join cov on cov.date = days.d
     cross join lateral pg_catalog.jsonb_array_elements(cov.entities) e
     where p_entity_ref is null and e->>'level' = p_level
    union all
    select days.d, null::uuid
      from days
      left join cov on cov.date = days.d
     where p_entity_ref is null
       and not exists (
         select 1 from pg_catalog.jsonb_array_elements(coalesce(cov.entities, '[]'::jsonb)) e
          where e->>'level' = p_level)
  )
  select t.d,
         p_level,
         t.ref,
         (m.value->>'parent_ref')::uuid,
         m.value->>'name',
         m.value->>'effective_status',
         m.value->>'objective',
         m.value->>'metadata_fetched_at',
         case when cov.date is null then 'no_observado'
              when f.value is not null then 'con_datos'
              else 'sin_fila_reportada' end,
         f.value->>'spend',
         f.value->>'impressions',
         f.value->>'reach',
         f.value->>'clicks',
         f.value->>'inline_link_clicks',
         f.value->>'ctr',
         f.value->>'cpc',
         f.value->>'cpm',
         f.value->>'frequency',
         f.value->'actions',
         coalesce(f.value->'attribution', m.value->'attribution'),
         cov.currency,
         cov.timezone,
         cov.snapshot_id,
         cov.fetched_at,
         cov.captured_before_day_end,
         case when pg_catalog.statement_timestamp() < ((t.d + 1)::timestamp at time zone v_timezone)
              then 'abierto' else 'cerrado' end
    from targets t
    left join cov on cov.date = t.d
    left join lateral (
      select e as value from pg_catalog.jsonb_array_elements(cov.entities) e
       where (e->>'entity_ref')::uuid = t.ref limit 1
    ) m on true
    left join lateral (
      select r as value from pg_catalog.jsonb_array_elements(cov.rows) r
       where (r->>'entity_ref')::uuid = t.ref limit 1
    ) f on true
   order by t.d, t.ref nulls first;
end;
$$;

-- Referencias y metadata de las capturas visibles, con su instante. No es un estado histórico.
create function public.list_meta_entities(
  p_connection_id uuid,
  p_level         text
)
returns table (
  entity_ref          uuid,
  level               text,
  parent_ref          uuid,
  name                text,
  effective_status    text,
  objective           text,
  metadata_fetched_at text,
  captured_at         timestamptz
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if p_connection_id is null or p_level is null
     or p_level not in ('account', 'campaign', 'adset', 'ad') then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;

  if not exists (
       select 1 from public.integration_connections c
        where c.id = p_connection_id and c.status in ('active', 'needs_reauth')
     ) then
    return;
  end if;

  return query
  select distinct on (e->>'entity_ref')
         (e->>'entity_ref')::uuid,
         p_level,
         (e->>'parent_ref')::uuid,
         e->>'name',
         e->>'effective_status',
         e->>'objective',
         e->>'metadata_fetched_at',
         cov.fetched_at
    from public.meta_daily_coverage cov
   cross join lateral pg_catalog.jsonb_array_elements(cov.entities) e
   where cov.connection_id = p_connection_id
     and e->>'level' = p_level
   order by e->>'entity_ref', cov.fetched_at desc;
end;
$$;

-- Estado del último intento desde la proyección segura. Derivar al consultar no escribe ni
-- renueva el lease: los pendientes de un run vencido o cambiado se muestran sin resultado
-- confirmado, porque una llamada pudo quedar en vuelo.
create function public.get_meta_sync_status(p_connection_id uuid)
returns table (
  has_attempt        boolean,
  summary            jsonb,
  effective_status   text,
  connection_changed boolean
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_status     public.connection_status;
  v_generation integer;
  v_summary    jsonb;
  v_changed    boolean;
begin
  if p_connection_id is null then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;

  select c.status, c.credential_generation, c.meta_sync_summary
    into v_status, v_generation, v_summary
    from public.integration_connections c
   where c.id = p_connection_id
     and c.status in ('active', 'needs_reauth');

  if not found then
    return;
  end if;

  if v_summary is null then
    return query select false, null::jsonb, 'never'::text, false;
    return;
  end if;

  v_changed := (v_summary->>'credential_generation')::integer <> v_generation
    or (v_summary->>'status' = 'running' and v_status <> 'active');

  return query select true, v_summary,
    case when v_summary->>'status' = 'running' and v_changed then 'connection_changed'
         when v_summary->>'status' = 'running'
              and (v_summary->>'lease_expires_at')::timestamptz <= pg_catalog.statement_timestamp()
           then 'expired'
         else v_summary->>'status' end,
    v_changed;
end;
$$;

-- ---------------------------------------------------------------------------
-- Privilegios de funciones
-- ---------------------------------------------------------------------------

revoke all on function private.raise_worker_integrity_error(text) from public, anon, authenticated, service_role;
revoke all on function private.meta_iso(timestamptz) from public, anon, authenticated, service_role;
revoke all on function private.meta_has_exact_keys(jsonb, text[]) from public, anon, authenticated, service_role;
revoke all on function private.meta_level_rank(text) from public, anon, authenticated, service_role;
revoke all on function private.meta_parent_level(text) from public, anon, authenticated, service_role;
revoke all on function private.meta_valid_decimal(jsonb) from public, anon, authenticated, service_role;
revoke all on function private.meta_valid_count(jsonb) from public, anon, authenticated, service_role;
revoke all on function private.meta_valid_int(jsonb, integer) from public, anon, authenticated, service_role;
revoke all on function private.meta_try_date(text) from public, anon, authenticated, service_role;
revoke all on function private.meta_try_timestamptz(text) from public, anon, authenticated, service_role;
revoke all on function private.valid_meta_sync_limits(jsonb) from public, anon, authenticated, service_role;
revoke all on function private.meta_valid_summary_instant(jsonb, boolean) from public, anon, authenticated, service_role;
revoke all on function private.valid_meta_level_summary(jsonb) from public, anon, authenticated, service_role;
revoke all on function private.valid_meta_sync_summary(jsonb) from public, anon, authenticated, service_role;
revoke all on function private.meta_valid_attribution(jsonb) from public, anon, authenticated, service_role;
revoke all on function private.meta_valid_entity(jsonb, text, timestamptz) from public, anon, authenticated, service_role;
revoke all on function private.meta_valid_action(jsonb) from public, anon, authenticated, service_role;
revoke all on function private.meta_valid_day(jsonb, text, date, date) from public, anon, authenticated, service_role;
revoke all on function private.meta_assert_payload(jsonb, text, text, date, date, timestamptz, jsonb) from public, anon, authenticated, service_role;
revoke all on function private.meta_snapshot_parameters(text, date, date) from public, anon, authenticated, service_role;
revoke all on function private.valid_meta_coverage_projection(jsonb, jsonb) from public, anon, authenticated, service_role;
revoke all on function private.meta_entities_check_parent() from public, anon, authenticated, service_role;
revoke all on function private.meta_check_within_snapshot() from public, anon, authenticated, service_role;
revoke all on function private.meta_forbid_snapshot_update() from public, anon, authenticated, service_role;
revoke all on function private.meta_locked_run(public.integration_connections, uuid, text, integer) from public, anon, authenticated, service_role;
revoke all on function private.meta_assert_current_run(public.integration_connections, public.meta_sync_runs) from public, anon, authenticated, service_role;
revoke all on function private.meta_upsert_entities(public.integration_connections, jsonb) from public, anon, authenticated, service_role;
revoke all on function private.meta_resolve_attribution(uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function private.meta_write_snapshot(public.integration_connections, public.meta_sync_runs, uuid, text, timestamptz, integer, integer, integer, text, text, text, jsonb, jsonb) from public, anon, authenticated, service_role;
revoke all on function private.meta_publish_coverage(public.integration_connections, public.meta_sync_runs, uuid, text, timestamptz) from public, anon, authenticated, service_role;
revoke all on function private.meta_apply_level_result(uuid, uuid, text, text, text, timestamptz, boolean) from public, anon, authenticated, service_role;

revoke all on function worker_api.start_sync_run(uuid, uuid, uuid, integer, uuid, text, date, date, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function worker_api.start_sync_run(uuid, uuid, uuid, integer, uuid, text, date, date, jsonb)
  to praxa_integrations;

revoke all on function worker_api.publish_snapshot(uuid, uuid, uuid, integer, uuid, text, uuid, text, timestamptz, integer, integer, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function worker_api.publish_snapshot(uuid, uuid, uuid, integer, uuid, text, uuid, text, timestamptz, integer, integer, jsonb)
  to praxa_integrations;

revoke all on function worker_api.fail_sync_run(uuid, uuid, uuid, integer, uuid, text, uuid, text, timestamptz, integer, integer, jsonb, integer, text, text, text, boolean)
  from public, anon, authenticated, service_role;
grant execute on function worker_api.fail_sync_run(uuid, uuid, uuid, integer, uuid, text, uuid, text, timestamptz, integer, integer, jsonb, integer, text, text, text, boolean)
  to praxa_integrations;

revoke all on function worker_api.record_connection_error(uuid, uuid, uuid, integer, text, text)
  from public, anon, authenticated, service_role;
grant execute on function worker_api.record_connection_error(uuid, uuid, uuid, integer, text, text)
  to praxa_integrations;

revoke all on function public.get_meta_daily_coverage(uuid, text, date, date, uuid)
  from public, anon, authenticated, service_role, praxa_integrations;
grant execute on function public.get_meta_daily_coverage(uuid, text, date, date, uuid) to authenticated;

revoke all on function public.list_meta_entities(uuid, text)
  from public, anon, authenticated, service_role, praxa_integrations;
grant execute on function public.list_meta_entities(uuid, text) to authenticated;

revoke all on function public.get_meta_sync_status(uuid)
  from public, anon, authenticated, service_role, praxa_integrations;
grant execute on function public.get_meta_sync_status(uuid) to authenticated;
