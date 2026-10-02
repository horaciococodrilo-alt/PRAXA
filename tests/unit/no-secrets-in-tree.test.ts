import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { isAbsolute, join, posix, relative, resolve, sep, win32 } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const self = 'tests/unit/no-secrets-in-tree.test.ts';

const patterns = {
  meta_token: /\bEAA[A-Za-z0-9]{30,}/g,
  oauth_param: /[?&#](?:code|access_token|input_token|fb_exchange_token|client_secret)=[A-Za-z0-9._~-]{20,}/g,
  supabase_secret: /\bsb_secret_[A-Za-z0-9_-]{16,}/g,
  jwt: /\beyJ[A-Za-z0-9_-]{7,}\.eyJ[A-Za-z0-9_-]{7,}\.[A-Za-z0-9_-]{10,}\b/g,
  keyring_pair: /\b\d{1,10}:[A-Za-z0-9+/]{43}=(?![A-Za-z0-9+/=])/g,
  db_url_password: /postgres(?:ql)?:\/\/[^\s:@/]+:([^\s@/]+)@/g,
  env_secret_assignment: /^[ \t]*(?:PRAXA_CREDENTIAL_KEYS|PRAXA_INTEGRATIONS_DB_URL|PRAXA_INTEGRATIONS_TEST_DB_URL|META_APP_SECRET|DEEPINFRA_API_KEY|SUPABASE_TEST_SECRET_KEY|SUPABASE_DB_URL|SUPABASE_TEST_DB_URL)[ \t]*=[ \t]*[^\s#][^\r\n]*/gm,
  private_key: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
} as const;

type PatternName = keyof typeof patterns;
type Finding = { line: number; pattern: PatternName };

function allowedSynthetic(name: PatternName, match: RegExpExecArray): boolean {
  if (match[0].includes('no-es-una-firma-real') || match[0].includes('ejemplo-no-real')) return true;
  if (name !== 'db_url_password') return false;
  const password = match[1];
  return ['...', '…', 'secreta', 'clave', '[YOUR-PASSWORD]', '%5BYOUR-PASSWORD%5D'].includes(password)
    || password.startsWith('${') || password.startsWith('<');
}

function scan(text: string): Finding[] {
  const found: Finding[] = [];
  for (const [name, template] of Object.entries(patterns) as [PatternName, RegExp][]) {
    const regex = new RegExp(template.source, template.flags);
    for (const match of text.matchAll(regex)) {
      if (allowedSynthetic(name, match)) continue;
      found.push({ line: text.slice(0, match.index).split('\n').length, pattern: name });
    }
  }
  return found;
}

function filesFromGit(run: typeof execFileSync = execFileSync): string[] {
  try {
    const output = run('git', ['ls-files', '-co', '--exclude-standard', '-z'], { cwd: root, encoding: 'buffer' });
    return Buffer.from(output).toString('utf8').split('\0').filter(Boolean).map((path) => path.replaceAll('\\', '/'));
  } catch {
    throw new Error('No se pudo enumerar el árbol con git ls-files.');
  }
}

function isWithinRoot(
  rootPath: string,
  targetPath: string,
  paths: Pick<typeof posix, 'relative' | 'isAbsolute' | 'sep'> = { relative, isAbsolute, sep },
) {
  const pathFromRoot = paths.relative(rootPath, targetPath);
  return pathFromRoot !== '..' && !pathFromRoot.startsWith(`..${paths.sep}`) && !paths.isAbsolute(pathFromRoot);
}

describe('M06.3a paso 3 RED: higiene del árbol', () => {
  it('T-25 confina rutas en Windows y Linux sin aceptar directorios hermanos', () => {
    expect(isWithinRoot('C:\\repo', 'C:\\repo\\tests\\case.test.ts', win32)).toBe(true);
    expect(isWithinRoot('/repo', '/repo/tests/case.test.ts', posix)).toBe(true);
    expect(isWithinRoot('/repo', '/repo-other/case.test.ts', posix)).toBe(false);
    expect(isWithinRoot('/repo', '/repo/../outside/case.test.ts', posix)).toBe(false);
    expect(isWithinRoot('C:\\repo', 'C:\\repo-other\\case.test.ts', win32)).toBe(false);
  });
  it('T-25 autoprueba los ocho patrones con muestras creadas durante la ejecución', () => {
    const positives: Record<PatternName, string> = {
      meta_token: 'EA' + 'A' + 'x'.repeat(40),
      oauth_param: '?code=' + 'x'.repeat(24),
      supabase_secret: 'sb_' + 'secret_' + 'x'.repeat(20),
      jwt: ['eyJ' + 'x'.repeat(12), 'eyJ' + 'y'.repeat(12), 'z'.repeat(20)].join('.'),
      keyring_pair: '1:' + 'A'.repeat(43) + '=',
      db_url_password: 'postgresql://usuario:' + 'contrasena_larga' + '@host.test:5432/postgres',
      env_secret_assignment: 'PRAXA_CREDENTIAL_' + 'KEYS=' + 'x'.repeat(20),
      private_key: '-----BEGIN ' + 'PRIVATE KEY-----',
    };
    for (const [name, sample] of Object.entries(positives) as [PatternName, string][]) {
      expect(scan(sample), name).toContainEqual({ line: 1, pattern: name });
    }
    expect(scan('sb_secret_ejemplo-no-real')).toEqual([]);
    expect(scan('postgresql://usuario:secreta@host.test:5432/postgres')).toEqual([]);
    expect(scan('postgresql://usuario:%5BYOUR-PASSWORD%5D@host.test:5432/postgres')).toEqual([]);
  });

  it('T-25 informa solo archivo, línea y nombre del patrón', () => {
    const sample = 'cabecera\n?access_token=' + 'x'.repeat(24);
    const report = scan(sample).map((finding) => `archivo:prueba:${finding.line} → ${finding.pattern}`).join('\n');
    expect(report).toContain('archivo:prueba:2 → oauth_param');
    expect(report).not.toContain('x'.repeat(24));
  });

  it('T-26 enumera versionados y nuevos sin .env.local y falla si Git falla', () => {
    const files = filesFromGit();
    expect(files).toContain('tests/unit/no-secrets-in-tree.test.ts');
    expect(files).not.toContain('.env.local');
    expect(() => filesFromGit((() => { throw new Error('fallo sintético'); }) as typeof execFileSync))
      .toThrow('No se pudo enumerar el árbol con git ls-files.');
  });

  it('T-25 recorre archivos de texto del árbol sin leer binarios ni este test', () => {
    const findings: string[] = [];
    for (const path of filesFromGit()) {
      if (path === self) continue;
      const absolute = join(root, path);
      if (!isWithinRoot(root, absolute)) throw new Error('Ruta fuera del repositorio.');
      const bytes = readFileSync(absolute);
      if (bytes.includes(0)) continue;
      for (const found of scan(bytes.toString('utf8'))) {
        findings.push(`${relative(root, absolute).replaceAll('\\', '/')}:${found.line} → ${found.pattern}`);
      }
    }
    expect(findings).toEqual([]);
  });
});
