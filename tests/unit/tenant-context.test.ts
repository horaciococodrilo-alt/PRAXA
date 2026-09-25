import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * K01 `TenantContext` (M05.1.1, CA-00 y CA-00b).
 *
 * Se simula solo el cliente de Supabase: `session.ts` y `company/service.ts` corren de
 * verdad, así que la prueba cubre el camino completo desde `getClaims()` hasta la fila de
 * membresía. Los identificadores son sintéticos.
 */

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

const USER_ID = '1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d';
const COMPANY_ID = '0f1e2d3c-4b5a-4968-8778-6a5b4c3d2e1f';
const OTHER_COMPANY_ID = '9e8d7c6b-5a49-4382-9716-a5b4c3d2e1f0';

type Row = Record<string, unknown> | null;

type Claims = Record<string, unknown> | null;

type FakeState = {
  claims: Claims;
  /** Si se define, cada llamada a `getClaims()` consume el siguiente valor. */
  claimsQueue: Claims[] | null;
  company: Row;
  membership: Row;
  membershipError: { message: string } | null;
  /** Simula una consulta que no aplica sus filtros, para ejercitar el chequeo defensivo. */
  ignoreMembershipFilters: boolean;
  membershipFilters: Array<[string, unknown]>;
};

const state: FakeState = {
  claims: null,
  claimsQueue: null,
  company: null,
  membership: null,
  membershipError: null,
  ignoreMembershipFilters: false,
  membershipFilters: [],
};

function queryBuilder(table: string) {
  const filters: Array<[string, unknown]> = [];
  const builder = {
    select: () => builder,
    limit: () => builder,
    eq: (column: string, value: unknown) => {
      filters.push([column, value]);
      if (table === 'company_members') state.membershipFilters.push([column, value]);
      return builder;
    },
    maybeSingle: async () => {
      if (table === 'companies') return { data: state.company, error: null };
      if (table !== 'company_members') return { data: null, error: null };
      if (state.membershipError) return { data: null, error: state.membershipError };

      // Como PostgREST: la fila solo vuelve si cumple todos los filtros pedidos.
      const row = state.membership;
      const matches =
        row !== null &&
        (state.ignoreMembershipFilters || filters.every(([column, value]) => row[column] === value));
      return { data: matches ? row : null, error: null };
    },
  };
  return builder;
}

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      getClaims: async () => {
        const claims = state.claimsQueue ? (state.claimsQueue.shift() ?? null) : state.claims;
        return { data: claims ? { claims } : null, error: null };
      },
    },
    from: (table: string) => queryBuilder(table),
  }),
}));

const { requireTenantContext, tenantContextSchema, TenantContextError } = await import(
  '@/modules/tenant/context'
);
const { UnauthorizedError } = await import('@/modules/identity/session');
const { NoCompanyError } = await import('@/modules/company/service');

beforeEach(() => {
  state.claims = { sub: USER_ID, email: 'duenio@example.test' };
  state.company = {
    id: COMPANY_ID,
    name: 'Empresa de prueba',
    owner_id: USER_ID,
    created_at: '2026-09-01T10:00:00.000Z',
    updated_at: '2026-09-01T10:00:00.000Z',
  };
  state.claimsQueue = null;
  state.membership = { company_id: COMPANY_ID, user_id: USER_ID, role: 'owner' };
  state.membershipError = null;
  state.ignoreMembershipFilters = false;
  state.membershipFilters = [];
});

describe('requireTenantContext', () => {
  it('construye el contexto cuando usuario, membresía y empresa coinciden', async () => {
    const ctx = await requireTenantContext();

    expect(ctx).toEqual({
      user_id: USER_ID,
      company_id: COMPANY_ID,
      role: 'owner',
      request_id: expect.any(String),
    });
    expect(tenantContextSchema.safeParse(ctx).success).toBe(true);
    expect(Object.isFrozen(ctx)).toBe(true);
    // La membresía se busca por la empresa resuelta y el usuario verificado.
    expect(state.membershipFilters).toEqual(
      expect.arrayContaining([
        ['company_id', COMPANY_ID],
        ['user_id', USER_ID],
      ]),
    );
  });

  it('genera un request_id nuevo en cada construcción', async () => {
    const a = await requireTenantContext();
    const b = await requireTenantContext();
    expect(a.request_id).not.toBe(b.request_id);
  });

  it('rechaza cuando falta el claim sub', async () => {
    state.claims = { email: 'duenio@example.test' };
    await expect(requireTenantContext()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('rechaza cuando no hay claims', async () => {
    state.claims = null;
    await expect(requireTenantContext()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('ignora una empresa enviada por el cliente', async () => {
    expect(requireTenantContext.length).toBe(0);

    // Una llamada con un tenant manipulado no cambia la empresa resuelta.
    const forged = requireTenantContext as unknown as (input: unknown) => ReturnType<
      typeof requireTenantContext
    >;
    const ctx = await forged({ company_id: OTHER_COMPANY_ID, role: 'owner' });
    expect(ctx.company_id).toBe(COMPANY_ID);
    // El valor manipulado tampoco se usa para buscar la membresía.
    expect(state.membershipFilters).not.toContainEqual(['company_id', OTHER_COMPANY_ID]);
    expect(state.membershipFilters).toContainEqual(['company_id', COMPANY_ID]);
  });

  it('rechaza una membresía que apunta a otra empresa', async () => {
    state.membership = { company_id: OTHER_COMPANY_ID, user_id: USER_ID, role: 'owner' };
    await expect(requireTenantContext()).rejects.toBeInstanceOf(TenantContextError);
  });

  it('rechaza una fila inconsistente aunque la consulta no aplique sus filtros', async () => {
    state.ignoreMembershipFilters = true;
    state.membership = { company_id: OTHER_COMPANY_ID, user_id: USER_ID, role: 'owner' };
    await expect(requireTenantContext()).rejects.toBeInstanceOf(TenantContextError);

    state.membership = {
      company_id: COMPANY_ID,
      user_id: '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e',
      role: 'owner',
    };
    await expect(requireTenantContext()).rejects.toBeInstanceOf(TenantContextError);
  });

  it('rechaza si la identidad cambia entre las dos lecturas de claims', async () => {
    state.claimsQueue = [{ sub: USER_ID }, { sub: '3c4d5e6f-7a8b-4c9d-8e0f-2a3b4c5d6e7f' }];
    await expect(requireTenantContext()).rejects.toBeInstanceOf(TenantContextError);
  });

  it('rechaza con un error tipado y sin detalle cuando falla la lectura de membresía', async () => {
    state.membershipError = { message: 'detalle interno de la base' };
    const error = await requireTenantContext().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TenantContextError);
    expect((error as Error).message).not.toContain('detalle interno');
  });

  it('rechaza una membresía de otro usuario', async () => {
    state.membership = {
      company_id: COMPANY_ID,
      user_id: '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e',
      role: 'owner',
    };
    await expect(requireTenantContext()).rejects.toBeInstanceOf(TenantContextError);
  });

  it('rechaza cuando el usuario no tiene empresa', async () => {
    state.company = null;
    await expect(requireTenantContext()).rejects.toBeInstanceOf(NoCompanyError);
  });

  it('rechaza cuando no existe la fila de membresía', async () => {
    state.membership = null;
    await expect(requireTenantContext()).rejects.toBeInstanceOf(TenantContextError);
  });

  it('rechaza un rol distinto de owner', async () => {
    state.membership = { company_id: COMPANY_ID, user_id: USER_ID, role: 'admin' };
    await expect(requireTenantContext()).rejects.toBeInstanceOf(TenantContextError);
  });
});

describe('tenantContextSchema', () => {
  const valid = {
    user_id: USER_ID,
    company_id: COMPANY_ID,
    role: 'owner',
    request_id: '7c6b5a49-3827-4165-a4b3-c2d1e0f9a8b7',
  };

  it('acepta un contexto completo y lo devuelve con sus cuatro campos', () => {
    // Un schema vacío también daría `success: true` (descarta las claves desconocidas):
    // por eso se compara la salida, no solo el éxito del parseo.
    expect(tenantContextSchema.parse(valid)).toEqual(valid);
  });

  it('rechaza un campo extra', () => {
    expect(tenantContextSchema.safeParse({ ...valid, is_admin: true }).success).toBe(false);
  });

  it('rechaza un rol inválido', () => {
    expect(tenantContextSchema.safeParse({ ...valid, role: 'admin' }).success).toBe(false);
  });

  it.each(['user_id', 'company_id', 'role', 'request_id'])('rechaza si falta %s', (field) => {
    const partial: Record<string, unknown> = { ...valid };
    delete partial[field];
    expect(tenantContextSchema.safeParse(partial).success).toBe(false);
  });

  it('rechaza identificadores que no son UUID', () => {
    expect(tenantContextSchema.safeParse({ ...valid, company_id: 'mi-empresa' }).success).toBe(
      false,
    );
  });
});
