import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Utilidades para las pruebas de aplicación contra un proyecto REMOTO de Supabase.
 *
 * No hace falta Docker ni ningún stack local.
 *
 * Tres reglas que este archivo hace cumplir:
 *
 *  1. Las credenciales de prueba tienen nombres PROPIOS (`SUPABASE_TEST_*`), distintos
 *     de los de la aplicación. Apuntar la suite al proyecto que usa la aplicación exige
 *     pegar esas credenciales a propósito; no puede pasar por descuido.
 *  2. Nada corre sin `SUPABASE_TEST_IS_DISPOSABLE=yes-this-project-is-disposable`.
 *  3. Cada ejecución marca lo que crea con un identificador único y borra al final
 *     exactamente eso, nada más.
 *
 * La clave `service_role` se usa solo para preparar y limpiar fixtures (crear usuarios
 * ya confirmados, borrar lo creado). Corre en Node, nunca en el navegador, y este
 * archivo no es importable desde `src/`: hay una prueba que lo verifica.
 */

const DISPOSABLE_ACK = 'yes-this-project-is-disposable';

export const TEST_URL = process.env.SUPABASE_TEST_URL ?? '';
export const TEST_PUBLISHABLE_KEY = process.env.SUPABASE_TEST_PUBLISHABLE_KEY ?? '';
const TEST_SECRET_KEY = process.env.SUPABASE_TEST_SECRET_KEY ?? '';

/** Identificador único de esta corrida. Etiqueta todo lo que se crea. */
export const RUN_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const SETUP_HINT =
  'Configurá SUPABASE_TEST_URL, SUPABASE_TEST_PUBLISHABLE_KEY, SUPABASE_TEST_SECRET_KEY y ' +
  `SUPABASE_TEST_IS_DISPOSABLE=${DISPOSABLE_ACK} apuntando a un proyecto Supabase ` +
  'DESECHABLE (ver README, sección "Pruebas contra el proyecto remoto").';

/**
 * Devuelve el motivo por el que las pruebas no pueden correr, o null si pueden.
 * Nunca "asume" que el proyecto es de pruebas: exige la confirmación explícita.
 */
export function blockedReason(): string | null {
  if (!TEST_URL || !TEST_PUBLISHABLE_KEY || !TEST_SECRET_KEY) {
    return `Faltan credenciales del proyecto de pruebas. ${SETUP_HINT}`;
  }

  if (process.env.SUPABASE_TEST_IS_DISPOSABLE !== DISPOSABLE_ACK) {
    return (
      'Falta la confirmación de que el proyecto es desechable. Estas pruebas crean y ' +
      'borran usuarios y empresas: nunca deben correr contra una base de producción. ' +
      `Definí SUPABASE_TEST_IS_DISPOSABLE=${DISPOSABLE_ACK} si el proyecto lo es.`
    );
  }

  // Última barrera: si alguien copió la URL de la aplicación en la variable de pruebas,
  // se detiene salvo que lo declare a propósito.
  const appUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (appUrl && appUrl === TEST_URL && process.env.SUPABASE_TEST_ALLOW_APP_PROJECT !== 'true') {
    return (
      'SUPABASE_TEST_URL apunta al mismo proyecto que usa la aplicación ' +
      '(NEXT_PUBLIC_SUPABASE_URL). Usá un proyecto aparte, o definí ' +
      'SUPABASE_TEST_ALLOW_APP_PROJECT=true si ese proyecto también es desechable.'
    );
  }

  return null;
}

export async function remoteProjectReachable(): Promise<boolean> {
  try {
    const response = await fetch(`${TEST_URL}/auth/v1/health`, {
      headers: { apikey: TEST_PUBLISHABLE_KEY },
      signal: AbortSignal.timeout(10_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** Cliente anónimo: el mismo que usa el navegador. Sujeto a RLS. */
export function anonClient(): SupabaseClient {
  return createClient(TEST_URL, TEST_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Cliente privilegiado, EXCLUSIVO de los fixtures. Omite RLS.
 * Nunca se usa para verificar comportamiento: cada aserción de aislamiento corre con un
 * cliente autenticado normal.
 */
function fixtureAdminClient(): SupabaseClient {
  return createClient(TEST_URL, TEST_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type TestUser = {
  id: string;
  email: string;
  password: string;
  client: SupabaseClient;
};

/** Todo lo creado por ESTA corrida. Es lo único que se borra al final. */
const createdUserIds = new Set<string>();

let sequence = 0;

/** Correo único por corrida y por usuario, para que dos ejecuciones no choquen. */
export function testEmail(prefix = 'user'): string {
  return `praxa-test+${RUN_ID}-${prefix}-${sequence++}@example.test`;
}

/** Crea un usuario ya confirmado y devuelve un cliente autenticado como él. */
export async function createConfirmedUser(prefix = 'user'): Promise<TestUser> {
  const admin = fixtureAdminClient();
  const email = testEmail(prefix);
  const password = `praxa-test-${RUN_ID}-Aa1!`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { praxa_test_run: RUN_ID },
  });
  if (error || !data.user) {
    throw new Error(`No se pudo crear el usuario de prueba: ${error?.message}`);
  }
  createdUserIds.add(data.user.id);

  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) {
    throw new Error(`No se pudo autenticar el usuario de prueba: ${signInError.message}`);
  }

  return { id: data.user.id, email, password, client };
}

/** Registra un usuario creado por otra vía (p. ej. signUp) para que se limpie igual. */
export function trackUserId(userId: string | undefined | null): void {
  if (userId) createdUserIds.add(userId);
}

/**
 * Borra SOLO lo que creó esta corrida.
 *
 * Orden importante: primero las empresas y luego los usuarios, porque
 * `companies.owner_id` referencia `auth.users` con ON DELETE RESTRICT. El borrado de la
 * empresa arrastra en cascada su contexto, objetivos, sistemas y reportes.
 */
export async function cleanupRun(): Promise<void> {
  if (createdUserIds.size === 0) return;
  const admin = fixtureAdminClient();
  const ids = [...createdUserIds];

  const { error: companyError } = await admin
    .from('companies')
    .delete()
    .in('owner_id', ids);
  if (companyError) {
    throw new Error(
      `No se pudieron borrar las empresas de la corrida ${RUN_ID}: ${companyError.message}. ` +
        'Revisá el proyecto de pruebas y borralas a mano.',
    );
  }

  const failed: string[] = [];
  for (const id of ids) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) failed.push(`${id}: ${error.message}`);
  }
  createdUserIds.clear();

  if (failed.length > 0) {
    throw new Error(
      `Quedaron usuarios sin borrar de la corrida ${RUN_ID}:\n${failed.join('\n')}`,
    );
  }
}

/** Cuántos registros de esta corrida siguen vivos. Para comprobar la limpieza. */
export function pendingCleanupCount(): number {
  return createdUserIds.size;
}
