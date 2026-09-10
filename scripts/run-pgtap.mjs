import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import pg from 'pg';

import { loadEnv } from './lib/env.mjs';
import { resolveSqlTestTarget } from './lib/sql-target.mjs';

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
 * Siempre deja la conexión limpia: ante un error a mitad de archivo, la transacción
 * queda abortada y se emite un ROLLBACK explícito antes de seguir.
 */

const TESTS_DIR = join(process.cwd(), 'supabase', 'tests');

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

async function runFile(client, file) {
  const sql = await readFile(join(TESTS_DIR, file), 'utf8');

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

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    application_name: 'praxa-pgtap',
  });

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

  try {
    for (const file of files) {
      const run = await runFile(client, file);
      totalAssertions += run.assertions.length;
      failures.push(...report(run));
    }
  } finally {
    await client.end();
  }

  console.log(
    `\n${files.length} archivo(s), ${totalAssertions} aserción(es) ejecutada(s), ` +
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
