import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { parseEnvFile } from './lib/env.mjs';

/**
 * Prepara `.env.local` a partir de `.env.example`.
 *
 *  - Si NO existe, lo crea con todas las claves vacías.
 *  - Si existe, CONSERVA todos sus valores y agrega solo las claves que falten,
 *    al final, en una sección aparte.
 *
 * Nunca sobrescribe un valor existente y nunca imprime un secreto: informa únicamente
 * nombres de variables y si están completas o vacías.
 */

const root = process.cwd();
const examplePath = join(root, '.env.example');
const localPath = join(root, '.env.local');

if (!existsSync(examplePath)) {
  console.error('No se encontró .env.example.');
  process.exit(1);
}

const exampleRaw = readFileSync(examplePath, 'utf8');
const exampleKeys = [...parseEnvFile(exampleRaw).keys()];

if (!existsSync(localPath)) {
  writeFileSync(localPath, exampleRaw, 'utf8');
  console.log('.env.local creado a partir de .env.example.');
  console.log(`  ${exampleKeys.length} variables, todas por completar.`);
} else {
  const localRaw = readFileSync(localPath, 'utf8');
  const localValues = parseEnvFile(localRaw);
  const missingKeys = exampleKeys.filter((key) => !localValues.has(key));

  if (missingKeys.length === 0) {
    console.log('.env.local ya existe y tiene todas las variables. No se modificó nada.');
  } else {
    const block = [
      '',
      '# ---------------------------------------------------------------------------',
      `# Agregado por "npm run env:prepare" el ${new Date().toISOString().slice(0, 10)}.`,
      '# Variables nuevas de .env.example que faltaban acá. Los valores existentes',
      '# NO se tocaron.',
      '# ---------------------------------------------------------------------------',
      ...missingKeys.map((key) => `${key}=`),
      '',
    ].join('\n');

    writeFileSync(localPath, `${localRaw.replace(/\s*$/, '\n')}${block}`, 'utf8');
    console.log(`.env.local ya existía: se conservaron sus valores.`);
    console.log(`  Se agregaron ${missingKeys.length} variable(s) faltante(s):`);
    for (const key of missingKeys) console.log(`    ${key}`);
  }
}

// Resumen sin revelar valores.
const finalValues = parseEnvFile(readFileSync(localPath, 'utf8'));
const empty = exampleKeys.filter((key) => !finalValues.get(key));

console.log(`\nRuta: ${localPath}`);
if (empty.length === 0) {
  console.log('Todas las variables tienen algún valor.');
} else {
  console.log(`\nFaltan completar ${empty.length} variable(s):`);
  for (const key of empty) console.log(`  ${key}`);
}
