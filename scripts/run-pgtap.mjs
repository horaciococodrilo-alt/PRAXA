import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import pg from 'pg';

import { loadEnv } from './lib/env.mjs';
import { resolveSqlTestTarget } from './lib/sql-target.mjs';
import { verifiedTestDbConfig } from './lib/test-db-client.mjs';

/**
 * Ejecutor de pruebas pgTAP contra PostgreSQL REMOTO, sin contenedores.
 *
 * `supabase test db` corre pg_prove dentro de un contenedor Docker, y el flag `--linked`
 * solo cambia la base de destino: la dependencia del contenedor sigue estando. Este
 * ejecutor la elimina: se conecta directo con `pg`, manda cada archivo tal cual —
 * conservando su propio `begin; ... rollback;` — y parsea el TAP que devuelve pgTAP.
 *
 * Falla si:
 *   - alguna aserción da `not ok`;
 *   - la cantidad de aserciones no coincide con el plan declarado (`1..N`);
 *   - no hay plan;
 *   - hay un error SQL.
 *
 * Repite 09 tras normalizar un rol sintético limpio con membresías entrante y saliente.
 * El bloque es el real de 0012, con solo el nombre del rol sustituido. El rol persistido
 * ya tiene privilegios directos, por lo que la nueva precondición debe rechazarlo.
 * Siempre deja la conexión limpia: ante un error a mitad de archivo, la transacción
 * queda abortada y se emite un ROLLBACK explícito antes de seguir.
 */

const TESTS_DIR = join(process.cwd(), 'supabase', 'tests');
const INTEGRATIONS_MIGRATION = join(process.cwd(), 'supabase', 'migrations', '0012_integrations.sql');
const ROLE_TEST_FILE = '09_integration_privileges.test.sql';

async function roleNormalizationBlock() {
  const migration = await readFile(INTEGRATIONS_MIGRATION, 'utf8');
  const roleBlock = migration.match(/^do \$\$\r?\n[\s\S]*?^\$\$;/m)?.[0];
  if (!roleBlock?.includes('alter role praxa_integrations')) {
    throw new Error('No se encontró el bloque de normalización de praxa_integrations en 0012.');
  }
  return roleBlock;
}

async function roleNormalizationSetup() {
  const roleBlock = (await roleNormalizationBlock()).replaceAll(
    'praxa_integrations', 'praxa_integrations_probe',
  );
  return `
create role praxa_integrations_probe nologin;
do $probe$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'praxa_inbound_probe') then
    create role praxa_inbound_probe nologin;
  end if;
end;
$probe$;
create role praxa_outbound_probe nologin;
grant praxa_integrations_probe to praxa_inbound_probe;
grant praxa_outbound_probe to praxa_integrations_probe;
do $probe$
begin
  if not pg_has_role('praxa_inbound_probe', 'praxa_integrations_probe', 'SET') then
    raise exception 'T-05: el grant entrante de preparación no quedó activo';
  end if;
  if not pg_has_role('praxa_integrations_probe', 'praxa_outbound_probe', 'SET') then
    raise exception 'T-05: el grant saliente de preparación no quedó activo';
  end if;
end;
$probe$;
${roleBlock}
do $probe$
begin
  if exists (
    select 1 from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles r on r.oid = m.member
    where r.rolname = 'praxa_integrations_probe'
  ) or pg_has_role('praxa_inbound_probe', 'praxa_integrations_probe', 'SET') then
    raise exception 'T-05: la normalización dejó membresías sintéticas';
  end if;
end;
$probe$;
`;
}

function parseTap(lines) {
  let planned = null;
  const assertions = [];
  const diagnostics = [];

  for (const line of lines) {
    const plan = line.match(/^1\.\.(\d+)/);
    if (plan) {
      planned = Number(plan[1]);
      continue;
    }

    const assertion = line.match(/^(not ok|ok)\s+(\d+)?\s*-?\s*(.*)$/);
    if (assertion) {
      assertions.push({
        ok: assertion[1] === 'ok',
        number: assertion[2] ? Number(assertion[2]) : assertions.length + 1,
        description: assertion[3]?.trim() ?? '',
      });
      continue;
    }

    if (line.startsWith('#')) diagnostics.push(line);
  }

  return { planned, assertions, diagnostics };
}

/** pgTAP devuelve el TAP como filas de texto; se aplanan en orden. */
function collectLines(result) {
  const results = Array.isArray(result) ? result : [result];
  const lines = [];

  for (const item of results) {
    for (const row of item?.rows ?? []) {
      for (const value of Object.values(row)) {
        if (typeof value !== 'string') continue;
        for (const line of value.split('\n')) lines.push(line);
      }
    }
  }

  return lines;
}

async function runFile(client, file, setupSql = null) {
  let sql = await readFile(join(TESTS_DIR, file), 'utf8');
  if (file === ROLE_TEST_FILE) {
    const roleBlock = await roleNormalizationBlock();
    sql = sql.replace('__ROLE_NORMALIZATION_BLOCK__', () => roleBlock);
    sql = sql.replace('__CROSS_ROLE_NORMALIZATION_BLOCK__', () =>
      roleBlock.replaceAll('praxa_integrations', 'praxa_cross_worker'));
  }
  if (setupSql !== null) {
    const begin = /^begin;\r?$/im;
    if (!begin.test(sql)) throw new Error(`${file} no inicia una transacción de prueba.`);
    sql = sql.replace(begin, (statement) => `${statement}\n${setupSql}`);
  }

  try {
    const result = await client.query(sql);
    return { file, ...parseTap(collectLines(result)), error: null };
  } catch (error) {
    // La transacción del archivo quedó abortada: hay que cerrarla antes del siguiente.
    try {
      await client.query('rollback');
    } catch {
      /* la conexión ya estaba fuera de transacción */
    }
    return {
      file,
      planned: null,
      assertions: [],
      diagnostics: [],
      error: {
        message: error.message,
        where: error.where ?? null,
        detail: error.detail ?? null,
        hint: error.hint ?? null,
      },
    };
  }
}

function report(run) {
  const failures = [];

  if (run.error) {
    console.log(`\nFALLA  ${run.file}  — error SQL`);
    console.log(`       ${run.error.message}`);
    if (run.error.detail) console.log(`       detalle: ${run.error.detail}`);
    if (run.error.hint) console.log(`       sugerencia: ${run.error.hint}`);
    if (run.error.where) console.log(`       en: ${run.error.where.split('\n')[0]}`);
    failures.push(`${run.file}: error SQL`);
    return failures;
  }

  const failed = run.assertions.filter((assertion) => !assertion.ok);
  const total = run.assertions.length;

  if (run.planned === null) {
    console.log(`\nFALLA  ${run.file}  — no declaró plan (falta select plan(N))`);
    failures.push(`${run.file}: sin plan`);
    return failures;
  }

  if (failed.length === 0 && total === run.planned) {
    console.log(`OK     ${run.file}  (${total}/${run.planned} aserciones)`);
    return failures;
  }

  console.log(`\nFALLA  ${run.file}  (${total - failed.length}/${run.planned} aserciones)`);

  for (const assertion of failed) {
    console.log(`       not ok ${assertion.number} - ${assertion.description}`);
  }

  if (total !== run.planned) {
    console.log(
      `       plan incompleto: se declararon ${run.planned} aserciones y se ejecutaron ${total}`,
    );
    failures.push(`${run.file}: plan incompleto`);
  }

  for (const diagnostic of run.diagnostics) console.log(`       ${diagnostic}`);
  if (failed.length > 0) failures.push(`${run.file}: ${failed.length} aserción(es) fallida(s)`);

  return failures;
}

async function main() {
  // Solo el proyecto de PRUEBAS, comprobado antes de abrir ninguna conexion.
  const target = resolveSqlTestTarget(loadEnv());

  if (!target.ok) {
    console.error('No se puede elegir el destino de las pruebas SQL:');
    for (const problem of target.problems) console.error(`  - ${problem}`);
    console.error('Ver README.md, seccion "Pruebas contra el proyecto remoto".');
    process.exit(1);
  }

  const connectionString = target.connectionString;

  let files;
  try {
    files = (await readdir(TESTS_DIR)).filter((file) => file.endsWith('.test.sql')).sort();
  } catch {
    console.error(`No se encontró el directorio de pruebas: ${TESTS_DIR}`);
    process.exit(1);
  }

  if (files.length === 0) {
    console.error('No hay archivos *.test.sql en supabase/tests.');
    process.exit(1);
  }

  const client = new pg.Client(verifiedTestDbConfig(connectionString, 'praxa-pgtap'));

  try {
    await client.connect();
  } catch (error) {
    console.error(`\nNo se pudo conectar a la base de pruebas: ${error.message}`);
    console.error('Revisá SUPABASE_TEST_DB_URL (usuario, contraseña y host del pooler).\n');
    process.exit(1);
  }

  console.log(`Ejecutando ${files.length} archivo(s) pgTAP contra el proyecto de pruebas ${target.projectRef}.\n`);

  const failures = [];
  let totalAssertions = 0;
  let executions = 0;

  try {
    for (const file of files) {
      const run = await runFile(client, file);
      executions += 1;
      totalAssertions += run.assertions.length;
      failures.push(...report(run));

      if (file === ROLE_TEST_FILE) {
        const replay = await runFile(client, file, await roleNormalizationSetup());
        replay.file = `${file} (normalización con membresías sintéticas)`;
        executions += 1;
        totalAssertions += replay.assertions.length;
        failures.push(...report(replay));
      }
    }
  } finally {
    await client.end();
  }

  console.log(
    `\n${files.length} archivo(s), ${executions} ejecución(es), ${totalAssertions} aserción(es), ` +
      `${failures.length} problema(s).`,
  );

  if (failures.length > 0) {
    console.error('\nPruebas pgTAP FALLIDAS:');
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }

  console.log('Todas las pruebas pgTAP pasaron.');
}

await main();
