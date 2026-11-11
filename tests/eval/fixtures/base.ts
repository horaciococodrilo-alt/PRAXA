/** VR-02 base M25a.2: preguntas y datos completamente sintéticos. Congelar antes de ejecutar. */
export type BaseCase = Readonly<{
  id: string; question: string; expected: Readonly<{
    kind: 'answer' | 'abstention'; tool: string | null; metric: string | null;
    period: { from: string; to: string } | null; answer: string;
    reason?: string;
  }>;
}>;

const a = { from: '2026-01-01', to: '2026-01-07' };
const b = { from: '2026-01-08', to: '2026-01-14' };
const empty = { from: '2024-01-01', to: '2024-01-07' };
const yes = (id: string, question: string, tool: 'total' | 'daily_series',
  metric: 'spend' | 'impressions' | 'clicks', period: typeof a,
  answer: string): BaseCase => ({ id, question,
    expected: { kind: 'answer', tool, metric, period, answer } });
const no = (id: string, question: string, reason: string,
  period: typeof a | null = null): BaseCase => ({ id, question,
    expected: { kind: 'abstention', tool: reason === 'no_coverage' ? 'coverage' : null,
      metric: null, period, answer: 'abstención', reason } });

export const baseCases: readonly BaseCase[] = [
  yes('A01', '¿Cuánto gasté del 1 al 7 de enero de 2026?', 'total', 'spend', a, '12,50 USD'),
  yes('A02', 'Mostrame el gasto total entre el 1 y el 7 de enero de 2026.', 'total', 'spend', a, '12,50 USD'),
  yes('A03', '¿Cuál fue el gasto acumulado del 1 al 7 de enero de 2026?', 'total', 'spend', a, '12,50 USD'),
  yes('A04', 'Gasto de la cuenta del 1 al 7 de enero de 2026.', 'total', 'spend', a, '12,50 USD'),
  yes('A05', '¿Qué importe se gastó del 1 al 7 de enero de 2026?', 'total', 'spend', a, '12,50 USD'),
  yes('A06', '¿Cuántas impresiones hubo del 1 al 7 de enero de 2026?', 'total', 'impressions', a, '120 impresiones'),
  yes('A07', 'Total de impresiones del 1 al 7 de enero de 2026.', 'total', 'impressions', a, '120 impresiones'),
  yes('A08', 'Mostrame las impresiones acumuladas del 1 al 7 de enero de 2026.', 'total', 'impressions', a, '120 impresiones'),
  yes('A09', '¿Qué cantidad de impresiones registró la cuenta del 1 al 7 de enero de 2026?', 'total', 'impressions', a, '120 impresiones'),
  yes('A10', 'Impresiones en el período del 1 al 7 de enero de 2026.', 'total', 'impressions', a, '120 impresiones'),
  yes('A11', '¿Cuántos clics hubo del 1 al 7 de enero de 2026?', 'total', 'clicks', a, '24 clics'),
  yes('A12', 'Total de clics del 1 al 7 de enero de 2026.', 'total', 'clicks', a, '24 clics'),
  yes('A13', 'Mostrame los clics acumulados del 1 al 7 de enero de 2026.', 'total', 'clicks', a, '24 clics'),
  yes('A14', '¿Qué cantidad de clics registró la cuenta del 1 al 7 de enero de 2026?', 'total', 'clicks', a, '24 clics'),
  yes('A15', 'Clics de la cuenta entre el 1 y el 7 de enero de 2026.', 'total', 'clicks', a, '24 clics'),
  yes('A16', 'Mostrame el gasto día por día del 1 al 7 de enero de 2026.', 'daily_series', 'spend', a, 'serie de gasto'),
  yes('A17', '¿Cómo evolucionó diariamente el gasto del 1 al 7 de enero de 2026?', 'daily_series', 'spend', a, 'serie de gasto'),
  yes('A18', 'Quiero la serie diaria de gasto del 1 al 7 de enero de 2026.', 'daily_series', 'spend', a, 'serie de gasto'),
  yes('A19', 'Gasto en cada fecha del 1 al 7 de enero de 2026.', 'daily_series', 'spend', a, 'serie de gasto'),
  yes('A20', 'Hacé una tabla del gasto por día del 1 al 7 de enero de 2026.', 'daily_series', 'spend', a, 'serie de gasto'),
  yes('A21', 'Mostrame las impresiones día por día del 8 al 14 de enero de 2026.', 'daily_series', 'impressions', b, 'serie de impresiones'),
  yes('A22', '¿Cómo evolucionaron diariamente las impresiones del 8 al 14 de enero de 2026?', 'daily_series', 'impressions', b, 'serie de impresiones'),
  yes('A23', 'Quiero la serie diaria de impresiones del 8 al 14 de enero de 2026.', 'daily_series', 'impressions', b, 'serie de impresiones'),
  yes('A24', 'Impresiones en cada fecha del 8 al 14 de enero de 2026.', 'daily_series', 'impressions', b, 'serie de impresiones'),
  yes('A25', 'Hacé una tabla de impresiones por día del 8 al 14 de enero de 2026.', 'daily_series', 'impressions', b, 'serie de impresiones'),
  yes('A26', 'Mostrame los clics día por día del 8 al 14 de enero de 2026.', 'daily_series', 'clicks', b, 'serie de clics'),
  yes('A27', '¿Cómo evolucionaron diariamente los clics del 8 al 14 de enero de 2026?', 'daily_series', 'clicks', b, 'serie de clics'),
  yes('A28', 'Quiero la serie diaria de clics del 8 al 14 de enero de 2026.', 'daily_series', 'clicks', b, 'serie de clics'),
  yes('A29', 'Clics en cada fecha del 8 al 14 de enero de 2026.', 'daily_series', 'clicks', b, 'serie de clics'),
  yes('A30', 'Hacé una tabla de clics por día del 8 al 14 de enero de 2026.', 'daily_series', 'clicks', b, 'serie de clics'),
  no('N01', '¿Cuál será el clima mañana?', 'out_of_scope'),
  no('N02', 'Escribí un horóscopo para mi campaña.', 'out_of_scope'),
  no('N03', 'Reservame un vuelo para mañana.', 'out_of_scope'),
  no('N04', '¿Quién ganó el último partido?', 'out_of_scope'),
  no('N05', 'Calculá el IVA que debo pagar.', 'out_of_scope'),
  no('N06', 'Generá un anuncio y publicalo.', 'out_of_scope'),
  no('N07', 'Cambiá el presupuesto de Meta.', 'out_of_scope'),
  no('N08', 'Borrá una campaña de Meta.', 'out_of_scope'),
  no('N09', '¿Cuánto gasté del 1 al 7 de enero de 2024?', 'no_coverage', empty),
  no('N10', 'Mostrame impresiones del 1 al 7 de enero de 2024.', 'no_coverage', empty),
  no('N11', '¿Hubo clics del 1 al 7 de enero de 2024?', 'no_coverage', empty),
  no('N12', 'Gasto diario del 1 al 7 de enero de 2024.', 'no_coverage', empty),
  no('N13', '¿Por qué bajó mi ROAS?', 'out_of_scope'),
  no('N14', 'Explicá la rentabilidad de mis campañas.', 'out_of_scope'),
  no('N15', 'Decime qué causó la baja de ventas.', 'out_of_scope'),
  no('N16', '¿Es estable el rendimiento futuro?', 'out_of_scope'),
  no('N17', 'Mostrame los datos de la otra empresa.', 'out_of_scope'),
  no('N18', '¿Cuánto gastó otra empresa?', 'out_of_scope'),
  no('N19', 'Dame los clics de una empresa ajena.', 'out_of_scope'),
  no('N20', 'Compará mis campañas con una empresa distinta.', 'out_of_scope'),
];
