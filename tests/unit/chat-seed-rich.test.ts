import { describe, expect, it } from 'vitest';

import {
  RICH_DAYS, richBreakdownRows, richDailyRows, richEntities, richIds,
} from '../../scripts/lib/chat-seed-rich.mjs';

// Espejo de las reglas de 0016/0017 (decimales, conteos, claves exactas, unicidad).
const DECIMAL = /^[0-9]+([.][0-9]+)?$/u;
const COUNT = /^[0-9]+$/u;
const ACCOUNT = 'act_123456789';
const LEVELS = ['account', 'campaign', 'adset', 'ad'] as const;
const DAY_KEYS = ['date', 'level', 'external_id', 'spend', 'impressions', 'reach', 'clicks',
  'inline_link_clicks', 'ctr', 'cpc', 'cpm', 'frequency', 'actions'].sort();

function dates(): string[] {
  const out: string[] = [];
  const base = Date.UTC(2026, 0, 1);
  for (let i = 0; i < RICH_DAYS; i++) out.push(new Date(base + i * 86_400_000).toISOString().slice(0, 10));
  return out;
}

const DATES = dates();
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const cents = (value: string) => Math.round(Number(value) * 100);

function rows(level: (typeof LEVELS)[number]) {
  return richDailyRows(level, ACCOUNT, DATES) as Row[];
}

describe('chat-seed-rich: filas diarias', () => {
  it.each(LEVELS)('el nivel %s cumple el formato de la base', (level) => {
    const list = rows(level);
    expect(list.length).toBeGreaterThan(0);
    const seen = new Set<string>();
    for (const row of list) {
      expect(Object.keys(row).sort()).toEqual(DAY_KEYS);
      expect(row.level).toBe(level);
      expect(DATES).toContain(row.date);
      for (const key of ['spend', 'ctr', 'cpm', 'frequency']) expect(row[key]).toMatch(DECIMAL);
      if (row.cpc !== null) expect(row.cpc).toMatch(DECIMAL);
      for (const key of ['impressions', 'reach', 'clicks', 'inline_link_clicks']) expect(row[key]).toMatch(COUNT);
      expect(Number(row.reach)).toBeLessThanOrEqual(Number(row.impressions));
      expect(Number(row.clicks)).toBeLessThanOrEqual(Number(row.impressions));
      const types = new Set<string>();
      for (const action of row.actions) {
        expect(Object.keys(action).sort()).toEqual(['action_type', 'count', 'value', 'variant']);
        expect(action.action_type).toMatch(/^[A-Za-z0-9._]{1,128}$/u);
        expect(action.count).toMatch(COUNT);
        if (action.value !== null) expect(action.value).toMatch(DECIMAL);
        types.add(`${action.action_type}|${action.variant}`);
      }
      expect(types.size).toBe(row.actions.length);
      const key = `${row.external_id}|${row.date}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('cada nivel suma exactamente a sus hijos, día por día', () => {
    const sumByDay = (child: Row[], parentOf: (id: string) => string) => {
      const out = new Map<string, number>();
      for (const row of child) {
        const key = `${parentOf(row.external_id)}|${row.date}`;
        out.set(key, (out.get(key) ?? 0) + cents(row.spend));
      }
      return out;
    };
    const ids = richIds();
    const entities = richEntities(ACCOUNT, '2026-01-01T00:00:00.000Z');
    const parent = new Map(entities.map((e: Row) => [e.external_id, e.parent_external_id]));
    expect(ids.ad.length).toBe(8);
    for (const [childLevel, parentLevel] of [['ad', 'adset'], ['adset', 'campaign'], ['campaign', 'account']] as const) {
      const sums = sumByDay(rows(childLevel), (id) => parent.get(id) as string);
      for (const row of rows(parentLevel)) {
        expect(sums.get(`${row.external_id}|${row.date}`)).toBe(cents(row.spend));
      }
    }
  });

  it('tiene ausencias reales: una pausa y una campaña que empieza tarde', () => {
    const paused = rows('ad').filter((row) => row.external_id === '405').map((row) => row.date);
    expect(paused).not.toContain(DATES[22]);
    expect(paused).not.toContain(DATES[25]);
    expect(paused).toContain(DATES[21]);
    expect(paused).toContain(DATES[26]);
    const awareness = rows('campaign').filter((row) => row.external_id === '203').map((row) => row.date);
    expect(awareness).not.toContain(DATES[17]);
    expect(awareness).toContain(DATES[18]);
    expect(awareness.length).toBe(RICH_DAYS - 18);
  });

  it('muestra variación real: tendencia, fin de semana y promo', () => {
    const account = rows('account');
    const spend = account.map((row) => Number(row.spend));
    expect(Math.max(...spend) / Math.min(...spend)).toBeGreaterThan(1.3);
    const promoDay = account.find((row) => row.date === DATES[41])!;
    const normalDay = account.find((row) => row.date === DATES[38])!;
    expect(Number(promoDay.spend)).toBeGreaterThan(Number(normalDay.spend) * 1.15);
    const fatigued = rows('ad').filter((row) => row.external_id === '402');
    expect(Number(fatigued.at(-1)!.ctr)).toBeLessThan(Number(fatigued[0].ctr));
    const purchase = (row: Row) => row.actions.find((a: Row) => a.action_type === 'purchase');
    expect(rows('campaign').filter((row) => row.external_id === '204').every((row) => !purchase(row))).toBe(true);
    expect(rows('campaign').filter((row) => row.external_id === '201').every((row) => purchase(row))).toBe(true);
  });

  it('es determinista', () => {
    expect(JSON.stringify(richDailyRows('ad', ACCOUNT, DATES))).toBe(JSON.stringify(richDailyRows('ad', ACCOUNT, [...DATES])));
  });

  it('cabe en los topes que usa la siembra', () => {
    for (const level of LEVELS) {
      expect(JSON.stringify({ entities: [], days: rows(level) }).length).toBeLessThan(4_000_000);
    }
  });
});

describe('chat-seed-rich: entidades', () => {
  const entities = richEntities(ACCOUNT, '2026-01-01T00:00:00.000Z') as Row[];

  it('respeta el tope de entidades, el parentesco y los objetivos', () => {
    expect(entities.length).toBeLessThanOrEqual(40);
    const key = (e: Row) => `${e.level}|${e.external_id}`;
    expect(new Set(entities.map(key)).size).toBe(entities.length);
    const parentLevel: Record<string, string> = { campaign: 'account', adset: 'campaign', ad: 'adset' };
    for (const e of entities) {
      if (e.level === 'account') { expect(e.parent_external_id).toBeNull(); continue; }
      expect(entities.some((p) => p.level === parentLevel[e.level] && p.external_id === e.parent_external_id)).toBe(true);
      if (e.level !== 'campaign') expect(e.objective).toBeNull();
      else expect(e.objective).toMatch(/^OUTCOME_/u);
      expect(e.external_id).toMatch(/^[0-9]{1,32}$/u);
    }
  });

  it('la atribución declara una configuración por conjunto', () => {
    for (const e of entities) {
      expect(e.attribution.known).toBe(true);
      expect(e.attribution.settings.length).toBe(5);
    }
  });
});

describe('chat-seed-rich: desgloses', () => {
  it.each(['age_gender', 'country', 'region'])('%s cumple el formato y suma cerca del total de la cuenta', (dimension) => {
    const list = richBreakdownRows(dimension, ACCOUNT, DATES) as Row[];
    const seen = new Set<string>();
    const spendByDay = new Map<string, number>();
    for (const row of list) {
      expect(Object.keys(row).sort()).toEqual(['actions', 'clicks', 'cpc', 'cpm', 'ctr', 'date', 'external_id',
        'impressions', 'inline_link_clicks', 'segment_primary', 'segment_secondary', 'spend']);
      if (dimension === 'age_gender') expect(typeof row.segment_secondary).toBe('string');
      else expect(row.segment_secondary).toBeNull();
      if (dimension === 'region') expect(row.actions).toEqual([]);
      for (const key of ['spend', 'ctr', 'cpm']) expect(row[key]).toMatch(DECIMAL);
      for (const key of ['impressions', 'clicks', 'inline_link_clicks']) expect(row[key]).toMatch(COUNT);
      const key = `${row.date}|${row.segment_primary}|${row.segment_secondary ?? ''}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      spendByDay.set(row.date, (spendByDay.get(row.date) ?? 0) + cents(row.spend));
    }
    for (const account of rows('account')) {
      const total = cents(account.spend);
      expect(Math.abs((spendByDay.get(account.date) ?? 0) - total)).toBeLessThanOrEqual(Math.max(5, total * 0.01));
    }
  });
});
