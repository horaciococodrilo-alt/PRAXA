-- PRAXA 0008 — Excepción administrativa para la activación
--
-- La 0007 exige que la transición borrador → activo pase por activate_context_draft().
-- Eso cierra la vía directa para los usuarios, que es lo que se buscaba, pero también
-- bloquea la restauración de datos y la siembra administrativa, que no pueden llamar a
-- esa RPC porque no hay sesión de usuario (auth.uid() es nulo y la RPC lo exige).
--
-- Se aplica la MISMA condición doble que ya rige la excepción de borrado, documentada en
-- docs/SECURITY.md: rol administrativo Y ningún usuario final detrás de la operación.
-- Dentro de una función SECURITY DEFINER `current_user` pasa a ser su dueño, pero el
-- claim del JWT sobrevive: si hay sesión de usuario, la excepción no aplica y no hay vía
-- indirecta.
--
-- Lo que la excepción NO relaja: la coherencia del contexto se sigue validando abajo,
-- para todos los roles. Un administrador puede elegir el camino, no saltarse la regla.

create or replace function private.enforce_context_version_immutability()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_next     integer;
  v_is_admin boolean;
begin
  -- Operación administrativa fuera de banda: rol administrativo Y sin usuario final.
  v_is_admin := current_user in ('service_role', 'supabase_admin', 'postgres')
                and (select auth.uid()) is null;

  if tg_op = 'DELETE' then
    if v_is_admin then
      return old;
    end if;

    if old.status <> 'draft' then
      raise exception 'praxa: solo se puede eliminar una versión de contexto en borrador'
        using errcode = '42501';
    end if;
    return old;
  end if;

  if new.id is distinct from old.id
     or new.company_id is distinct from old.company_id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'praxa: identidad y procedencia de la versión son inmutables'
      using errcode = '42501';
  end if;

  if old.status = 'draft' then
    if new.status not in ('draft', 'active') then
      raise exception 'praxa: transición de estado inválida desde borrador'
        using errcode = '42501';
    end if;

    if new.status = 'active' then
      -- Los usuarios finales solo pueden activar por la RPC, que es la que toma el
      -- cerrojo y serializa la activación contra las ediciones en curso.
      if not v_is_admin
         and coalesce(nullif(current_setting('praxa.activating_version', true), ''), '')
             is distinct from old.id::text then
        raise exception 'praxa: la activación solo puede hacerse con public.activate_context_draft()'
          using errcode = '42501';
      end if;

      select coalesce(max(v.version), 0) + 1
        into v_next
      from public.company_context_versions v
      where v.company_id = old.company_id
        and v.version is not null;

      new.version       := v_next;
      new.activated_at  := now();
      new.superseded_at := null;

      -- Sin excepciones: también para el camino administrativo.
      perform private.assert_context_coherent(old.id, new.has_defined_objective);
    end if;

    return new;
  end if;

  if old.status = 'active' then
    if new.status <> 'superseded' then
      raise exception 'praxa: una versión activa es inmutable; clonala a un borrador para editarla'
        using errcode = '42501';
    end if;

    if (new.version, new.context_schema_version, new.has_defined_objective,
        new.problems, new.constraints, new.additional_context, new.activated_at)
       is distinct from
       (old.version, old.context_schema_version, old.has_defined_objective,
        old.problems, old.constraints, old.additional_context, old.activated_at) then
      raise exception 'praxa: al reemplazar una versión activa solo puede cambiar su estado'
        using errcode = '42501';
    end if;

    return new;
  end if;

  raise exception 'praxa: una versión reemplazada es inmutable'
    using errcode = '42501';
end;
$$;
