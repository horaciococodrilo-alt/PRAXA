export type NumericCandidate = Readonly<{
  start: number;
  end: number;
  text: string;
  kind: 'digit' | 'percent' | 'number_word' | 'multiplier' | 'comparison';
}>;

const OUTSIDE = '(?<![\\p{L}\\p{N}_])';
const END = '(?![\\p{L}\\p{N}_])';
const digits = /[-+]?(?:\d{1,3}(?:[.,]\d{3})+|\d+)(?:[.,]\d+)?(?:\s?%)?/gu;
const multiplier = new RegExp(`${OUTSIDE}(?:doble|triple|cuádruple|se\\s+duplicó|se\\s+triplicó|aumentó\\s+un|cayó\\s+a\\s+la\\s+mitad|subió|bajó|aumentó|cayó|creció|disminuyó)${END}`, 'giu');
const comparison = new RegExp(`${OUTSIDE}(?:más\\s+que|menos\\s+que|igual\\s+que)${END}`, 'giu');
const NUMBER_WORD = '(?:cero|un|una|uno|primer|primera|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|diecis[eé]is|diecisiete|dieciocho|diecinueve|veinte|veinti(?:[a-záéíóú]+)|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento|doscientos|trescientos|cuatrocientos|quinientos|seiscientos|setecientos|ochocientos|novecientos|mil|mill[oó]n|millones|mitad|medio|media|tercio)';
const numberWords = new RegExp(`${OUTSIDE}${NUMBER_WORD}(?:\\s+(?:y\\s+)?${NUMBER_WORD})*${END}`, 'giu');
const article = /^(un|una|uno|primer|primera)$/iu;
const nonNumericNoun = /^(?:campaña|anuncio|conjunto|cuenta|período|gráfico|tabla|respuesta)\b/iu;

function articleIsNonNumeric(text: string, start: number, end: number): boolean {
  if (!article.test(text.slice(start, end))) return false;
  const before = text.slice(Math.max(0, start - 25), start);
  if (/(?:solo|solamente|exactamente)\s*$/iu.test(before)) return false;
  return nonNumericNoun.test(text.slice(end).trimStart());
}

/** Posiciones UTF-16 en el texto original, compatibles con slice y los spans del modelo. */
export function findNumericCandidates(text: string): NumericCandidate[] {
  const found: NumericCandidate[] = [];
  for (const [pattern, kind] of [
    [multiplier, 'multiplier'], [comparison, 'comparison'], [digits, 'digit'],
    [numberWords, 'number_word'],
  ] as const) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const start = match.index;
      const end = start + match[0].length;
      if (kind === 'number_word' && articleIsNonNumeric(text, start, end)) continue;
      found.push({ start, end, text: match[0], kind: kind === 'digit' &&
        match[0].includes('%') ? 'percent' : kind });
    }
  }
  found.sort((a, b) => a.start - b.start || b.end - a.end);
  const distinct: NumericCandidate[] = [];
  for (const candidate of found) {
    if (distinct.some((item) => candidate.start >= item.start && candidate.end <= item.end)) continue;
    distinct.push(candidate);
  }
  return distinct;
}
