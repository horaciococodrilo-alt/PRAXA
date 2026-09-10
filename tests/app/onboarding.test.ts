import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  blockedReason,
  cleanupRun,
  createConfirmedUser,
  pendingCleanupCount,
  remoteProjectReachable,
  type TestUser,
} from './helpers';

const blocked = blockedReason();
const reachable = blocked ? false : await remoteProjectReachable();
const canRun = !blocked && reachable;
const skipReason =
  blocked ??
  'El proyecto remoto de Supabase no respondió. Revisá SUPABASE_TEST_URL y la conexión.';

describe.skipIf(!canRun)('alta de empresa idempotente (proyecto remoto)', () => {
  let user: TestUser;

  beforeAll(async () => {
    user = await createConfirmedUser('idempotencia');
  });

  afterAll(async () => {
    await cleanupRun();
    expect(pendingCleanupCount()).toBe(0);
  });

  it('un reintento devuelve la misma empresa y no pisa el nombre', async () => {
    const first = await user.client
      .rpc('create_company_for_current_user', { p_name: 'Nombre Original' })
      .single<{ id: string; name: string }>();

    const second = await user.client
      .rpc('create_company_for_current_user', { p_name: 'Nombre Distinto' })
      .single<{ id: string; name: string }>();

    expect(second.data!.id).toBe(first.data!.id);
    expect(second.data!.name).toBe('Nombre Original');

    const { data } = await user.client.from('companies').select('id');
    expect(data).toHaveLength(1);
  });

  it('llamadas concurrentes no duplican la empresa', async () => {
    const other = await createConfirmedUser('concurrente');

    {
      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          other.client
            .rpc('create_company_for_current_user', { p_name: 'Concurrente' })
            .single<{ id: string }>(),
        ),
      );

      const ids = new Set(
        results.filter((result) => result.data).map((result) => result.data!.id),
      );

      expect(ids.size).toBe(1);

      const { data } = await other.client.from('companies').select('id');
      expect(data).toHaveLength(1);

      const { data: members } = await other.client.from('company_members').select('user_id');
      expect(members).toHaveLength(1);
    }
  });
});

describe.skipIf(!canRun)('persistencia y reanudación del onboarding (proyecto remoto)', () => {
  let user: TestUser;

  beforeAll(async () => {
    user = await createConfirmedUser('onboarding');
    await user.client.rpc('create_company_for_current_user', { p_name: 'Tienda de prueba' });
  });

  afterAll(async () => {
    await cleanupRun();
    expect(pendingCleanupCount()).toBe(0);
  });

  it('guarda un borrador incompleto y lo recupera después', async () => {
    const { data: draft, error } = await user.client
      .rpc('start_context_draft', { p_context_schema_version: '1.0.0' })
      .single<{ id: string; status: string; version: number | null }>();

    expect(error).toBeNull();
    expect(draft!.status).toBe('draft');
    expect(draft!.version).toBeNull();

    // Un borrador a medio completar es un estado legítimo.
    await user.client
      .from('company_context_versions')
      .update({
        has_defined_objective: true,
        problems: ['Muchos carritos abandonados'],
      })
      .eq('id', draft!.id);

    // "Volver más tarde": se relee desde la base, no desde memoria del navegador.
    const { data: resumed } = await user.client
      .rpc('start_context_draft', { p_context_schema_version: '1.0.0' })
      .single<{ id: string; problems: string[] }>();

    expect(resumed!.id).toBe(draft!.id);
    expect(resumed!.problems).toEqual(['Muchos carritos abandonados']);

    const { data: all } = await user.client
      .from('company_context_versions')
      .select('id')
      .eq('status', 'draft');
    expect(all).toHaveLength(1);
  });

  it('no activa un borrador incoherente', async () => {
    const { data: draft } = await user.client
      .rpc('start_context_draft', { p_context_schema_version: '1.0.0' })
      .single<{ id: string }>();

    // has_defined_objective = true pero sin ningún objetivo cargado.
    const { error } = await user.client.rpc('activate_context_draft', {
      p_version_id: draft!.id,
    });

    expect(error).not.toBeNull();
  });

  it('activa un borrador coherente y lo numera', async () => {
    const { data: draft } = await user.client
      .rpc('start_context_draft', { p_context_schema_version: '1.0.0' })
      .single<{ id: string }>();

    await user.client.rpc('replace_draft_objectives', {
      p_version_id: draft!.id,
      p_objectives: [{ kind: 'primary', title: 'Aumentar la conversión', position: 0 }],
    });

    const { data: activated, error } = await user.client
      .rpc('activate_context_draft', { p_version_id: draft!.id })
      .single<{ id: string; status: string; version: number }>();

    expect(error).toBeNull();
    expect(activated!.status).toBe('active');
    expect(activated!.version).toBe(1);
  });

  it('editar clona la versión activa en lugar de modificarla', async () => {
    const { data: clone } = await user.client
      .rpc('start_context_draft', { p_context_schema_version: '1.0.0' })
      .single<{ id: string; status: string; version: number | null }>();

    expect(clone!.status).toBe('draft');
    expect(clone!.version).toBeNull();

    // El clon arrastra los objetivos de la versión vigente.
    const { data: objectives } = await user.client
      .from('company_objectives')
      .select('title')
      .eq('context_version_id', clone!.id);
    expect(objectives).toHaveLength(1);

    // Y la versión vigente sigue intacta e inmutable.
    const { data: active } = await user.client
      .from('company_context_versions')
      .select('id, version')
      .eq('status', 'active')
      .single();
    expect(active!.version).toBe(1);

    const { error } = await user.client
      .from('company_context_versions')
      .update({ additional_context: 'editado en caliente' })
      .eq('id', active!.id)
      .select();
    expect(error).not.toBeNull();
  });

  it('activaciones concurrentes no rompen el invariante de una sola versión vigente', async () => {
    const { data: draft } = await user.client
      .rpc('start_context_draft', { p_context_schema_version: '1.0.0' })
      .single<{ id: string }>();

    // Dos pestañas confirmando a la vez.
    await Promise.allSettled([
      user.client.rpc('activate_context_draft', { p_version_id: draft!.id }),
      user.client.rpc('activate_context_draft', { p_version_id: draft!.id }),
    ]);

    const { data: actives } = await user.client
      .from('company_context_versions')
      .select('id, version')
      .eq('status', 'active');

    expect(actives).toHaveLength(1);
    expect(actives![0].version).toBe(2);

    const { data: drafts } = await user.client
      .from('company_context_versions')
      .select('id')
      .eq('status', 'draft');
    expect(drafts).toEqual([]);
  });

  // Va al final del bloque a propósito: activa una versión más, así que si corriera antes
  // desplazaría la numeración que verifican las pruebas anteriores.
  it('editar y confirmar a la vez deja un contexto activo coherente', async () => {
    // El caso que faltaba: probar dos confirmaciones simultáneas no cubre la carrera
    // entre EDICIÓN y confirmación. Antes de la migración 0006, replace_draft_* no
    // participaba del cerrojo de activate_context_draft, así que una edición podía
    // commitear después de que la activación ya hubiera validado, dejando activo un
    // contenido que nunca se validó.
    const { data: draft } = await user.client
      .rpc('start_context_draft', { p_context_schema_version: '1.0.0' })
      .single<{ id: string }>();

    // Se lanzan a la vez: una reemplaza los objetivos, la otra confirma.
    const outcomes = await Promise.allSettled([
      user.client.rpc('replace_draft_objectives', {
        p_version_id: draft!.id,
        p_objectives: [{ kind: 'primary', title: 'Objetivo cambiado en la carrera', position: 0 }],
      }),
      user.client.rpc('activate_context_draft', { p_version_id: draft!.id }),
    ]);

    // No importa cuál gane; importa que no quede activo un contexto que se contradiga.
    const { data: actives } = await user.client
      .from('company_context_versions')
      .select('id, has_defined_objective')
      .eq('status', 'active');

    expect(actives).toHaveLength(1);

    const active = actives![0];
    const { data: objectives } = await user.client
      .from('company_objectives')
      .select('kind')
      .eq('context_version_id', active.id);

    const total = objectives?.length ?? 0;
    const primaries = objectives?.filter((o) => o.kind === 'primary').length ?? 0;

    if (active.has_defined_objective) {
      expect(total).toBeGreaterThanOrEqual(1);
      expect(primaries).toBe(1);
    } else {
      expect(total).toBe(0);
    }

    // Y alguna de las dos operaciones tuvo que resolverse, no quedar colgada.
    expect(outcomes.some((o) => o.status === 'fulfilled')).toBe(true);
  });
});

describe.skipIf(canRun)('onboarding', () => {
  it('NO EJECUTADA: falta el proyecto remoto de pruebas', () => {
    console.warn(`[praxa] pruebas de onboarding omitidas: ${skipReason}`);
    expect(canRun).toBe(false);
  });
});
