import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Carga de variables para los comandos de Node de este repositorio.
 *
 * IMPORTANTE: cada herramienta carga el entorno de forma distinta.
 *
 *  - Next.js (`npm run dev`, `npm run build`) lee `.env.local` por su cuenta.
 *  - La CLI de Supabase **NO** lee `.env.local`: solo mira las variables ya presentes
 *    en el proceso. Por eso los comandos que la invocan pasan por `withEnvFile()`, que
 *    carga `.env.local` y se lo entrega a la CLI como entorno del hijo.
 *  - Los scripts y las pruebas de este repositorio usan este módulo.
 *
 * Nunca se imprime el valor de una variable: solo su nombre y si está o no presente.
 */

const ENV_FILE = '.env.local';

/** Parseo mínimo de un archivo .env. Sin expansión de variables ni comandos. */
export function parseEnvFile(contents) {
  const values = new Map();

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;

    const separator = line.indexOf('=');
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }

    values.set(key, value);
  }

  return values;
}

export function envFilePath(root = process.cwd()) {
  return join(root, ENV_FILE);
}

/**
 * Devuelve las variables de `.env.local` combinadas con las del proceso.
 * Las del proceso ganan: en CI mandan las del runner.
 */
export function loadEnv(root = process.cwd()) {
  const path = envFilePath(root);
  const fromFile = existsSync(path) ? parseEnvFile(readFileSync(path, 'utf8')) : new Map();

  const merged = { ...Object.fromEntries(fromFile), ...process.env };
  for (const [key, value] of Object.entries(merged)) {
    if (value === '') delete merged[key];
  }
  return merged;
}

/** Entorno para pasarle a un proceso hijo (la CLI de Supabase). */
export function withEnvFile(root = process.cwd()) {
  return loadEnv(root);
}

export function missing(env, names) {
  return names.filter((name) => !env[name]);
}

/** Enmascara un valor para poder mencionarlo sin revelarlo. */
export function redact(value) {
  if (!value) return '(vacío)';
  return `(definido, ${value.length} caracteres)`;
}
