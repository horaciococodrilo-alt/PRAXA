import 'server-only';

import pg from 'pg';

import { SUPABASE_ROOT_CA } from './supabase-root-ca.mjs';

export { SUPABASE_ROOT_CA } from './supabase-root-ca.mjs';

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


const TLS_QUERY = new Set(['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'ssl', 'sslnegotiation', 'uselibpqcompat']);
const DESTINATION_QUERY = new Set(['user', 'host', 'port']);
const POOLER_HOST = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.pooler\.supabase\.com$/i;
const ROLE_USER = /^praxa_integrations\.[a-z0-9]{20}$/;

/**
 * pg-connection-string vuelve a codificar toda la cadena con `encodeURI` cuando
 * encuentra un espacio sin codificar o un `%` que no va seguido de dos dígitos
 * hexadecimales (pg-connection-string/index.js:20). Esa re-codificación no decodifica
 * un `%XX` ya presente (por ejemplo `%5F`): lo deja como texto literal en el usuario
 * que pg termina usando, distinto del que valida esta guarda. Ante esa ambigüedad se
 * rechaza la URL entera, sin intentar replicar la re-codificación. La última alternativa
 * (`%[a-f0-9]?$`) cubre el mismo caso cuando el `%` ambiguo cae en los últimos 1-2
 * caracteres de toda la cadena, donde las alternativas anteriores no tienen carácter
 * siguiente que inspeccionar (H-E1-48).
 */
const AMBIGUOUS_ENCODING = / |%[^a-f0-9]|%[a-f0-9][^a-f0-9]|%[a-f0-9]?$/i;

/** Puerto literal de la autoridad de la URL original, sin la normalización de `new URL()`. */
function literalAuthorityPort(raw: string): string | null {
  const afterScheme = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  const end = afterScheme.search(/[/?#]/);
  const authority = end === -1 ? afterScheme : afterScheme.slice(0, end);
  const at = authority.lastIndexOf('@');
  const hostport = at === -1 ? authority : authority.slice(at + 1);
  const match = /:(\d+)$/.exec(hostport);
  return match ? match[1] : null;
}

function configInvalid(message = MESSAGES.config_invalid): never {
  throw new WorkerApiError('config_invalid', 'other', message);
}

function validateConnectionString(connectionString: string): void {
  if (typeof connectionString !== 'string' || !/^postgres(?:ql)?:\/\//i.test(connectionString)) configInvalid();
  if (AMBIGUOUS_ENCODING.test(connectionString)) configInvalid();
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
  if (!ROLE_USER.test(username) || !POOLER_HOST.test(url.hostname) || url.port !== '6543' ||
      literalAuthorityPort(connectionString) !== '6543') {
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
