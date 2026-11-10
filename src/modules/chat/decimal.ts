export type DecimalValue = Readonly<{ coefficient: bigint; scale: number }>;

function fromCanonical(text: string): DecimalValue | null {
  if (!/^-?\d+(?:\.\d+)?$/.test(text)) return null;
  const negative = text.startsWith('-');
  const unsigned = negative ? text.slice(1) : text;
  const [whole, fraction = ''] = unsigned.split('.');
  const coefficient = BigInt(whole + fraction) * (negative ? BigInt(-1) : BigInt(1));
  return { coefficient, scale: fraction.length };
}

/** SQL devuelve punto decimal sin agrupación. */
export function parseSqlDecimal(text: string): DecimalValue | null {
  return fromCanonical(text);
}

const SIMPLE_WORDS: Record<string, number> = {
  cero: 0, un: 1, una: 1, uno: 1, primer: 1, primera: 1,
  dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7,
  ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13,
  catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
  dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21,
  veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25,
  veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
  treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60,
  setenta: 70, ochenta: 80, noventa: 90, cien: 100, ciento: 100,
  doscientos: 200, trescientos: 300, cuatrocientos: 400,
  quinientos: 500, seiscientos: 600, setecientos: 700,
  ochocientos: 800, novecientos: 900,
};

/** Cantidades españolas enteras; null si la expresión no tiene una lectura inequívoca. */
export function parseSpanishInteger(raw: string): string | null {
  const normalized = raw.toLocaleLowerCase('es').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').trim();
  const words = normalized.split(/\s+/u).filter((word) => word !== 'y');
  if (!words.length || words.length > 12) return null;
  let total = BigInt(0);
  let group = BigInt(0);
  for (const word of words) {
    if (word === 'mil') {
      total += (group || BigInt(1)) * BigInt(1000);
      group = BigInt(0);
    } else if (word === 'millon' || word === 'millones') {
      total += (group || BigInt(1)) * BigInt(1_000_000);
      group = BigInt(0);
    } else if (Object.hasOwn(SIMPLE_WORDS, word)) {
      group += BigInt(SIMPLE_WORDS[word]);
    } else return null;
  }
  return String(total + group);
}

/** Acepta es-AR y la forma sin miles; un punto ambiguo se comprueba de ambas maneras. */
export function parseDisplayedDecimals(raw: string): DecimalValue[] {
  const text = raw.trim().replace(/^\$\s*/, '').replace(/\s*%$/, '').trim();
  const variants: string[] = [];
  if (/^-?\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(text)) {
    variants.push(text.replaceAll('.', '').replace(',', '.'));
  }
  if (/^-?\d+(?:,\d+)?$/.test(text)) variants.push(text.replace(',', '.'));
  if (/^-?\d+(?:\.\d+)?$/.test(text)) variants.push(text);
  return variants.flatMap((variant) => {
    const parsed = fromCanonical(variant);
    return parsed ? [parsed] : [];
  });
}

export function sameDisplayedDecimal(left: string, right: string): boolean {
  return parseDisplayedDecimals(left).some((a) =>
    parseDisplayedDecimals(right).some((b) => compareValues(a, b) === 0));
}

export function compareValues(left: DecimalValue, right: DecimalValue): -1 | 0 | 1 {
  const scale = Math.max(left.scale, right.scale);
  const a = left.coefficient * BigInt(10) ** BigInt(scale - left.scale);
  const b = right.coefficient * BigInt(10) ** BigInt(scale - right.scale);
  return a < b ? -1 : a > b ? 1 : 0;
}

export function compareDecimal(left: string, right: string): -1 | 0 | 1 {
  const a = parseSqlDecimal(left);
  const b = parseSqlDecimal(right);
  if (!a || !b) throw new Error('Decimal inválido.');
  return compareValues(a, b);
}

export function roundDecimal(value: DecimalValue, scale: number): DecimalValue {
  if (!Number.isInteger(scale) || scale < 0) throw new Error('Escala inválida.');
  if (value.scale <= scale) return { coefficient: value.coefficient *
    BigInt(10) ** BigInt(scale - value.scale), scale };
  const divisor = BigInt(10) ** BigInt(value.scale - scale);
  const negative = value.coefficient < BigInt(0);
  const absolute = negative ? -value.coefficient : value.coefficient;
  let rounded = absolute / divisor;
  if ((absolute % divisor) * BigInt(2) >= divisor) rounded += BigInt(1);
  return { coefficient: negative ? -rounded : rounded, scale };
}

export function decimalMatches(display: string, expected: string,
  policy: 'exact' | 'round2' | 'round0'): boolean {
  const reference = parseSqlDecimal(expected);
  if (!reference) return false;
  const displayed = parseDisplayedDecimals(display);
  return displayed.some((candidate) => compareValues(candidate, reference) === 0 ||
    (policy === 'round2' && compareValues(candidate, roundDecimal(reference, 2)) === 0) ||
    (policy === 'round0' && compareValues(candidate, roundDecimal(reference, 0)) === 0));
}
