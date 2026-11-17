-- PRAXA 0028: H-E1-262. Repara solo once mensajes de error mal codificados
-- en tres funciones de 0027, sin alterar firmas, SQLSTATE, condiciones ni grants.
-- CREATE OR REPLACE conserva los privilegios existentes; 0027 queda intacta.

create or replace function worker_api.create_pending_connection(
  p_actor_user_id      uuid,
  p_company_id         uuid,
  p_connection_id      uuid,
  p_provider           public.integration_provider,
  p_client_business_id text,
  p_ciphertext         text,
  p_iv                 text,
  p_auth_tag           text,
  p_key_version        integer,
  p_token_type         text,
  p_issued_for_app_id  text,
  p_granted_scopes     text[],
  p_token_expires_at   timestamptz
)
returns table (
  connection_id         uuid,
  status                text,
  pending_expires_at    timestamptz,
  credential_generation integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_constraint text;
begin
  perform private.assert_worker_actor(p_actor_user_id, p_company_id);

  if p_connection_id is null or p_provider is null or p_ciphertext is null
     or p_iv is null or p_auth_tag is null or p_key_version is null
     or p_token_type is null or p_issued_for_app_id is null or p_granted_scopes is null
     or p_ciphertext !~ '^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$'
     or p_ciphertext = '' or p_iv !~ '^[A-Za-z0-9+/]{16}$'
     or p_auth_tag !~ '^[A-Za-z0-9+/]{22}==$'
     or p_key_version <= 0
     or (p_provider::text = 'ga4' and p_issued_for_app_id !~ '^[1-9][0-9]*$')
     or (p_provider::text <> 'ga4' and p_issued_for_app_id !~ '^[A-Za-z0-9_-]{1,64}$')
     or not private.valid_provider_scopes(p_provider::text, p_granted_scopes)
     or (p_provider::text = 'meta'
         and (p_client_business_id is null
              or p_client_business_id !~ '^[A-Za-z0-9_-]{1,64}$'
              or p_token_type <> 'system_user'))
     or (p_provider::text = 'tiendanube'
         and (p_client_business_id is not null
              or p_token_type <> 'store_app_token'
              or p_token_expires_at is not null))
     or (p_provider::text = 'ga4'
         and (p_client_business_id is not null
              or p_token_type <> 'google_refresh_token'
              or p_token_expires_at is not null)) then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;

  perform private.lock_company(p_company_id);

  -- Reintento exacto de la misma llamada (D-M06.1a-M06.2a-11), como en 0012.
  return query
  select c.id, c.status::text, c.pending_expires_at, c.credential_generation
  from public.integration_connections c
  join private.integration_credentials k
    on k.connection_id = c.id
   and k.company_id = c.company_id
  where c.id = p_connection_id
    and c.company_id = p_company_id
    and c.provider = p_provider
    and c.status = 'pending_selection'
    and c.pending_expires_at > now()
    and c.client_business_id is not distinct from p_client_business_id
    and k.ciphertext = p_ciphertext
    and k.iv = p_iv
    and k.auth_tag = p_auth_tag
    and k.key_version = p_key_version
    and k.token_type = p_token_type
    and k.issued_for_app_id = p_issued_for_app_id
    and k.granted_scopes = p_granted_scopes
    and k.expires_at is not distinct from p_token_expires_at;

  if found then
    return;
  end if;

  if exists (
    select 1
    from public.integration_connections c
    where c.company_id = p_company_id
      and c.provider = p_provider
      and c.status in ('pending_selection', 'active', 'needs_reauth')
  ) then
    raise exception 'praxa: la empresa ya tiene una conexión' using errcode = 'PX003';
  end if;

  if exists (select 1 from public.integration_connections c where c.id = p_connection_id) then
    raise exception 'praxa: operación no autorizada' using errcode = 'PX001';
  end if;

  insert into public.integration_connections
    (id, company_id, provider, status, client_business_id, pending_expires_at)
  values
    (p_connection_id, p_company_id, p_provider, 'pending_selection', p_client_business_id,
     now() + interval '30 minutes');

  insert into private.integration_credentials
    (connection_id, company_id, provider, ciphertext, iv, auth_tag, key_version, token_type,
     issued_for_app_id, granted_scopes, expires_at)
  values
    (p_connection_id, p_company_id, p_provider, p_ciphertext, p_iv, p_auth_tag, p_key_version,
     p_token_type, p_issued_for_app_id, p_granted_scopes, p_token_expires_at);

  return query
  select c.id, c.status::text, c.pending_expires_at, c.credential_generation
  from public.integration_connections c
  where c.id = p_connection_id;
exception
  when integrity_constraint_violation then
    get stacked diagnostics v_constraint = constraint_name;
    perform private.raise_worker_integrity_error(v_constraint);
end;
$$;

create or replace function worker_api.replace_credential(
  p_actor_user_id     uuid,
  p_company_id        uuid,
  p_connection_id     uuid,
  p_attempt_id        uuid,
  p_ciphertext        text,
  p_iv                text,
  p_auth_tag          text,
  p_key_version       integer,
  p_token_type        text,
  p_issued_for_app_id text,
  p_granted_scopes    text[],
  p_token_expires_at  timestamptz
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
  v_attempt    public.oauth_attempts;
  v_constraint text;
begin
  perform private.assert_worker_actor(p_actor_user_id, p_company_id);

  if p_connection_id is null or p_attempt_id is null or p_ciphertext is null
     or p_iv is null or p_auth_tag is null or p_key_version is null
     or p_token_type is null or p_issued_for_app_id is null or p_granted_scopes is null
     or p_ciphertext !~ '^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$'
     or p_ciphertext = '' or p_iv !~ '^[A-Za-z0-9+/]{16}$'
     or p_auth_tag !~ '^[A-Za-z0-9+/]{22}==$'
     or p_key_version <= 0 or p_token_type not in ('system_user', 'store_app_token', 'google_refresh_token')
     or p_issued_for_app_id !~ '^[A-Za-z0-9_-]{1,64}$' then
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

  if not private.valid_provider_scopes(v_connection.provider::text, p_granted_scopes)
     or (v_connection.provider::text = 'meta' and p_token_type <> 'system_user')
     or (v_connection.provider::text = 'tiendanube'
         and (p_token_type <> 'store_app_token' or p_token_expires_at is not null))
     or (v_connection.provider::text = 'ga4'
         and (p_token_type <> 'google_refresh_token' or p_token_expires_at is not null
              or p_issued_for_app_id !~ '^[1-9][0-9]*$')) then
    raise exception 'praxa: argumento inválido' using errcode = '22023';
  end if;

  select a.* into v_attempt
  from public.oauth_attempts a
  where a.id = p_attempt_id
    and a.company_id = p_company_id
    and a.actor_user_id = p_actor_user_id
    and a.provider = v_connection.provider
    and a.purpose = 'reauth'
    and a.consumed_at is not null
    and a.consumed_at >= now() - interval '10 minutes'
    and a.expected_connection_id = p_connection_id;

  if not found then
    raise exception 'praxa: la autorización no es válida o ya se usó' using errcode = 'PX002';
  end if;

  if v_connection.credential_generation = v_attempt.expected_generation + 1
     and v_connection.status = 'active'
     and exists (
       select 1 from private.integration_credentials k
       where k.connection_id = p_connection_id
         and k.company_id = p_company_id
         and k.provider = v_connection.provider
         and k.ciphertext = p_ciphertext
         and k.iv = p_iv
         and k.auth_tag = p_auth_tag
         and k.key_version = p_key_version
         and k.token_type = p_token_type
         and k.issued_for_app_id = p_issued_for_app_id
         and k.granted_scopes = p_granted_scopes
         and k.expires_at is not distinct from p_token_expires_at
     ) then
    return query
    select v_connection.id, v_connection.status::text, v_connection.credential_generation;
    return;
  end if;

  if v_connection.status not in ('active', 'needs_reauth') then
    raise exception 'praxa: transición de estado no permitida' using errcode = 'PX004';
  end if;

  if v_connection.credential_generation <> v_attempt.expected_generation then
    raise exception 'praxa: la credencial cambió; volvé a empezar' using errcode = 'PX006';
  end if;

  insert into private.integration_credentials as k
    (connection_id, company_id, provider, ciphertext, iv, auth_tag, key_version, token_type,
     issued_for_app_id, granted_scopes, expires_at)
  values
    (p_connection_id, p_company_id, v_connection.provider, p_ciphertext, p_iv, p_auth_tag,
     p_key_version, p_token_type, p_issued_for_app_id, p_granted_scopes, p_token_expires_at)
  on conflict on constraint integration_credentials_pkey do update
     set ciphertext = excluded.ciphertext,
         iv = excluded.iv,
         auth_tag = excluded.auth_tag,
         key_version = excluded.key_version,
         token_type = excluded.token_type,
         issued_for_app_id = excluded.issued_for_app_id,
         granted_scopes = excluded.granted_scopes,
         expires_at = excluded.expires_at;

  if v_connection.provider::text = 'ga4' then
    update private.ga4_sync_runs r
       set status = 'superseded', finished_at = now()
     where r.connection_id = p_connection_id and r.status = 'running';
    update public.ga4_sync_status s
       set last_step_status = 'superseded', last_step_at = now(), updated_at = now()
     where s.connection_id = p_connection_id;
  end if;

  update public.integration_connections c
     set credential_generation = c.credential_generation + 1,
         status = 'active',
         last_error_class = null,
         last_error_message = null
   where c.id = p_connection_id;

  return query
  select c.id, c.status::text, c.credential_generation
  from public.integration_connections c
  where c.id = p_connection_id;
exception
  when integrity_constraint_violation then
    get stacked diagnostics v_constraint = constraint_name;
    perform private.raise_worker_integrity_error(v_constraint);
end;
$$;

create or replace function worker_api.purge_connection(
  p_actor_user_id uuid, p_company_id uuid, p_connection_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
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
  delete from public.tn_cohort_cells x where x.connection_id = p_connection_id;
  delete from public.tn_product_units_daily x where x.connection_id = p_connection_id;
  delete from public.tn_sales_daily x where x.connection_id = p_connection_id;
  delete from public.tn_sync_status x where x.connection_id = p_connection_id;
  delete from private.tn_order_lines x where x.connection_id = p_connection_id;
  delete from private.tn_orders x where x.connection_id = p_connection_id;
  delete from private.tn_customers x where x.connection_id = p_connection_id;
  delete from private.tn_product_variants x where x.connection_id = p_connection_id;
  delete from private.tn_products x where x.connection_id = p_connection_id;
  delete from private.tn_redaction_suppressions x where x.connection_id = p_connection_id;
  delete from private.tn_sync_runs x where x.connection_id = p_connection_id;
  delete from public.ga4_traffic_daily x where x.connection_id = p_connection_id;
  delete from public.ga4_source_daily x where x.connection_id = p_connection_id;
  delete from public.ga4_funnel_daily x where x.connection_id = p_connection_id;
  delete from public.ga4_item_daily x where x.connection_id = p_connection_id;
  delete from public.ga4_campaign_daily x where x.connection_id = p_connection_id;
  delete from public.ga4_visitor_cohorts x where x.connection_id = p_connection_id;
  delete from public.ga4_report_quality x where x.connection_id = p_connection_id;
  delete from public.ga4_sync_status x where x.connection_id = p_connection_id;
  delete from private.ga4_item_rows x where x.connection_id = p_connection_id;
  delete from private.ga4_campaign_rows x where x.connection_id = p_connection_id;
  delete from private.ga4_item_keys x where x.connection_id = p_connection_id;
  delete from private.ga4_sync_runs x where x.connection_id = p_connection_id;
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
