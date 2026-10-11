import { afterAll, describe, expect, it } from 'vitest';

import {
  blockedReason,
  cleanupRun,
  createConfirmedUser,
  fixtureAvatarPaths,
  pendingCleanupCount,
  remoteProjectReachable,
} from './helpers';

const blocked = blockedReason();
const reachable = blocked ? false : await remoteProjectReachable();

describe.skipIf(Boolean(blocked) || !reachable)('cierre CA-67 con foto (proyecto desechable)', () => {
  afterAll(async () => {
    await cleanupRun();
    expect(pendingCleanupCount()).toBe(0);
  });

  it('borra archivos directos y huérfanos de subcarpetas antes del usuario', async () => {
    const user = await createConfirmedUser('cierre-foto');
    const { error: companyError } = await user.client.rpc('create_company_for_current_user', {
      p_name: 'Empresa de cierre sintética',
    });
    expect(companyError).toBeNull();

    const storage = user.client.storage.from('avatars');
    const file = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c636000020000050001a5f645400000000049454e44ae426082', 'hex');
    for (const path of [`${user.id}/foto.png`, `${user.id}/sin-referencia/otra.png`]) {
      const { error } = await storage.upload(path, file, { contentType: 'image/png' });
      expect(error).toBeNull();
    }
    expect(await fixtureAvatarPaths(user.id)).toHaveLength(2);

    await cleanupRun();
    expect(await fixtureAvatarPaths(user.id)).toEqual([]);
    expect(pendingCleanupCount()).toBe(0);
  });
});
