import 'server-only';

import { Document, Page, renderToBuffer, StyleSheet, Text, View } from '@react-pdf/renderer';
import { createElement as h, isValidElement, type ReactElement, type ReactNode } from 'react';

import { composeDocument, pdfFileName, type DiagnosticDocument, type DocBlock, type StoredReport } from './compose';

/**
 * PDF del diagnóstico (M26a, Diseño §5). Se arma en el servidor desde el mismo modelo de documento
 * que ve la pantalla, sin llamar al modelo y sin guardarlo. Helvetica (WinAnsi) cubre acentos,
 * «ñ», rayas y comillas latinas. Las páginas continúan (`wrap`); las filas de tabla no se cortan
 * y los títulos piden espacio por delante para no quedar solos al pie.
 */

const styles = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 56, paddingHorizontal: 40, fontSize: 9.5, fontFamily: 'Helvetica',
    color: '#1f2328', lineHeight: 1.4 },
  title: { fontSize: 18, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  subtitle: { fontSize: 9.5, color: '#57606a', marginBottom: 10 },
  meta: { fontSize: 9, marginBottom: 2 },
  section: { marginTop: 14 },
  sectionTitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginBottom: 6 },
  subheading: { fontSize: 10.5, fontFamily: 'Helvetica-Bold', marginTop: 8, marginBottom: 4 },
  label: { fontSize: 8, color: '#57606a', fontFamily: 'Helvetica-Oblique', marginTop: 4 },
  paragraph: { marginBottom: 4 },
  notice: { fontSize: 8.5, color: '#57606a', marginVertical: 3 },
  item: { marginBottom: 2, marginLeft: 8 },
  table: { marginVertical: 4, borderTopWidth: 0.5, borderColor: '#d0d7de' },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderColor: '#d0d7de' },
  head: { fontFamily: 'Helvetica-Bold', backgroundColor: '#f6f8fa' },
  cell: { flex: 1, padding: 3, fontSize: 8 },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, fontSize: 7.5, color: '#57606a' },
});

function table(columns: readonly string[], rows: readonly (readonly string[])[], key: string): ReactElement {
  return h(View, { key, style: styles.table },
    h(View, { style: [styles.row, styles.head], wrap: false },
      ...columns.map((c, i) => h(Text, { key: `h${i}`, style: styles.cell }, c))),
    ...rows.map((row, r) => h(View, { key: `r${r}`, style: styles.row, wrap: false },
      ...row.map((cell, i) => h(Text, { key: `c${i}`, style: styles.cell }, cell)))));
}

function block(b: DocBlock, key: string): ReactElement[] {
  switch (b.kind) {
    case 'paragraph':
      return [...(b.label ? [h(Text, { key: `${key}l`, style: styles.label, minPresenceAhead: 24 }, b.label)] : []),
        h(Text, { key, style: styles.paragraph }, b.text)];
    case 'subheading':
      return [h(Text, { key, style: styles.subheading, minPresenceAhead: 48 }, b.text)];
    case 'notice':
      return [h(Text, { key, style: styles.notice }, b.text)];
    case 'list':
      return b.items.map((item, i) => h(Text, { key: `${key}-${i}`, style: styles.item }, item));
    case 'table':
      return [table(b.columns, b.rows, key)];
  }
}

/** Árbol de elementos del PDF; las pruebas lo comparan con el modelo antes de renderizar. */
export function pdfTree(doc: DiagnosticDocument): ReactElement {
  return h(Document, { title: doc.title, author: 'PRAXA', language: 'es-AR' },
    h(Page, { size: 'A4', style: styles.page, wrap: true },
      h(Text, { style: styles.title }, doc.title),
      h(Text, { style: styles.subtitle }, doc.subtitle),
      ...doc.meta.map((m, i) => h(Text, { key: `m${i}`, style: styles.meta }, `${m.label}: ${m.value}`)),
      ...doc.sections.map((s) => h(View, { key: s.id, style: styles.section },
        h(Text, { style: styles.sectionTitle, minPresenceAhead: 64 }, s.title),
        ...s.blocks.flatMap((b, i) => block(b, `${s.id}-${i}`)))),
      h(Text, { style: styles.footer, fixed: true }, doc.footer)));
}

/** Textos de los elementos `Text` del árbol, en orden de documento. */
export function treeTexts(node: ReactNode): string[] {
  if (Array.isArray(node)) return node.flatMap(treeTexts);
  if (!isValidElement(node)) return [];
  const props = node.props as { children?: ReactNode };
  if (node.type === Text) {
    const children = Array.isArray(props.children) ? props.children : [props.children];
    return [children.filter((c) => typeof c === 'string' || typeof c === 'number').join('')];
  }
  return treeTexts(props.children);
}

export async function renderDiagnosticPdf(doc: DiagnosticDocument): Promise<Uint8Array> {
  return new Uint8Array(await renderToBuffer(pdfTree(doc) as Parameters<typeof renderToBuffer>[0]));
}

const NO_STORE = { 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' } as const;

/**
 * Respuesta de `GET /app/diagnostico/descargar`. Sin sesión redirige al login; sin informe visible
 * (la política exige conexión vigente), 404 con texto fijo. Nunca lleva IDs en la URL ni en el
 * nombre del archivo.
 */
export async function diagnosticDownload(input: {
  requestUrl: string;
  getUser: () => Promise<{ id: string } | null>;
  readReport: () => Promise<StoredReport | null>;
}): Promise<Response> {
  const user = await input.getUser();
  if (!user) return Response.redirect(new URL('/login?next=%2Fapp%2Fdiagnostico', input.requestUrl).toString(), 307);
  let report: StoredReport | null;
  try { report = await input.readReport(); } catch {
    return new Response('No se pudo leer el diagnóstico.', { status: 500,
      headers: { 'content-type': 'text/plain; charset=utf-8', ...NO_STORE } });
  }
  if (!report) {
    return new Response('No hay un diagnóstico disponible para descargar.', { status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8', ...NO_STORE } });
  }
  const bytes = await renderDiagnosticPdf(composeDocument(report));
  return new Response(new Blob([bytes as BlobPart], { type: 'application/pdf' }), { status: 200, headers: {
    'content-type': 'application/pdf',
    'content-disposition': `attachment; filename="${pdfFileName(report)}"`,
    ...NO_STORE,
  } });
}
