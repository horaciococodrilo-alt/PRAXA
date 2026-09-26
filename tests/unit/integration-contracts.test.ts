import { createHash } from 'node:crypto';

import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  BROWSER_BINDING_COOKIE,
  CONNECTION_STATUSES,
  CONNECTION_TRANSITIONS,
  ConnectionTransitionError,
  OAUTH_ATTEMPT_MAX_TTL_MS,
  OAUTH_STATE_MIN_BYTES,
  OAuthAttemptRejectedError,
  REDACTED_ERROR_MESSAGE_MAX,
  RETURN_PATH_ALLOWLIST,
  assertConnectionTransition,
  buildCredentialAad,
  integrationConnectionDtoSchema,
  integrationConnectionRecordSchema,
  integrationProviderSchema,
  isDeclaredTransition,
  isOAuthAttemptConsumable,
  maskExternalAccountId,
  oauthAttemptSchema,
  oauthStateSchema,
  redactErrorMessage,
  redactedErrorMessageSchema,
  returnPathSchema,
  secretCredentialSchema,
  toConnectionDto,
  type ConnectionStatus,
  type IntegrationConnectionDto,
  type IntegrationConnectionRecord,
  type OAuthAttempt,
  type SecretCredential,
} from '@/modules/integrations/contract';

/**
 * Fixtures sintéticos. Ningún valor es un token, un código OAuth ni un identificador
 * real (CA-12): los hashes salen de textos de prueba, el material cifrado son bytes
 * repetidos y los identificadores de cuenta dicen "sintetica".
 */

const COMPANY_ID = '0f1e2d3c-4b5a-4968-8778-6a5b4c3d2e1f';
const OTHER_COMPANY_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const ACTOR_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const CONNECTION_ID = '4f1a7c2e-1b2c-4d5e-8f90-0a1b2c3d4e5f';
const OTHER_CONNECTION_ID = '5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d';
const ATTEMPT_ID = '6b7c8d9e-0f1a-4b2c-9d3e-4f5a6b7c8d9e';
const EXTERNAL_ACCOUNT_ID = 'act_sintetica_000123';

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');
const b64 = (length: number, fill: number) => Buffer.alloc(length, fill).toString('base64');

const CREATED_AT = '2026-09-25T12:00:00.000Z';
const EXPIRES_AT = '2026-09-25T12:10:00.000Z';

function initialAttempt(): OAuthAttempt {
  return {
    id: ATTEMPT_ID,
    provider: 'meta',
    company_id: COMPANY_ID,
    actor_user_id: ACTOR_ID,
    purpose: 'initial',
    expected_connection_id: null,
    expected_generation: null,
    state_hash: sha256('estado-de-prueba'),
    browser_binding_hash: sha256('nonce-de-prueba'),
    return_path: '/app/integraciones',
    created_at: CREATED_AT,
    expires_at: EXPIRES_AT,
    consumed_at: null,
  };
}

function reauthAttempt(): OAuthAttempt {
  return {
    ...initialAttempt(),
    purpose: 'reauth',
    expected_connection_id: CONNECTION_ID,
    expected_generation: 2,
  };
}

function activeConnection(): Extract<IntegrationConnectionRecord, { status: 'active' }> {
  return {
    id: CONNECTION_ID,
    company_id: COMPANY_ID,
    provider: 'meta',
    status: 'active',
    external_account_id: EXTERNAL_ACCOUNT_ID,
    client_business_id: 'negocio_sintetico_01',
    currency: 'ARS',
    timezone: 'America/Argentina/Buenos_Aires',
    credential_generation: 1,
    pending_expires_at: null,
    purge_requested_at: null,
    current_sync_run_id: null,
    last_error_class: null,
    last_error_message: null,
    created_at: CREATED_AT,
    updated_at: CREATED_AT,
  };
}

function pendingConnection(): IntegrationConnectionRecord {
  return {
    id: CONNECTION_ID,
    company_id: COMPANY_ID,
    provider: 'meta',
    status: 'pending_selection',
    external_account_id: null,
    client_business_id: null,
    currency: null,
    timezone: null,
    credential_generation: 1,
    pending_expires_at: '2026-09-25T12:30:00.000Z',
    purge_requested_at: null,
    current_sync_run_id: null,
    last_error_class: null,
    last_error_message: null,
    created_at: CREATED_AT,
    updated_at: CREATED_AT,
  };
}

function without(value: object, field: string): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...value };
  delete copy[field];
  return copy;
}

function credential(): SecretCredential {
  return {
    connection_id: CONNECTION_ID,
    company_id: COMPANY_ID,
    ciphertext: b64(48, 7),
    iv: b64(12, 1),
    auth_tag: b64(16, 2),
    key_version: 1,
    token_type: 'system_user',
    issued_for_app_id: 'app_sintetica_01',
    granted_scopes: ['ads_read'],
    expires_at: null,
  };
}

// ---------------------------------------------------------------------------
// Primitivas
// ---------------------------------------------------------------------------

describe('primitivas', () => {
  it('el proveedor es un enum cerrado con único valor meta (CA-05)', () => {
    expect(integrationProviderSchema.options).toEqual(['meta']);
    expect(integrationProviderSchema.safeParse('google').success).toBe(false);
    expect(integrationProviderSchema.safeParse('Meta').success).toBe(false);
  });

  it('los estados son exactamente los cuatro declarados (CA-07)', () => {
    expect([...CONNECTION_STATUSES]).toEqual([
      'pending_selection',
      'active',
      'needs_reauth',
      'disconnected',
    ]);
  });

  it('solo las transiciones declaradas están permitidas (CA-07)', () => {
    const declared = new Set([
      'pending_selection>active',
      'pending_selection>disconnected',
      'active>needs_reauth',
      'needs_reauth>active',
      'active>disconnected',
      'needs_reauth>disconnected',
    ]);
    for (const from of CONNECTION_STATUSES) {
      for (const to of CONNECTION_STATUSES) {
        const expected = declared.has(`${from}>${to}`);
        expect(isDeclaredTransition(from, to), `${from} → ${to}`).toBe(expected);
        if (expected) {
          expect(() => assertConnectionTransition(from, to)).not.toThrow();
        } else {
          expect(() => assertConnectionTransition(from, to)).toThrow(
            ConnectionTransitionError,
          );
        }
      }
    }
  });

  it('disconnected no tiene salida: la purga elimina la fila (CA-07, CA-38)', () => {
    expect(CONNECTION_TRANSITIONS.disconnected).toEqual([]);
  });

  it('rechaza un estado desconocido en la transición', () => {
    expect(isDeclaredTransition('active' as ConnectionStatus, 'paused' as ConnectionStatus)).toBe(
      false,
    );
  });

  it('la allowlist de retorno acepta solo rutas declaradas (CA-04)', () => {
    for (const path of RETURN_PATH_ALLOWLIST) {
      expect(returnPathSchema.safeParse(path).success).toBe(true);
    }
    for (const bad of [
      'https://evil.example/app/integraciones',
      '//evil.example/app/integraciones',
      '/\\evil.example',
      '/app/integraciones?next=https://evil.example',
      '/app/integraciones#x',
      '/app/integraciones/../reportes',
      '/app/reportes',
      'app/integraciones',
      '',
    ]) {
      expect(returnPathSchema.safeParse(bad).success, bad).toBe(false);
    }
  });

  it('redacta la consulta y el fragmento de una URL en un error (CA-09)', () => {
    const raw =
      'Falló GET https://graph.example.test/v1/me/adaccounts?access_token=abc123&fields=id#frag';
    const redacted = redactErrorMessage(raw);
    expect(redacted).not.toContain('abc123');
    expect(redacted).not.toContain('fields=id');
    expect(redacted).not.toContain('#frag');
    expect(redacted).toContain('https://graph.example.test/v1/me/adaccounts');
  });

  it('enmascara la cuenta cuando va en la ruta de una URL, con o sin consulta (R-01)', () => {
    const withQuery = redactErrorMessage(
      `GET https://graph.example.test/v1/${EXTERNAL_ACCOUNT_ID}/insights?fields=spend falló`,
    );
    expect(withQuery).not.toContain(EXTERNAL_ACCOUNT_ID);
    expect(withQuery).toContain('https://graph.example.test/v1/act_');

    const withoutQuery = redactErrorMessage(
      `GET https://graph.example.test/v1/${EXTERNAL_ACCOUNT_ID}/insights falló`,
    );
    expect(withoutQuery).not.toContain(EXTERNAL_ACCOUNT_ID);

    const plainText = redactErrorMessage(`Cuenta ${EXTERNAL_ACCOUNT_ID} sin acceso.`);
    expect(plainText).not.toContain(EXTERNAL_ACCOUNT_ID);
    expect(redactErrorMessage(plainText)).toBe(plainText);
  });

  it('redacta pares clave=valor sensibles fuera de una URL y credenciales Bearer', () => {
    const redacted = redactErrorMessage(
      'respuesta: code=xyz789 state=qwe456 client_secret=zzz Authorization: Bearer abc.def-ghi',
    );
    for (const secret of ['xyz789', 'qwe456', 'zzz', 'abc.def-ghi']) {
      expect(redacted).not.toContain(secret);
    }
  });

  it('redacta pares clave: valor con dos puntos, no solo con igual (R-02)', () => {
    const redacted = redactErrorMessage('access_token: abc123 y code:xyz789');
    expect(redacted).not.toContain('abc123');
    expect(redacted).not.toContain('xyz789');
    expect(redactErrorMessage(redacted)).toBe(redacted);
  });

  it('redacta credenciales embebidas en una URL', () => {
    const redacted = redactErrorMessage('conexión a https://usuario:clave@db.example.test/x');
    expect(redacted).not.toContain('usuario');
    expect(redacted).not.toContain('clave');
  });

  it('redacta valores sensibles dentro de un cuerpo JSON (CA-09)', () => {
    const redacted = redactErrorMessage(
      '{"error":{"message":"x"},"access_token":"abc123","code" : "xyz\\"789","name":"campaña"}',
    );
    expect(redacted).not.toContain('abc123');
    expect(redacted).not.toContain('xyz');
    expect(redacted).toContain('"name":"campaña"');
    expect(redactErrorMessage(redacted)).toBe(redacted);
  });

  it('trunca sin dejar un marcador a medias y sigue siendo idempotente (CA-09)', () => {
    for (let offset = 0; offset < 30; offset++) {
      const raw = `${'a'.repeat(REDACTED_ERROR_MESSAGE_MAX - 20 + offset)} code=xyz789 fin`;
      const once = redactErrorMessage(raw);
      expect(once.length).toBeLessThanOrEqual(REDACTED_ERROR_MESSAGE_MAX);
      expect(once).not.toContain('xyz789');
      expect(redactErrorMessage(once)).toBe(once);
      expect(redactedErrorMessageSchema.safeParse(once).success).toBe(true);
    }
  });

  it('deja intacto un mensaje sin datos sensibles y es idempotente', () => {
    const clean = 'Límite de solicitudes alcanzado en https://graph.example.test/v1/insights';
    expect(redactErrorMessage(clean)).toBe(clean);
    const once = redactErrorMessage('ver https://x.example.test/a?code=1&state=2 y token=3');
    expect(redactErrorMessage(once)).toBe(once);
  });

  it('el esquema del mensaje de error rechaza un mensaje sin redactar (CA-09)', () => {
    expect(
      redactedErrorMessageSchema.safeParse('https://graph.example.test/v1/me?access_token=abc')
        .success,
    ).toBe(false);
    expect(redactedErrorMessageSchema.safeParse('code=abc').success).toBe(false);
    expect(redactedErrorMessageSchema.safeParse('Permiso ads_read retirado.').success).toBe(true);
    expect(redactedErrorMessageSchema.safeParse('').success).toBe(false);
  });

  it('el esquema del mensaje de error rechaza un identificador de cuenta completo (R-01)', () => {
    expect(
      redactedErrorMessageSchema.safeParse(`Cuenta ${EXTERNAL_ACCOUNT_ID} sin acceso.`).success,
    ).toBe(false);
    expect(
      redactedErrorMessageSchema.safeParse(
        `GET https://graph.example.test/v1/${EXTERNAL_ACCOUNT_ID}/insights?fields=spend`,
      ).success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// K02 OAuthAttempt (M05.1.2)
// ---------------------------------------------------------------------------

describe('K02 OAuthAttempt', () => {
  it('acepta un intento initial y uno reauth completos', () => {
    expect(oauthAttemptSchema.parse(initialAttempt())).toEqual(initialAttempt());
    expect(oauthAttemptSchema.parse(reauthAttempt())).toEqual(reauthAttempt());
  });

  it('rechaza el state en claro (CA-01)', () => {
    const withState = { ...initialAttempt(), state: 'a'.repeat(43) };
    expect(oauthAttemptSchema.safeParse(withState).success).toBe(false);
  });

  it('rechaza un state_hash que no es un SHA-256 en hex (CA-01)', () => {
    for (const bad of ['a'.repeat(43), 'A'.repeat(64), sha256('x').slice(0, 63), '']) {
      expect(
        oauthAttemptSchema.safeParse({ ...initialAttempt(), state_hash: bad }).success,
        bad,
      ).toBe(false);
    }
  });

  it('el state generado tiene 32 bytes o más, en base64url (CA-01)', () => {
    expect(OAUTH_STATE_MIN_BYTES).toBeGreaterThanOrEqual(32);
    expect(oauthStateSchema.safeParse(Buffer.alloc(32, 9).toString('base64url')).success).toBe(
      true,
    );
    expect(oauthStateSchema.safeParse(Buffer.alloc(31, 9).toString('base64url')).success).toBe(
      false,
    );
    expect(oauthStateSchema.safeParse(`${'a'.repeat(42)}+`).success).toBe(false);
  });

  it('rechaza el vencimiento ausente (CA-02)', () => {
    expect(oauthAttemptSchema.safeParse(without(initialAttempt(), 'expires_at')).success).toBe(
      false,
    );
    expect(oauthAttemptSchema.safeParse({ ...initialAttempt(), expires_at: null }).success).toBe(
      false,
    );
  });

  it('rechaza un vencimiento largo o anterior a la creación (CA-02)', () => {
    const tooLong = new Date(Date.parse(CREATED_AT) + OAUTH_ATTEMPT_MAX_TTL_MS + 1).toISOString();
    expect(oauthAttemptSchema.safeParse({ ...initialAttempt(), expires_at: tooLong }).success).toBe(
      false,
    );
    expect(
      oauthAttemptSchema.safeParse({ ...initialAttempt(), expires_at: CREATED_AT }).success,
    ).toBe(false);
  });

  it('un intento vencido o consumido no es consumible (CA-02, CA-03)', () => {
    const attempt = initialAttempt();
    expect(isOAuthAttemptConsumable(attempt, new Date('2026-09-25T12:05:00.000Z'))).toBe(true);
    expect(isOAuthAttemptConsumable(attempt, new Date(EXPIRES_AT))).toBe(false);
    expect(isOAuthAttemptConsumable(attempt, new Date('2026-09-25T13:00:00.000Z'))).toBe(false);
    expect(
      isOAuthAttemptConsumable(
        { ...attempt, consumed_at: '2026-09-25T12:01:00.000Z' },
        new Date('2026-09-25T12:05:00.000Z'),
      ),
    ).toBe(false);
  });

  it('rechaza una URL de retorno externa o fuera de la allowlist (CA-04)', () => {
    for (const bad of ['https://evil.example/app/integraciones', '//evil.example', '/app']) {
      expect(
        oauthAttemptSchema.safeParse({ ...initialAttempt(), return_path: bad }).success,
        bad,
      ).toBe(false);
    }
  });

  it('rechaza un proveedor distinto de meta (CA-05)', () => {
    expect(oauthAttemptSchema.safeParse({ ...initialAttempt(), provider: 'google' }).success).toBe(
      false,
    );
  });

  it('rechaza la vinculación al navegador ausente o inválida (CA-02b)', () => {
    expect(
      oauthAttemptSchema.safeParse(without(initialAttempt(), 'browser_binding_hash')).success,
    ).toBe(false);
    expect(
      oauthAttemptSchema.safeParse({ ...initialAttempt(), browser_binding_hash: null }).success,
    ).toBe(false);
    expect(
      oauthAttemptSchema.safeParse({ ...initialAttempt(), browser_binding_hash: 'nonce' }).success,
    ).toBe(false);
  });

  it('rechaza el intento sin actor o sin empresa (CA-02b)', () => {
    for (const field of ['actor_user_id', 'company_id'] as const) {
      expect(oauthAttemptSchema.safeParse(without(initialAttempt(), field)).success, field).toBe(
        false,
      );
      expect(
        oauthAttemptSchema.safeParse({ ...initialAttempt(), [field]: 'no-es-uuid' }).success,
        field,
      ).toBe(false);
    }
  });

  it('la cookie de vinculación es HttpOnly, Secure y SameSite=Lax (CA-02b)', () => {
    expect(BROWSER_BINDING_COOKIE.httpOnly).toBe(true);
    expect(BROWSER_BINDING_COOKIE.secure).toBe(true);
    expect(BROWSER_BINDING_COOKIE.sameSite).toBe('lax');
    expect(BROWSER_BINDING_COOKIE.path).toBe('/');
    expect(BROWSER_BINDING_COOKIE.name.startsWith('__Host-')).toBe(true);
  });

  it('un intento initial no lleva conexión ni generación esperadas (CA-02c)', () => {
    expect(
      oauthAttemptSchema.safeParse({ ...initialAttempt(), expected_connection_id: CONNECTION_ID })
        .success,
    ).toBe(false);
    expect(
      oauthAttemptSchema.safeParse({ ...initialAttempt(), expected_generation: 1 }).success,
    ).toBe(false);
  });

  it('un intento reauth exige conexión y generación esperadas (CA-02c)', () => {
    expect(
      oauthAttemptSchema.safeParse({ ...reauthAttempt(), expected_connection_id: null }).success,
    ).toBe(false);
    expect(
      oauthAttemptSchema.safeParse({ ...reauthAttempt(), expected_generation: null }).success,
    ).toBe(false);
    expect(
      oauthAttemptSchema.safeParse({ ...reauthAttempt(), expected_generation: -1 }).success,
    ).toBe(false);
  });

  it('el rechazo de un intento es un único error tipado, sin detalles internos (CA-03, CA-29)', () => {
    const error = new OAuthAttemptRejectedError();
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('OAuthAttemptRejectedError');
    expect(error.message).not.toMatch(/state|hash|actor|company|expir|consum|sql|worker/i);
  });

  it('rechaza un propósito desconocido y un campo extra', () => {
    expect(oauthAttemptSchema.safeParse({ ...initialAttempt(), purpose: 'switch' }).success).toBe(
      false,
    );
    expect(oauthAttemptSchema.safeParse({ ...initialAttempt(), code: 'x' }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// K03 IntegrationConnection (M05.1.3)
// ---------------------------------------------------------------------------

describe('K03 IntegrationConnection', () => {
  it('acepta una conexión activa y una pendiente sin metadatos', () => {
    expect(integrationConnectionRecordSchema.parse(activeConnection())).toEqual(
      activeConnection(),
    );
    expect(integrationConnectionRecordSchema.parse(pendingConnection())).toEqual(
      pendingConnection(),
    );
  });

  it('exige moneda, zona y cuenta en active y needs_reauth (CA-08)', () => {
    for (const status of ['active', 'needs_reauth'] as const) {
      const base = {
        ...activeConnection(),
        status,
        ...(status === 'needs_reauth'
          ? { last_error_class: 'authentication', last_error_message: 'Token inválido.' }
          : {}),
      };
      expect(integrationConnectionRecordSchema.safeParse(base).success, status).toBe(true);
      for (const field of ['currency', 'timezone', 'external_account_id'] as const) {
        expect(
          integrationConnectionRecordSchema.safeParse({ ...base, [field]: null }).success,
          `${status} sin ${field}`,
        ).toBe(false);
      }
      expect(
        integrationConnectionRecordSchema.safeParse({
          ...base,
          external_account_id: null,
          currency: null,
          timezone: null,
        }).success,
        `${status} sin ningún metadato`,
      ).toBe(false);
    }
  });

  it('rechaza moneda o zona inválidas fuera de pending_selection (CA-08)', () => {
    for (const currency of ['ars', 'PESO', 'XXXX', 'ZZZ', '']) {
      expect(
        integrationConnectionRecordSchema.safeParse({ ...activeConnection(), currency }).success,
        currency,
      ).toBe(false);
    }
    for (const timezone of ['Buenos Aires', 'Mars/Olympus', '+03:00', 'GMT-3', '']) {
      expect(
        integrationConnectionRecordSchema.safeParse({ ...activeConnection(), timezone }).success,
        timezone,
      ).toBe(false);
    }
    expect(
      integrationConnectionRecordSchema.safeParse({ ...activeConnection(), timezone: 'UTC' })
        .success,
    ).toBe(true);
  });

  it('en pending_selection los metadatos pueden ser nulos, pero si están, son válidos', () => {
    expect(
      integrationConnectionRecordSchema.safeParse({ ...pendingConnection(), currency: 'peso' })
        .success,
    ).toBe(false);
  });

  it('pending_selection exige su vencimiento (DEC-17)', () => {
    expect(
      integrationConnectionRecordSchema.safeParse({
        ...pendingConnection(),
        pending_expires_at: null,
      }).success,
    ).toBe(false);
  });

  it('disconnected exige la marca de purga y admite metadatos nulos (CA-08, CA-38)', () => {
    const fromPending = {
      ...pendingConnection(),
      status: 'disconnected',
      purge_requested_at: '2026-09-25T12:20:00.000Z',
    };
    expect(integrationConnectionRecordSchema.safeParse(fromPending).success).toBe(true);
    expect(
      integrationConnectionRecordSchema.safeParse({ ...fromPending, purge_requested_at: null })
        .success,
    ).toBe(false);
    const fromActive = {
      ...activeConnection(),
      status: 'disconnected',
      purge_requested_at: '2026-09-25T12:20:00.000Z',
    };
    expect(integrationConnectionRecordSchema.safeParse(fromActive).success).toBe(true);
  });

  it('ningún estado inventa metadatos a medias (CA-08)', () => {
    expect(
      integrationConnectionRecordSchema.safeParse({
        ...pendingConnection(),
        status: 'disconnected',
        purge_requested_at: '2026-09-25T12:20:00.000Z',
        currency: 'ARS',
      }).success,
    ).toBe(false);
  });

  it('needs_reauth exige la clase de error (CA-09, CA-39)', () => {
    expect(
      integrationConnectionRecordSchema.safeParse({ ...activeConnection(), status: 'needs_reauth' })
        .success,
    ).toBe(false);
  });

  it('solo las clases de CA-39 que piden reautorizar llevan a needs_reauth', () => {
    const allowed = ['authentication', 'user_action', 'permission', 'asset_access'];
    const others = ['rate_limit', 'temporary', 'own_error', 'transport', 'unknown'];
    for (const errorClass of [...allowed, ...others]) {
      const record = {
        ...activeConnection(),
        status: 'needs_reauth',
        last_error_class: errorClass,
        last_error_message: 'Error de prueba.',
      };
      expect(integrationConnectionRecordSchema.safeParse(record).success, errorClass).toBe(
        allowed.includes(errorClass),
      );
    }
  });

  it('el error se guarda como clase cerrada más un mensaje redactado (CA-09)', () => {
    const withError = {
      ...activeConnection(),
      last_error_class: 'rate_limit',
      last_error_message: 'Límite de solicitudes alcanzado.',
    };
    expect(integrationConnectionRecordSchema.safeParse(withError).success).toBe(true);
    expect(
      integrationConnectionRecordSchema.safeParse({ ...withError, last_error_class: 'boom' })
        .success,
    ).toBe(false);
    expect(
      integrationConnectionRecordSchema.safeParse({
        ...withError,
        last_error_message: 'GET https://graph.example.test/v1/me?access_token=abc falló',
      }).success,
    ).toBe(false);
    expect(
      integrationConnectionRecordSchema.safeParse({ ...withError, last_error_class: null })
        .success,
    ).toBe(false);
  });

  it('rechaza un estado desconocido y un campo de credencial en el registro', () => {
    expect(
      integrationConnectionRecordSchema.safeParse({ ...activeConnection(), status: 'paused' })
        .success,
    ).toBe(false);
    expect(
      integrationConnectionRecordSchema.safeParse({ ...activeConnection(), access_token: 'x' })
        .success,
    ).toBe(false);
  });

  it('guarda client_business_id y la cuenta externa (CA-09b)', () => {
    const parsed = integrationConnectionRecordSchema.parse(activeConnection());
    expect(parsed.client_business_id).toBe('negocio_sintetico_01');
    expect(parsed.external_account_id).toBe(EXTERNAL_ACCOUNT_ID);
  });
});

describe('K03 DTO público (CA-06)', () => {
  const CREDENTIAL_FIELDS = [
    'ciphertext',
    'iv',
    'auth_tag',
    'key_version',
    'token',
    'access_token',
    'token_type',
    'granted_scopes',
    'issued_for_app_id',
    'credential_generation',
  ];

  it('el DTO tiene exactamente los campos declarados', () => {
    const dto = toConnectionDto(activeConnection());
    expect(Object.keys(dto).sort()).toEqual(
      [
        'currency',
        'external_account_id_masked',
        'id',
        'last_error',
        'pending_expires_at',
        'provider',
        'status',
        'timezone',
      ].sort(),
    );
  });

  it('la serialización del DTO no contiene campos de credencial ni la cuenta completa', () => {
    const record = {
      ...activeConnection(),
      last_error_class: 'rate_limit',
      last_error_message: 'Límite de solicitudes alcanzado.',
    } satisfies IntegrationConnectionRecord;
    const json = JSON.stringify(toConnectionDto(record));
    for (const field of CREDENTIAL_FIELDS) {
      expect(json).not.toContain(`"${field}"`);
    }
    expect(json).not.toContain(EXTERNAL_ACCOUNT_ID);
    expect(json).not.toContain(COMPANY_ID);
    expect(json).not.toContain('negocio_sintetico_01');
  });

  it('el DTO muestra la cuenta truncada (CA-09b, CA-40)', () => {
    const dto = toConnectionDto(activeConnection());
    expect(dto.external_account_id_masked).toBe(maskExternalAccountId(EXTERNAL_ACCOUNT_ID));
    expect(dto.external_account_id_masked).toMatch(/0123$/);
    expect(dto.external_account_id_masked).not.toContain('sintetica');
    expect(toConnectionDto(pendingConnection()).external_account_id_masked).toBeNull();
    expect(maskExternalAccountId('abc')).not.toContain('abc');
  });

  it('el error del DTO sale redactado y con su clase', () => {
    const dto = toConnectionDto({
      ...activeConnection(),
      last_error_class: 'transport',
      last_error_message: 'Timeout en https://graph.example.test/v1/insights',
    });
    expect(dto.last_error).toEqual({
      class: 'transport',
      message: 'Timeout en https://graph.example.test/v1/insights',
    });
  });

  it('un error con URL con parámetros no llega al DTO sin redactar (CA-09)', () => {
    const leaked = 'GET https://graph.example.test/v1/me?access_token=abc123 falló';
    expect(() =>
      toConnectionDto({
        ...activeConnection(),
        last_error_class: 'transport',
        last_error_message: leaked,
      }),
    ).toThrow();
    const dto = toConnectionDto({
      ...activeConnection(),
      last_error_class: 'transport',
      last_error_message: redactErrorMessage(leaked),
    });
    const json = JSON.stringify(dto);
    expect(json).not.toContain('abc123');
    expect(json).toContain('https://graph.example.test/v1/me');
  });

  it('un error con la cuenta en la ruta de una URL no llega al DTO sin redactar (R-01)', () => {
    const leaked = `GET https://graph.example.test/v1/${EXTERNAL_ACCOUNT_ID}/insights?fields=spend falló`;
    expect(() =>
      toConnectionDto({
        ...activeConnection(),
        last_error_class: 'transport',
        last_error_message: leaked,
      }),
    ).toThrow();
    const dto = toConnectionDto({
      ...activeConnection(),
      last_error_class: 'transport',
      last_error_message: redactErrorMessage(leaked),
    });
    const json = JSON.stringify(dto);
    expect(json).not.toContain(EXTERNAL_ACCOUNT_ID);
  });

  it('el esquema del DTO rechaza cualquier campo de credencial agregado', () => {
    const dto = toConnectionDto(activeConnection());
    for (const field of CREDENTIAL_FIELDS) {
      expect(integrationConnectionDtoSchema.safeParse({ ...dto, [field]: 'x' }).success, field).toBe(
        false,
      );
    }
    expect(
      integrationConnectionDtoSchema.safeParse({ ...dto, external_account_id: EXTERNAL_ACCOUNT_ID })
        .success,
    ).toBe(false);
  });

  it('el DTO es otro tipo, no el registro filtrado', () => {
    type Leaked = Extract<
      keyof IntegrationConnectionDto,
      | 'company_id'
      | 'external_account_id'
      | 'client_business_id'
      | 'credential_generation'
      | 'last_error_message'
      | 'ciphertext'
    >;
    expectTypeOf<Leaked>().toEqualTypeOf<never>();
  });
});

// ---------------------------------------------------------------------------
// K04 SecretCredential (M05.1.4)
// ---------------------------------------------------------------------------

describe('K04 SecretCredential', () => {
  it('acepta una credencial completa', () => {
    expect(secretCredentialSchema.parse(credential())).toEqual(credential());
  });

  it('no existe ningún campo de texto plano (CA-10)', () => {
    for (const field of ['token', 'access_token', 'plaintext', 'secret', 'code']) {
      expect(
        secretCredentialSchema.safeParse({ ...credential(), [field]: 'x' }).success,
        field,
      ).toBe(false);
    }
    type Plain = Extract<keyof SecretCredential, 'token' | 'access_token' | 'plaintext'>;
    expectTypeOf<Plain>().toEqualTypeOf<never>();
  });

  it('cada campo obligatorio ausente invalida el contrato (CA-10, CA-11, CA-11c, CA-13)', () => {
    for (const field of Object.keys(credential())) {
      expect(secretCredentialSchema.safeParse(without(credential(), field)).success, field).toBe(
        false,
      );
    }
  });

  it('una credencial sin conexión no valida (CA-13)', () => {
    for (const value of [null, '', 'no-es-uuid']) {
      expect(
        secretCredentialSchema.safeParse({ ...credential(), connection_id: value }).success,
        String(value),
      ).toBe(false);
    }
  });

  it('exige IV de 12 bytes, etiqueta de 16 y versión de clave positiva (CA-11)', () => {
    const cases: Array<[keyof SecretCredential, unknown]> = [
      ['iv', b64(16, 1)],
      ['iv', ''],
      ['auth_tag', b64(8, 2)],
      ['auth_tag', 'no base64!'],
      ['key_version', 0],
      ['key_version', 1.5],
      ['key_version', null],
      ['ciphertext', ''],
      ['ciphertext', 'no base64!'],
    ];
    for (const [field, value] of cases) {
      expect(
        secretCredentialSchema.safeParse({ ...credential(), [field]: value }).success,
        `${field}=${String(value)}`,
      ).toBe(false);
    }
  });

  it('guarda tipo de token, app emisora, permisos y expiración nullable (CA-11c)', () => {
    expect(
      secretCredentialSchema.safeParse({ ...credential(), expires_at: '2026-12-01T00:00:00.000Z' })
        .success,
    ).toBe(true);
    expect(secretCredentialSchema.safeParse({ ...credential(), token_type: 'page' }).success).toBe(
      false,
    );
    expect(secretCredentialSchema.safeParse({ ...credential(), issued_for_app_id: '' }).success).toBe(
      false,
    );
    expect(secretCredentialSchema.safeParse({ ...credential(), granted_scopes: [] }).success).toBe(
      false,
    );
  });

  it('los permisos concedidos incluyen ads_read (CA-32)', () => {
    expect(
      secretCredentialSchema.safeParse({ ...credential(), granted_scopes: ['business_management'] })
        .success,
    ).toBe(false);
    expect(
      secretCredentialSchema.safeParse({
        ...credential(),
        granted_scopes: ['ads_read', 'ads_read'],
      }).success,
    ).toBe(false);
  });

  it('el AAD combina empresa, conexión y proveedor y cambia si cambia cualquiera (CA-11b)', () => {
    const base = { company_id: COMPANY_ID, connection_id: CONNECTION_ID, provider: 'meta' } as const;
    const aad = buildCredentialAad(base);
    expect(buildCredentialAad({ ...base })).toBe(aad);
    expect(aad).toContain(COMPANY_ID);
    expect(aad).toContain(CONNECTION_ID);
    expect(aad).toContain('meta');
    expect(buildCredentialAad({ ...base, company_id: OTHER_COMPANY_ID })).not.toBe(aad);
    expect(buildCredentialAad({ ...base, connection_id: OTHER_CONNECTION_ID })).not.toBe(aad);
  });

  it('el AAD rechaza entradas inválidas en vez de construir uno ambiguo (CA-11b)', () => {
    expect(() =>
      buildCredentialAad({
        company_id: 'x',
        connection_id: CONNECTION_ID,
        provider: 'meta',
      }),
    ).toThrow();
    expect(() =>
      buildCredentialAad({
        company_id: COMPANY_ID,
        connection_id: CONNECTION_ID,
        provider: 'google' as 'meta',
      }),
    ).toThrow();
  });
});
