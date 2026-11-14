import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  composeDocument,
  documentTexts,
  parseStoredReport,
  pdfFileName,
  type DiagnosticDocument,
} from '@/modules/diagnostics/compose';
import { pdfTree, renderDiagnosticPdf, treeTexts } from '@/modules/diagnostics/pdf';
import { storedReportFixture } from '../eval/fixtures/diagnostics';

/**
 * M26a-T-24: pantalla y PDF consumen el mismo modelo de documento; se compara el árbol de
 * elementos del PDF con el modelo antes de renderizar y se verifican los bytes. Informes
 * sintéticos armados con un modelo simulado: sin llamadas pagas.
 */

let doc: DiagnosticDocument;
let large: DiagnosticDocument;

beforeAll(async () => {
  doc = composeDocument(parseStoredReport(await storedReportFixture()));
  large = composeDocument(parseStoredReport(await storedReportFixture({ large: true })));
});

function pageCount(bytes: Uint8Array): number {
  return (Buffer.from(bytes).toString('latin1').match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length;
}

describe('M26a-T-24: modelo de documento compartido', () => {
  it('plantilla de secciones fijas', () => {
    expect(doc.sections.map((s) => s.title)).toEqual([
      'Resumen ejecutivo', 'Rendimiento general', 'Comparación con el período anterior', 'Entidades destacadas',
      'Desgloses (estimaciones de Meta)', 'Oportunidades', 'Contexto web', 'Límites de los datos',
      'Cobertura y metodología', 'Evidencia citada',
    ]);
  });

  it('trae fecha, ventana, cobertura, evidencia, rótulos y la sección web no evaluable con su causa', () => {
    const texts = documentTexts(doc).join('\n');
    expect(texts).toContain('Generado: 13/11/2026');
    expect(texts).toContain('16/10/2026 al 12/11/2026');
    expect(texts).toContain('atribuido por Meta');
    expect(texts).toContain('Estimación de Meta');
    expect(texts).toContain('Interpretación de Claude');
    expect(texts).toContain('No evaluable: no hubo fuentes web válidas para este informe.');
    expect(texts).toContain('USD 294,00');
    expect(texts).toContain('ev_acct_cur_spend');
    expect(texts).toContain('meta-diag-1');
  });

  it('la atribución anterior conocida no rotula como conocida la ventana actual desconocida', async () => {
    const fixture = await storedReportFixture();
    const withKnownPrevious = parseStoredReport({ ...fixture, evidence: { ...fixture.evidence,
      items: fixture.evidence.items.map((item) => item.id === 'ev_acct_prev_result_count'
        ? { ...item, attribution: `attr_${'a'.repeat(32)}` } : item) } });
    const currentLabel = composeDocument(withKnownPrevious).meta.find((item) => item.label === 'Atribución');
    expect(currentLabel?.value).toBe('no informada por Meta');
  });

  it('con la atribución actual conocida y la anterior desconocida, el aviso no contradice la cabecera', async () => {
    const fixture = await storedReportFixture();
    const stored = parseStoredReport({ ...fixture, evidence: { ...fixture.evidence,
      items: fixture.evidence.items.map((item) => item.level === 'account' && item.segment === null
        && item.period.from === fixture.window_from && item.attribution === 'unknown'
        ? { ...item, attribution: `attr_${'a'.repeat(32)}` } : item) } });
    expect(stored.evidence.items.some((e) => e.level === 'account' && e.segment === null
      && e.period.from === stored.prev_from && e.attribution === 'unknown')).toBe(true);
    const rendered = composeDocument(stored);
    expect(rendered.meta.find((item) => item.label === 'Atribución')?.value).toBe('configuración informada por Meta');
    const notices = rendered.sections.find((s) => s.id === 'performance')!.blocks
      .filter((b) => b.kind === 'notice').map((b) => (b as { text: string }).text);
    expect(notices).not.toContain('Meta no informa con qué atribución contó estos resultados: pueden mezclar ventanas distintas.');
    expect(notices.some((t) => t.startsWith('En el período anterior, Meta no informa'))).toBe(true);
  });

  it('muestra las ventanas congeladas en pantalla y PDF desde el informe persistido', async () => {
    const fixture = await storedReportFixture();
    const stored = parseStoredReport({ ...fixture, evidence: { ...fixture.evidence,
      totals: { ...fixture.evidence.totals, attribution_windows: [
        { event_type: 'click', days: 7 }, { event_type: 'view', days: 1 },
      ] }, items: fixture.evidence.items.map((item) => item.id === 'ev_acct_cur_result_count'
        ? { ...item, attribution: `attr_${'a'.repeat(32)}` } : item) } });
    const rendered = composeDocument(stored);
    const windows = rendered.meta.find((item) => item.label === 'Ventanas de atribución');
    expect(windows?.value).toContain('7 días');
    expect(windows?.value).toContain('1 día');
    expect(treeTexts(pdfTree(rendered))).toContain(`Ventanas de atribución: ${windows?.value}`);
  });

  it('advierte si las ventanas informadas cubren solo parte de los datos', async () => {
    const fixture = await storedReportFixture();
    const stored = parseStoredReport({ ...fixture, evidence: { ...fixture.evidence,
      totals: { ...fixture.evidence.totals,
        attribution_windows: [{ event_type: 'click', days: 7 }] } } });
    const windows = composeDocument(stored).meta.find((item) => item.label === 'Ventanas de atribución');
    expect(windows?.value).toContain('observadas en parte de los datos; otras no informadas por Meta');
  });

  it('nunca lleva identificadores de entidad, de cuenta ni marcadores sin sustituir', () => {
    const json = JSON.stringify(doc) + JSON.stringify(large);
    expect(json).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-/);
    expect(json).not.toMatch(/act_\d/);
    const texts = [...documentTexts(doc), ...documentTexts(large)];
    expect(texts.filter((t) => /\[\[|\]\]/.test(t))).toEqual([]);
  });

  it('el nombre del archivo lleva solo la fecha', () => {
    expect(pdfFileName(parseStoredReportSync())).toBe('diagnostico-meta-2026-11-13.pdf');
  });
});

let stored: Awaited<ReturnType<typeof storedReportFixture>>;
beforeAll(async () => { stored = await storedReportFixture(); });
function parseStoredReportSync() { return parseStoredReport(stored); }

describe('M26a-T-24: árbol del PDF igual al modelo', () => {
  it('los textos del árbol son exactamente los del modelo, en orden', () => {
    expect(treeTexts(pdfTree(doc))).toEqual(documentTexts(doc));
    expect(treeTexts(pdfTree(large))).toEqual(documentTexts(large));
  });

  it('acentos y «ñ» presentes en el árbol del informe máximo', () => {
    const texts = treeTexts(pdfTree(large)).join(' ');
    expect(texts).toContain('Ñandú');
    expect(texts).toContain('Córdoba');
    expect(texts).toContain('España');
  });

  it('las páginas permiten continuar en la siguiente', () => {
    const tree = pdfTree(large);
    const pages = (tree.props as { children: unknown }).children;
    const list = Array.isArray(pages) ? pages : [pages];
    for (const page of list) expect((page as { props: { wrap?: boolean } }).props.wrap).not.toBe(false);
  });
});

describe('M26a-T-24: bytes del PDF', () => {
  it('genera un PDF válido', async () => {
    const bytes = await renderDiagnosticPdf(doc);
    const text = Buffer.from(bytes).toString('latin1');
    expect(text.startsWith('%PDF-')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
  }, 60_000);

  it('el informe máximo ocupa más de una página sin perder texto', async () => {
    const bytes = await renderDiagnosticPdf(large);
    expect(pageCount(bytes)).toBeGreaterThan(1);
  }, 120_000);
});
