/** VR-02 ampliada M25a.3: solo preguntas y valores sintéticos; congelar antes de ejecutar. */
export type ExpandedCase = Readonly<{
  id: string;
  question: string;
  previous?: readonly string[];
  pendingClarification?: string;
  expected: Readonly<{
    kind: 'answer' | 'abstention' | 'clarification';
    tool: string | null;
    metric: string | null;
    period: { from: string; to: string } | null;
    block: string | null;
    answer: string;
    value?: string;
    reason?: string;
    allowClarification?: boolean;
    requireDefaulted?: boolean;
  }>;
}>;

const a = { from: '2026-01-01', to: '2026-01-07' };
const empty = { from: '2024-01-01', to: '2024-01-07' };
const answer = (id: string, question: string, tool: string | null,
  metric: string | null, block: string, value?: string): ExpandedCase => ({
  id, question, expected: { kind: 'answer', tool, metric, period: a,
    block, answer: block, value },
});
const abstain = (id: string, question: string, reason: string,
  period: typeof a | null = null): ExpandedCase => ({
  id, question, expected: { kind: 'abstention', tool: reason === 'no_coverage' ?
    'coverage' : null, metric: null, period, block: null,
  answer: 'abstención', reason },
});

export const expandedCases: readonly ExpandedCase[] = [
  // Los 19 tipos visuales, con fuente y métrica esperadas.
  answer('E01', 'Mostrame el gasto de la cuenta como tarjeta del 1 al 7 de enero de 2026.', 'total', 'spend', 'tarjeta', '12.50'),
  answer('E02', 'Graficá el gasto diario con líneas del 1 al 7 de enero de 2026.', 'daily_series', 'spend', 'lineas'),
  answer('E03', 'Quiero barras de impresiones por día del 1 al 7 de enero de 2026.', 'daily_series', 'impressions', 'barras'),
  { ...answer('E04', 'Compará el gasto de las dos primeras semanas de enero de 2026 con barras agrupadas.', 'compare_periods', 'spend', 'barras_agrupadas'),
    expected: { kind: 'answer', tool: 'compare_periods', metric: 'spend', period: null,
      block: 'barras_agrupadas', answer: 'barras_agrupadas' } },
  answer('E05', 'Mostrame una dona del gasto por país del 1 al 7 de enero de 2026.', 'breakdown', 'spend', 'dona'),
  answer('E06', 'Necesito la tabla de clics diarios del 1 al 7 de enero de 2026.', 'daily_series', 'clicks', 'tabla'),
  { ...answer('E07', 'Resumí la variación porcentual de gasto entre las dos primeras semanas de enero de 2026.', 'percent_change', 'spend', 'resumen_variacion', '20.000000'),
    expected: { kind: 'answer', tool: 'percent_change', metric: 'spend', period: null,
      block: 'resumen_variacion', answer: 'resumen_variacion', value: '20.000000' } },
  { ...answer('E08', 'Mostrame período contra período para impresiones en las dos primeras semanas de enero de 2026.', 'compare_periods', 'impressions', 'periodo_contra_periodo'),
    expected: { kind: 'answer', tool: 'compare_periods', metric: 'impressions', period: null,
      block: 'periodo_contra_periodo', answer: 'periodo_contra_periodo' } },
  answer('E09', 'Apilá en barras el gasto diario de las campañas del 1 al 7 de enero de 2026.', 'daily_series', 'spend', 'barras_apiladas'),
  answer('E10', 'Ordená las campañas por gasto del 1 al 7 de enero de 2026 en un ranking.', 'ranking', 'spend', 'ranking'),
  answer('E11', 'Quiero una tabla de tendencia de campañas ordenadas por clics del 1 al 7 de enero de 2026.', 'ranking', 'clicks', 'tabla_tendencia'),
  answer('E12', 'Mostrame una tabla desplegable de campañas y conjuntos según gasto del 1 al 7 de enero de 2026.', 'ranking', 'spend', 'tabla_desplegable'),
  answer('E13', 'Mostrame un embudo de impresiones y clics de la cuenta del 1 al 7 de enero de 2026, sin tasas de paso.', 'total', 'impressions', 'embudo'),
  answer('E14', 'Mostrame un calendario de calor de clics diarios del 1 al 7 de enero de 2026.', 'daily_series', 'clicks', 'calendario_calor'),
  answer('E15', 'Desglosá los tipos de resultado de la cuenta del 1 al 7 de enero de 2026.', 'action_types', null, 'desglose_tipo_resultado'),
  answer('E16', 'Mostrame el estado de datos de la cuenta del 1 al 7 de enero de 2026.', 'coverage', null, 'estado_datos'),
  answer('E17', 'Dame conclusiones descriptivas respaldadas sobre el gasto del 1 al 7 de enero de 2026.', 'total', 'spend', 'conclusiones'),
  answer('E18', 'Mostrame fuentes y metodología del gasto del 1 al 7 de enero de 2026.', 'total', 'spend', 'fuentes_metodologia'),
  answer('E19', 'Consultá mi gasto del 1 al 7 de enero de 2026 y agregá preguntas sugeridas.', 'total', 'spend', 'preguntas_sugeridas'),

  // Los seis cálculos SQL, las tres dimensiones y límites de atribución.
  answer('E20', 'Calculá el promedio diario de clics del 1 al 7 de enero de 2026.', 'daily_average', 'clicks', 'tarjeta', '3.428571'),
  answer('E21', 'Calculá el costo por compra del 1 al 7 de enero de 2026.', 'cost_per_result', null, 'tarjeta', '12.50'),
  answer('E22', '¿Qué participación tiene una campaña en el gasto de la cuenta del 1 al 7 de enero de 2026?', 'share', 'spend', 'tarjeta', '40.000000'),
  answer('E23', 'Barras agrupadas de gasto por edad y género del 1 al 7 de enero de 2026.', 'breakdown', 'spend', 'barras_agrupadas'),
  answer('E24', 'Mostrame gasto por región en tabla del 1 al 7 de enero de 2026.', 'breakdown', 'spend', 'tabla'),
  answer('E25', 'Mostrame gasto por país, incluidos los segmentos sin rótulo, del 1 al 7 de enero de 2026.', 'breakdown', 'spend', 'tabla'),
  answer('E26', 'Mostrame compras de la cuenta del 1 al 7 de enero de 2026 aunque Meta no informe la atribución.', 'total', 'action_count', 'tarjeta', '4'),
  { id: 'E27', question: 'Consultá las compras de una campaña del 1 al 7 de enero de 2026 con atribuciones incompatibles dentro de ella.',
    expected: { kind: 'answer', tool: 'total', metric: 'action_count', period: a,
      block: null, answer: 'límite de atribución' } },
  answer('E28', 'Ordená campañas por compras del 1 al 7 de enero de 2026 aunque tengan ventanas de atribución distintas.', 'ranking', 'action_count', 'ranking'),

  // Ambigüedad, continuación e historia limitada al turno, más abstenciones.
  { ...answer('E29', 'Ahora mostralo como líneas.', 'daily_series', 'spend', 'lineas'),
    expected: { kind: 'answer', tool: 'daily_series', metric: 'spend',
      period: { from: '2026-01-08', to: '2026-01-14' }, block: 'lineas',
      answer: 'lineas', allowClarification: true, requireDefaulted: true },
    previous: ['Mostrame el gasto diario del 1 al 7 de enero de 2026.'] },
  { ...answer('E30', 'Gasto diario de la cuenta del 1 al 7 de enero de 2026.', 'daily_series', 'spend', 'lineas'),
    pendingClarification: '¿Querés el total o la evolución diaria?' },
  { id: 'E31', question: 'Compará esas dos cosas.',
    expected: { kind: 'clarification', tool: null, metric: null, period: null,
      block: null, answer: 'aclaración' } },
  { id: 'E32', question: '¿Cuál rindió mejor?',
    expected: { kind: 'clarification', tool: null, metric: null, period: null,
      block: null, answer: 'aclaración' } },
  { ...answer('E33', 'Ahora en una tabla.', 'daily_series', 'clicks', 'tabla'),
    expected: { kind: 'answer', tool: 'daily_series', metric: 'clicks',
      period: { from: '2026-01-08', to: '2026-01-14' }, block: 'tabla',
      answer: 'tabla', allowClarification: true, requireDefaulted: true },
    previous: ['Mostrame clics diarios del 1 al 7 de enero de 2026.',
      '¿Y en barras?', 'Desglosá por día.'] },
  abstain('E34', '¿Cuánto gasté del 1 al 7 de enero de 2024?', 'no_coverage', empty),
  abstain('E35', 'Modificá el presupuesto de esta campaña.', 'out_of_scope'),
  abstain('E36', 'Decime el ROAS de estas campañas.', 'out_of_scope'),
  abstain('E37', 'Buscá resultados de una empresa ajena.', 'out_of_scope'),
  abstain('E38', 'Explicame la causa exacta de la baja de ventas.', 'out_of_scope'),
  abstain('E39', 'Pronosticá las compras del próximo mes.', 'out_of_scope'),
  abstain('E40', 'Publicá un anuncio nuevo con estos datos.', 'out_of_scope'),
];
