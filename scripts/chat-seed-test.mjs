import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

import { refFromApiUrl, refFromDbUrl, resolveTarget } from './lib/target.mjs';
import { resolveIntegrationsTestTarget, resolveSqlTestTarget } from './lib/sql-target.mjs';
import { supabaseTlsConfig } from '../src/modules/integrations/db/connection-url.mjs';
import { RICH_DAYS, richBreakdownRows, richDailyRows, richEntities, richIds } from './lib/chat-seed-rich.mjs';

const RUN_EMAIL_PREFIX = 'praxa-chat+';
const RUN_EMAIL_SUFFIX = '@example.test';
const LEVELS = ['account', 'campaign', 'adset', 'ad'];
const DIMENSIONS = ['age_gender', 'country', 'region'];
const LIMITS = {
  lookbackDays: 7, maxWindowDays: 7, maxPagesPerLevel: 2, maxMetadataPages: 2,
  maxEntities: 20, maxPayloadBytes: 100_000, maxDurationMs: 300_000,
  finalizationReserveMs: 10_000, leaseSeconds: 310, maxRetries: 0, retryDelayMs: 0,
};

/** Pure preflight: all three test URLs must identify the same disposable project. */
export function validateSeedTarget(env, { requireModel = true } = {}) {
  const sql = resolveSqlTestTarget(env);
  const role = resolveIntegrationsTestTarget(env);
  const apiRef = refFromApiUrl(env.SUPABASE_TEST_URL);
  const dbRef = refFromDbUrl(env.SUPABASE_TEST_DB_URL);
  if (!sql.ok || !role.ok || !apiRef || !dbRef || !role.projectRef ||
      apiRef !== dbRef || apiRef !== role.projectRef ||
      !env.SUPABASE_TEST_PUBLISHABLE_KEY || !env.SUPABASE_TEST_SECRET_KEY ||
      (requireModel && !env.DEEPINFRA_API_KEY)) {
    return { ok: false, problem: 'Destino sintético no verificado; no se creó ningún dato ni proceso.' };
  }
  return { ok: true, projectRef: apiRef, roleUrl: role.connectionString };
}

function preflight({ requireModel = true } = {}) {
  // This is the same check as `npm run db:check:test`, with the DB URL required.
  const target = resolveTarget('test', { requireDbUrl: true });
  const checked = target.ok ? validateSeedTarget(target.env, { requireModel }) : { ok: false };
  if (!checked.ok || target.apiRef !== checked.projectRef || target.dbRef !== checked.projectRef) {
    throw new Error('Destino sintético no verificado; no se creó ningún dato ni proceso.');
  }
  return { env: target.env, roleUrl: checked.roleUrl };
}

function adminClient(env) {
  return createClient(env.SUPABASE_TEST_URL, env.SUPABASE_TEST_SECRET_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } });
}

function userClient(env) {
  return createClient(env.SUPABASE_TEST_URL, env.SUPABASE_TEST_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } });
}

function runEmail(id) { return `${RUN_EMAIL_PREFIX}${id}${RUN_EMAIL_SUFFIX}`; }

async function findRunUser(admin, id) {
  const email = runEmail(id);
  let witness = null;
  let match = null;
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data?.users) throw new Error('No se pudo enumerar la cuenta sintética.');
    for (const user of data.users) {
      if (user.email === email && user.user_metadata?.praxa_chat_run === id) {
        match = user;
      } else if (!witness) {
        witness = user.id;
      }
    }
    if (data.users.length < 1000) return { user: match, witness };
  }
  throw new Error('La enumeración de cuentas excedió el límite de seguridad.');
}

async function cleanRun(env, id) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(id)) {
    throw new Error('Identificador de corrida inválido.');
  }
  const admin = adminClient(env);
  const { user, witness } = await findRunUser(admin, id);
  if (!user) return { removedCompanies: 0, otherAccountIntact: Boolean(witness), alreadyAbsent: true };
  const { data: companies, error: readError } = await admin.from('companies')
    .select('id,name').eq('owner_id', user.id);
  if (readError || !companies || companies.some((row) => !row.name?.includes(id))) {
    throw new Error('La cuenta tiene empresas ajenas a la corrida; limpieza detenida.');
  }
  for (const company of companies) {
    const { error } = await admin.from('companies').delete().eq('id', company.id).eq('owner_id', user.id);
    if (error) throw new Error('No se pudo borrar la empresa sintética.');
  }
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) throw new Error('No se pudo borrar la cuenta sintética.');
  const after = await findRunUser(admin, id);
  if (after.user) throw new Error('La cuenta sintética sigue presente después de limpiar.');
  if (witness) {
    const { data, error: witnessError } = await admin.auth.admin.getUserById(witness);
    if (witnessError || data?.user?.id !== witness) throw new Error('No se verificó la otra cuenta.');
  }
  return { removedCompanies: companies.length, otherAccountIntact: Boolean(witness), alreadyAbsent: false };
}

function day(offset) {
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  now.setUTCDate(now.getUTCDate() - offset);
  return now.toISOString().slice(0, 10);
}

function attribution() {
  return { known: true, report_time: 'impression', unified: true, settings: [301, 302].map((id) => ({
    adset_external_id: String(id), windows: [{ event_type: 'click', days: 7 }],
  })) };
}

function entities(account, instant) {
  const definitions = [
    ['account', account, null, 'Cuenta sintética'],
    ['campaign', '201', account, 'Campaña sintética A'],
    ['campaign', '202', account, 'Campaña sintética B'],
    ['adset', '301', '201', 'Conjunto sintético A'],
    ['adset', '302', '202', 'Conjunto sintético B'],
    ['ad', '401', '301', 'Anuncio sintético A'],
    ['ad', '402', '302', 'Anuncio sintético B'],
  ];
  return definitions.map(([level, external_id, parent_external_id, name]) => ({
    level, external_id, parent_external_id, name, effective_status: 'ACTIVE',
    objective: level === 'campaign' ? 'OUTCOME_SALES' : null,
    metadata_fetched_at: instant, attribution: attribution(),
  }));
}

function dailyRows(level, ids, dates) {
  return dates.flatMap((date) => ids.map((external_id, index) => {
    const multiple = level === 'account' ? 3 : index + 1;
    return { date, level, external_id, spend: `${multiple * 2}.00`,
      impressions: String(multiple * 100), reach: String(multiple * 80),
      clicks: String(multiple * 10), inline_link_clicks: String(multiple * 8),
      ctr: '10.00', cpc: '0.20', cpm: '20.00', frequency: '1.25',
      actions: [{ action_type: 'purchase', variant: 'value', count: String(multiple),
        value: `${multiple * 10}.00` }],
    };
  }));
}

function breakdownRows(dimension, account, dates) {
  const segments = dimension === 'age_gender'
    ? [['25-34', 'female'], ['35-44', 'male']]
    : dimension === 'country' ? [['AR', null], ['UY', null]]
      : [['Región A', null], ['Región B', null]];
  return dates.flatMap((date) => segments.map(([segment_primary, segment_secondary], index) => ({
    date, external_id: account, segment_primary, segment_secondary,
    spend: `${index + 1}.00`, impressions: String((index + 1) * 50),
    clicks: String((index + 1) * 5), inline_link_clicks: String((index + 1) * 4),
    ctr: '10.00', cpc: '0.20', cpm: '20.00',
    actions: dimension === 'region' ? [] : [{ action_type: 'purchase', variant: 'value',
      count: String(index + 1), value: `${(index + 1) * 5}.00` }],
  })));
}

// `rich`: 60 días, cuatro campañas con objetivos distintos y desgloses variados (H-E1-235).
async function seedData(client, actor, company, id, { rich = false } = {}) {
  const connection = randomUUID();
  const account = `act_${randomInt(100_000_000, 999_999_999)}`;
  const query = (text, values) => client.query(text, values);
  await query(`select * from worker_api.create_pending_connection(
    $1::uuid,$2::uuid,$3::uuid,$4::text,$5::text,$6::text,$7::text,
    $8::integer,$9::text,$10::text,$11::text[],$12::timestamptz)`,
  [actor, company, connection, `synthetic_${id.slice(0, 8)}`,
    randomBytes(24).toString('base64'), randomBytes(12).toString('base64'),
    randomBytes(16).toString('base64'), 1, 'system_user', 'synthetic_app', ['ads_read'], null]);
  await query('select * from worker_api.confirm_connection($1::uuid,$2::uuid,$3::uuid,$4::text,$5::text,$6::text,$7::boolean)',
    [actor, company, connection, account, 'USD', 'UTC', true]);
  const run = randomUUID();
  const token = randomBytes(32).toString('hex');
  const length = rich ? RICH_DAYS : 7;
  const dates = Array.from({ length }, (_, index) => day(length - index));
  const limits = rich ? { ...LIMITS, lookbackDays: RICH_DAYS, maxWindowDays: RICH_DAYS,
    maxEntities: 40, maxPayloadBytes: 4_000_000 } : LIMITS;
  const started = await query(`select * from worker_api.start_sync_run(
    $1::uuid,$2::uuid,$3::uuid,$4::integer,$5::uuid,$6::text,$7::date,$8::date,$9::jsonb)`,
  [actor, company, connection, 0, run, token, dates[0], dates.at(-1), JSON.stringify(limits)]);
  const instant = started.rows[0]?.started_at?.toISOString();
  if (!instant) throw new Error('No se inició la siembra sintética.');
  const allEntities = rich ? richEntities(account, instant) : entities(account, instant);
  const byLevel = rich ? { ...richIds(), account: [account] } : {
    account: [account], campaign: ['201', '202'], adset: ['301', '302'], ad: ['401', '402'],
  };
  for (const level of LEVELS) {
    const maxRank = LEVELS.indexOf(level);
    const payload = { entities: allEntities.filter((item) => LEVELS.indexOf(item.level) <= maxRank),
      days: rich ? richDailyRows(level, account, dates) : dailyRows(level, byLevel[level], dates) };
    await query(`select * from worker_api.publish_snapshot(
      $1::uuid,$2::uuid,$3::uuid,$4::integer,$5::uuid,$6::text,$7::uuid,$8::text,
      $9::timestamptz,$10::integer,$11::integer,$12::jsonb)`,
    [actor, company, connection, 0, run, token, randomUUID(), level, instant, 1, 1,
      JSON.stringify(payload)]);
    if (level === 'campaign') {
      for (const dimension of DIMENSIONS) {
        await query(`select * from worker_api.publish_breakdown(
          $1::uuid,$2::uuid,$3::uuid,$4::integer,$5::uuid,$6::text,$7::uuid,$8::text,
          $9::text,$10::timestamptz,$11::integer,$12::integer,$13::jsonb)`,
        [actor, company, connection, 0, run, token, randomUUID(), 'account', dimension,
          instant, 1, 1, JSON.stringify({ rows: rich ? richBreakdownRows(dimension, account, dates)
            : breakdownRows(dimension, account, dates) })]);
      }
    }
  }
  return connection;
}

async function serve(env, roleUrl, { rich = false } = {}) {
  const id = randomUUID();
  const email = runEmail(id);
  const password = `${randomBytes(24).toString('base64url')}Aa1!`;
  const admin = adminClient(env);
  let created = false;
  let sql;
  try {
    const { data, error } = await admin.auth.admin.createUser({ email, password,
      email_confirm: true, user_metadata: { praxa_chat_run: id } });
    if (error || !data?.user) throw new Error('No se pudo crear la cuenta sintética.');
    created = true;
    const user = userClient(env);
    const signIn = await user.auth.signInWithPassword({ email, password });
    if (signIn.error) throw new Error('No se pudo iniciar sesión sintética.');
    const company = await user.rpc('create_company_for_current_user',
      { p_name: `Empresa sintética de chat ${id}` }).single();
    if (company.error || !company.data?.id) throw new Error('No se pudo crear la empresa sintética.');
    sql = new pg.Client({ connectionString: roleUrl.split('?')[0], ...supabaseTlsConfig(),
      application_name: 'praxa-chat-seed-test' });
    await sql.connect();
    await sql.query(`set statement_timeout = ${rich ? 90000 : 15000}`);
    await sql.query('set lock_timeout = 15000');
    await seedData(sql, data.user.id, company.data.id, id, { rich });
    await sql.end();
    sql = null;
    console.log(`Corrida sintética: ${id}`);
    console.log(`Correo local: ${email}`);
    console.log(`Contraseña local: ${password}`);
    console.log('Al cortar Next se limpiará esta corrida. Si el proceso se corta abruptamente, usá --clean con su identificador.');
    const nextBin = fileURLToPath(import.meta.resolve('next/dist/bin/next'));
    const child = spawn(process.execPath, [nextBin, 'dev'], { cwd: process.cwd(), stdio: 'inherit',
      env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: env.SUPABASE_TEST_URL,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: env.SUPABASE_TEST_PUBLISHABLE_KEY,
        PRAXA_INTEGRATIONS_DB_URL: roleUrl, DEEPINFRA_API_KEY: env.DEEPINFRA_API_KEY } });
    const stop = () => child.kill();
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    try {
      await new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('exit', (code) => code === 0 || code === null ? resolve() : reject(new Error('Next terminó con error.')));
      });
    } finally {
      process.off('SIGINT', stop);
      process.off('SIGTERM', stop);
    }
  } finally {
    try {
      if (sql) await sql.end();
    } finally {
      if (created) {
        const result = await cleanRun(env, id);
        console.log(`Limpieza sintética: ${result.alreadyAbsent ? 'ya estaba ausente' : `${result.removedCompanies} empresa(s) borrada(s)`}; otra cuenta ${result.otherAccountIntact ? 'intacta' : 'sin testigo disponible'}.`);
      }
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const serveRich = args.length === 2 && args[0] === '--serve' && args[1] === '--rich';
  if (!((args.length === 1 && args[0] === '--serve') || serveRich ||
        (args.length === 2 && args[0] === '--clean'))) {
    throw new Error('Usá --serve, --serve --rich o --clean <identificador>.');
  }
  const { env, roleUrl } = preflight({ requireModel: args[0] === '--serve' });
  if (args[0] === '--clean') {
    const result = await cleanRun(env, args[1]);
    console.log(`Limpieza sintética: ${result.alreadyAbsent ? 'ya estaba ausente' : `${result.removedCompanies} empresa(s) borrada(s)`}; otra cuenta ${result.otherAccountIntact ? 'intacta' : 'sin testigo disponible'}.`);
    return;
  }
  await serve(env, roleUrl, { rich: serveRich });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch(() => {
    console.error('La operación sintética falló. Revisá el destino de pruebas y usá --clean si la corrida quedó abierta.');
    process.exitCode = 1;
  });
}
