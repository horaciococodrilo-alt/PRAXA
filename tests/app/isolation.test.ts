import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  anonClient,
  blockedReason,
  cleanupRun,
  createConfirmedUser,
  pendingCleanupCount,
  remoteProjectReachable,
  RUN_ID,
  type TestUser,
} from './helpers';

const blocked = blockedReason();
const reachable = blocked ? false : await remoteProjectReachable();
const canRun = !blocked && reachable;
const skipReason =
  blocked ??
  'El proyecto remoto de Supabase no respondió. Revisá SUPABASE_TEST_URL y la conexión.';

describe.skipIf(!canRun)('aislamiento entre empresas (proyecto remoto)', () => {
  let alice: TestUser;
  let bob: TestUser;
  let aliceCompanyId: string;
  let bobCompanyId: string;

  beforeAll(async () => {
    alice = await createConfirmedUser('alice');
    bob = await createConfirmedUser('bob');

    const { data: aliceCompany, error: aliceError } = await alice.client
      .rpc('create_company_for_current_user', { p_name: `Empresa de Alice ${RUN_ID}` })
      .single<{ id: string }>();
    expect(aliceError).toBeNull();
    aliceCompanyId = aliceCompany!.id;

    const { data: bobCompany, error: bobError } = await bob.client
      .rpc('create_company_for_current_user', { p_name: `Empresa de Bob ${RUN_ID}` })
      .single<{ id: string }>();
    expect(bobError).toBeNull();
    bobCompanyId = bobCompany!.id;
  });

  afterAll(async () => {
    await cleanupRun();
    expect(pendingCleanupCount()).toBe(0);
  });

  it('cada usuario ve solo su propia empresa', async () => {
    const { data } = await alice.client.from('companies').select('id, name');

    expect(data).toHaveLength(1);
    expect(data![0].id).toBe(aliceCompanyId);
  });

  it('pedir explícitamente la empresa ajena no devuelve nada', async () => {
    const { data } = await alice.client.from('companies').select('id').eq('id', bobCompanyId);

    expect(data).toEqual([]);
  });

  it('no se puede modificar la empresa ajena', async () => {
    const { data } = await alice.client
      .from('companies')
      .update({ name: 'Tomada por Alice' })
      .eq('id', bobCompanyId)
      .select();

    // Denegación silenciosa: cero filas alcanzadas, sin excepción.
    expect(data).toEqual([]);

    // Y el dato sigue intacto para su dueño.
    const { data: asBob } = await bob.client.from('companies').select('name').single();
    expect(asBob!.name).toBe(`Empresa de Bob ${RUN_ID}`);
  });

  it('no se puede otorgarse membresía en la empresa ajena', async () => {
    const { error } = await alice.client
      .from('company_members')
      .insert({ company_id: bobCompanyId, user_id: alice.id, role: 'owner' });

    expect(error).not.toBeNull();
  });

  it('no se puede transferir la propiedad de la empresa propia', async () => {
    const { error } = await alice.client
      .from('companies')
      .update({ owner_id: bob.id })
      .eq('id', aliceCompanyId)
      .select();

    expect(error).not.toBeNull();
  });

  it('no se puede crear contexto en la empresa ajena', async () => {
    const { error } = await alice.client.from('company_context_versions').insert({
      company_id: bobCompanyId,
      context_schema_version: '1.0.0',
      created_by: alice.id,
    });

    expect(error).not.toBeNull();
  });

  it('no se puede falsear la procedencia de una fila propia', async () => {
    const { error } = await alice.client.from('company_context_versions').insert({
      company_id: aliceCompanyId,
      context_schema_version: '1.0.0',
      created_by: bob.id,
    });

    expect(error).not.toBeNull();
  });

  it('el contexto de una empresa no es visible desde la otra', async () => {
    await alice.client.rpc('start_context_draft', { p_context_schema_version: '1.0.0' });

    const { data: fromBob } = await bob.client
      .from('company_context_versions')
      .select('id')
      .eq('company_id', aliceCompanyId);

    expect(fromBob).toEqual([]);
  });

  it('un visitante sin sesión no lee nada', async () => {
    const { data, error } = await anonClient().from('companies').select('id');

    expect(data ?? []).toEqual([]);
    expect(error).not.toBeNull();
  });
});

describe.skipIf(canRun)('aislamiento entre empresas', () => {
  it('NO EJECUTADA: falta el proyecto remoto de pruebas', () => {
    console.warn(`[praxa] pruebas de aislamiento omitidas: ${skipReason}`);
    expect(canRun).toBe(false);
  });
});
