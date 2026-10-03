import 'server-only';

import pg from 'pg';

import { inspectConnectionUrl, literalAuthorityPort, POOLER_HOST } from './connection-url.mjs';
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

const ROLE_USER = /^praxa_integrations\.[a-z0-9]{20}$/;

/**
 * pg y pg-pool emiten la pérdida de conexión y los timeouts de conexión como `Error`
 * sin `code` (pg/lib/client.js y pg-pool/index.js), así que se reconocen por mensaje
 * exacto, igual que `Query read timeout` (H-E1-54).
 */
const TRANSPORT_MESSAGES = new Set([
  'Connection terminated unexpectedly',
  'Client has encountered a connection error and is not queryable',
]);
const TIMEOUT_MESSAGES = new Set([
  'Query read timeout',
  'timeout expired',
  'timeout exceeded when trying to connect',
  'Connection terminated due to connection timeout',
]);
const TRANSPORT_CODES = new Set([
  'ECONNREFUSED', 'ENOTFOUND', 'ECONNRESET', 'EPIPE', 'EHOSTUNREACH', 'ENETUNREACH', 'EAI_AGAIN',
]);

function configInvalid(message = MESSAGES.config_invalid): never {
  throw new WorkerApiError('config_invalid', 'other', message);
}

function validateConnectionString(connectionString: string): void {
  const inspected = inspectConnectionUrl(connectionString);
  if (!inspected.ok) configInvalid(inspected.problem);
  const { url } = inspected;
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
  const message = !source && typeof record.message === 'string' ? record.message : '';
  if (source === 'ETIMEDOUT' || source === 'ETIMEOUT' || source === 'QUERY_TIMEOUT' || TIMEOUT_MESSAGES.has(message)) {
    return new WorkerApiError('unavailable', 'timeout');
  }
  if (source.startsWith('08') || TRANSPORT_CODES.has(source) || TRANSPORT_MESSAGES.has(message)) {
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
