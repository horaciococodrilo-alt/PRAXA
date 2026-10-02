import 'server-only';

import pg from 'pg';

export type WorkerApiFunction =
  | 'create_oauth_attempt' | 'consume_oauth_attempt' | 'create_pending_connection'
  | 'get_credential' | 'confirm_connection' | 'replace_credential' | 'mark_needs_reauth'
  | 'begin_disconnect' | 'purge_connection' | 'list_pending_purges'
  | 'count_credentials_by_key_version' | 'rewrap_credential';

export interface Queryable {
  query<Row extends pg.QueryResultRow = pg.QueryResultRow>(
    config: { text: string; values: unknown[] }
  ): Promise<{ rows: Row[] }>;
  on(event: 'error', listener: (error: Error) => void): unknown;
  end(): Promise<void>;
}

export interface WorkerApi {
  call<Row extends pg.QueryResultRow = pg.QueryResultRow>(fn: WorkerApiFunction, args: readonly unknown[]): Promise<Row[]>;
}

export type WorkerFailureKind = 'transport' | 'timeout' | 'other';
export type WorkerApiCode =
  | 'not_authorized' | 'attempt_rejected' | 'live_connection_exists' | 'invalid_transition'
  | 'pending_expired' | 'generation_mismatch' | 'account_conflict' | 'key_version_mismatch'
  | 'invalid_argument' | 'privilege_missing' | 'unavailable' | 'unexpected'
  | 'config_missing' | 'config_invalid';

const MESSAGES: Record<WorkerApiCode, string> = {
  not_authorized: 'Operación no autorizada.',
  attempt_rejected: 'Intento de autorización rechazado.',
  live_connection_exists: 'Ya existe una conexión activa.',
  invalid_transition: 'Transición de conexión inválida.',
  pending_expired: 'La conexión pendiente venció.',
  generation_mismatch: 'La generación de la conexión cambió.',
  account_conflict: 'La cuenta ya está vinculada.',
  key_version_mismatch: 'La versión de clave cambió.',
  invalid_argument: 'Argumento de worker_api inválido.',
  privilege_missing: 'Falta un privilegio del rol de integraciones.',
  unavailable: 'La base de datos no está disponible.',
  unexpected: 'Error inesperado de base de datos.',
  config_missing: 'Falta PRAXA_INTEGRATIONS_DB_URL.',
  config_invalid: 'La URL de conexión no es válida.',
};

export class WorkerApiError extends Error {
  readonly code: WorkerApiCode;
  readonly failureKind: WorkerFailureKind;

  constructor(code: WorkerApiCode, failureKind: WorkerFailureKind = 'other', message = MESSAGES[code]) {
    super(message);
    this.name = 'WorkerApiError';
    this.code = code;
    this.failureKind = failureKind;
  }
}

const SQL_CASTS: Record<WorkerApiFunction, readonly string[]> = {
  create_oauth_attempt: ['uuid', 'uuid', 'text', 'text', 'text', 'text', 'timestamptz', 'uuid'],
  consume_oauth_attempt: ['uuid', 'uuid', 'text', 'text'],
  create_pending_connection: ['uuid', 'uuid', 'uuid', 'text', 'text', 'text', 'text', 'integer', 'text', 'text', 'text[]', 'timestamptz'],
  get_credential: ['uuid', 'uuid', 'uuid'],
  confirm_connection: ['uuid', 'uuid', 'uuid', 'text', 'text', 'text', 'boolean'],
  replace_credential: ['uuid', 'uuid', 'uuid', 'uuid', 'text', 'text', 'text', 'integer', 'text', 'text', 'text[]', 'timestamptz'],
  mark_needs_reauth: ['uuid', 'uuid', 'uuid', 'integer', 'text', 'text'],
  begin_disconnect: ['uuid', 'uuid', 'uuid'],
  purge_connection: ['uuid', 'uuid', 'uuid'],
  list_pending_purges: ['uuid', 'uuid'],
  count_credentials_by_key_version: [],
  rewrap_credential: ['uuid', 'uuid', 'uuid', 'integer', 'integer', 'text', 'text', 'text', 'integer'],
};

const SQL: Record<WorkerApiFunction, string> = Object.fromEntries(
  (Object.entries(SQL_CASTS) as [WorkerApiFunction, readonly string[]][]).map(([fn, casts]) => [
    fn,
    `select * from worker_api.${fn}(${casts.map((cast, index) => `$${index + 1}::${cast}`).join(', ')})`,
  ]),
) as Record<WorkerApiFunction, string>;

/** Supabase Root 2021 CA, fuente oficial:
 * https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt
 * Verificada 2026-10-01. SHA-256:
 * 80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA
 */
export const SUPABASE_ROOT_CA = `-----BEGIN CERTIFICATE-----
MIIDxDCCAqygAwIBAgIUbLxMod62P2ktCiAkxnKJwtE9VPYwDQYJKoZIhvcNAQEL
BQAwazELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5l
dyBDYXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJh
c2UgUm9vdCAyMDIxIENBMB4XDTIxMDQyODEwNTY1M1oXDTMxMDQyNjEwNTY1M1ow
azELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5ldyBD
YXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJhc2Ug
Um9vdCAyMDIxIENBMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqQXW
QyHOB+qR2GJobCq/CBmQ40G0oDmCC3mzVnn8sv4XNeWtE5XcEL0uVih7Jo4Dkx1Q
DmGHBH1zDfgs2qXiLb6xpw/CKQPypZW1JssOTMIfQppNQ87K75Ya0p25Y3ePS2t2
GtvHxNjUV6kjOZjEn2yWEcBdpOVCUYBVFBNMB4YBHkNRDa/+S4uywAoaTWnCJLUi
cvTlHmMw6xSQQn1UfRQHk50DMCEJ7Cy1RxrZJrkXXRP3LqQL2ijJ6F4yMfh+Gyb4
O4XajoVj/+R4GwywKYrrS8PrSNtwxr5StlQO8zIQUSMiq26wM8mgELFlS/32Uclt
NaQ1xBRizkzpZct9DwIDAQABo2AwXjALBgNVHQ8EBAMCAQYwHQYDVR0OBBYEFKjX
uXY32CztkhImng4yJNUtaUYsMB8GA1UdIwQYMBaAFKjXuXY32CztkhImng4yJNUt
aUYsMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAB8spzNn+4VU
tVxbdMaX+39Z50sc7uATmus16jmmHjhIHz+l/9GlJ5KqAMOx26mPZgfzG7oneL2b
VW+WgYUkTT3XEPFWnTp2RJwQao8/tYPXWEJDc0WVQHrpmnWOFKU/d3MqBgBm5y+6
jB81TU/RG2rVerPDWP+1MMcNNy0491CTL5XQZ7JfDJJ9CCmXSdtTl4uUQnSuv/Qx
Cea13BX2ZgJc7Au30vihLhub52De4P/4gonKsNHYdbWjg7OWKwNv/zitGDVDB9Y2
CMTyZKG3XEu5Ghl1LEnI3QmEKsqaCLv12BnVjbkSeZsMnevJPs1Ye6TjjJwdik5P
o/bKiIz+Fq8=
-----END CERTIFICATE-----`;

const TLS_QUERY = new Set(['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'ssl', 'sslnegotiation', 'uselibpqcompat']);
const DESTINATION_QUERY = new Set(['user', 'host', 'port']);
const POOLER_HOST = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.pooler\.supabase\.com$/i;
const ROLE_USER = /^praxa_integrations\.[a-z0-9]{20}$/;

function configInvalid(message = MESSAGES.config_invalid): never {
  throw new WorkerApiError('config_invalid', 'other', message);
}

function validateConnectionString(connectionString: string): void {
  if (typeof connectionString !== 'string' || !/^postgres(?:ql)?:\/\//i.test(connectionString)) configInvalid();
  let url: URL;
  try { url = new URL(connectionString); }
  catch { configInvalid(); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hash || !url.username || !url.password ||
      !url.hostname || !url.port || !url.pathname || url.pathname === '/') configInvalid();
  try {
    if (!decodeURIComponent(url.username) || !decodeURIComponent(url.password)) configInvalid();
  } catch { configInvalid(); }

  for (const [name] of url.searchParams) {
    const normalized = name.toLowerCase();
    if (DESTINATION_QUERY.has(normalized)) {
      configInvalid('La URL de conexión contiene overrides de identidad o destino no permitidos.');
    }
    if (TLS_QUERY.has(normalized)) {
      configInvalid('La URL de conexión contiene parámetros TLS no permitidos; TLS se configura en el módulo.');
    }
  }
  let username: string;
  try { username = decodeURIComponent(url.username); }
  catch { configInvalid(); }
  if (!ROLE_USER.test(username) || !POOLER_HOST.test(url.hostname) || url.port !== '6543') {
    configInvalid('Se requiere el shared transaction pooler en el puerto 6543.');
  }
}

function translated(error: unknown): WorkerApiError {
  if (error instanceof WorkerApiError) return error;
  const record = error && typeof error === 'object' ? error as { code?: unknown; message?: unknown } : {};
  const source = typeof record.code === 'string' ? record.code : '';
  const sql: Record<string, WorkerApiCode> = {
    PX001: 'not_authorized', PX002: 'attempt_rejected', PX003: 'live_connection_exists',
    PX004: 'invalid_transition', PX005: 'pending_expired', PX006: 'generation_mismatch',
    PX007: 'account_conflict', PX008: 'key_version_mismatch', '22023': 'invalid_argument',
    '42501': 'privilege_missing', '42883': 'privilege_missing',
  };
  if (sql[source]) return new WorkerApiError(sql[source]);
  if (source === 'ETIMEDOUT' || source === 'ETIMEOUT' || source === 'QUERY_TIMEOUT' || record.message === 'Query read timeout') {
    return new WorkerApiError('unavailable', 'timeout');
  }
  if (source.startsWith('08') || ['ECONNREFUSED', 'ENOTFOUND', 'ECONNRESET'].includes(source)) {
    return new WorkerApiError('unavailable', 'transport');
  }
  if (source.startsWith('28') || ['53300', '57P01', '57P03'].includes(source)) {
    return new WorkerApiError('unavailable');
  }
  return new WorkerApiError('unexpected');
}

export function createWorkerApi(options: { connectionString: string } | { pool: Queryable }): WorkerApi & { end(): Promise<void> } {
  let pool: Queryable;
  if ('pool' in options) {
    pool = options.pool;
  } else {
    validateConnectionString(options.connectionString);
    const config: pg.PoolConfig & { sslnegotiation: 'postgres' } = {
      connectionString: options.connectionString,
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      query_timeout: 15_000,
      application_name: 'praxa-worker-api',
      allowExitOnIdle: true,
      sslnegotiation: 'postgres',
      ssl: { ca: SUPABASE_ROOT_CA, rejectUnauthorized: true },
    };
    pool = new pg.Pool(config);
  }
  pool.on('error', () => { /* Nunca registrar el error original del pool inactivo. */ });
  return {
    async call<Row extends pg.QueryResultRow = pg.QueryResultRow>(fn: WorkerApiFunction, args: readonly unknown[]): Promise<Row[]> {
      if (!Object.hasOwn(SQL, fn) || !Array.isArray(args) || args.length !== SQL_CASTS[fn].length) {
        throw new WorkerApiError('invalid_argument');
      }
      try {
        const result = await pool.query<Row>({ text: SQL[fn], values: [...args] });
        if (!result || !Array.isArray(result.rows) || result.rows.some((row) => !row || typeof row !== 'object' || Array.isArray(row))) {
          throw new WorkerApiError('unexpected', 'other', 'Respuesta de base de datos inválida.');
        }
        return result.rows;
      } catch (error) { throw translated(error); }
    },
    end() { return pool.end(); },
  };
}

let runtimeWorkerApi: WorkerApi | undefined;

export function getWorkerApi(): WorkerApi {
  if (runtimeWorkerApi) return runtimeWorkerApi;
  const connectionString = process.env.PRAXA_INTEGRATIONS_DB_URL;
  if (!connectionString) throw new WorkerApiError('config_missing');
  runtimeWorkerApi = createWorkerApi({ connectionString });
  return runtimeWorkerApi;
}
