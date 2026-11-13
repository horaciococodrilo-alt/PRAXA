export type ExactDecimal = Readonly<{ coefficient: bigint; scale: number }>;
export type ExactRatio = Readonly<{ numerator: bigint; denominator: bigint }>;

export function parseExactDecimal(value: string | null): ExactDecimal | null {
  if (value === null || !/^\d+(?:\.\d+)?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  return { coefficient: BigInt(whole + fraction), scale: fraction.length };
}

function pow10(value: number): bigint {
  return BigInt(10) ** BigInt(value);
}

export function addExact(values: readonly ExactDecimal[]): ExactDecimal {
  const scale = values.reduce((largest, value) => Math.max(largest, value.scale), 0);
  return {
    coefficient: values.reduce((sum, value) =>
      sum + value.coefficient * pow10(scale - value.scale), BigInt(0)),
    scale,
  };
}

export function compareExact(left: ExactDecimal, right: ExactDecimal): -1 | 0 | 1 {
  const scale = Math.max(left.scale, right.scale);
  const a = left.coefficient * pow10(scale - left.scale);
  const b = right.coefficient * pow10(scale - right.scale);
  return a < b ? -1 : a > b ? 1 : 0;
}

export function ratio(left: ExactDecimal, right: ExactDecimal, multiplier = BigInt(1)): ExactRatio | null {
  if (right.coefficient === BigInt(0)) return null;
  return {
    numerator: left.coefficient * pow10(right.scale) * multiplier,
    denominator: right.coefficient * pow10(left.scale),
  };
}

export function compareRatio(left: ExactRatio, right: ExactRatio): -1 | 0 | 1 {
  const a = left.numerator * right.denominator;
  const b = right.numerator * left.denominator;
  return a < b ? -1 : a > b ? 1 : 0;
}

function roundedQuotient(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= BigInt(0)) throw new Error('Denominador inválido.');
  const negative = numerator < BigInt(0);
  const absolute = negative ? -numerator : numerator;
  let quotient = absolute / denominator;
  if ((absolute % denominator) * BigInt(2) >= denominator) quotient += BigInt(1);
  return negative ? -quotient : quotient;
}

export function formatRatio(value: ExactRatio, scale: number): string {
  const scaled = roundedQuotient(value.numerator * pow10(scale), value.denominator);
  const negative = scaled < BigInt(0);
  const digits = String(negative ? -scaled : scaled).padStart(scale + 1, '0');
  const text = scale === 0 ? digits : `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
  return negative ? `-${text}` : text;
}

export function formatExact(value: ExactDecimal, scale: number): string {
  return formatRatio({ numerator: value.coefficient, denominator: pow10(value.scale) }, scale);
}

export function percentChange(current: ExactRatio, baseline: ExactRatio): ExactRatio | null {
  if (baseline.numerator === BigInt(0)) return null;
  return {
    numerator: (current.numerator * baseline.denominator - baseline.numerator * current.denominator) * BigInt(100),
    denominator: baseline.numerator * current.denominator,
  };
}

export function thresholdReached(
  current: ExactRatio,
  baseline: ExactRatio,
  direction: 'increase' | 'decrease',
  thresholdPct: number,
): boolean {
  const currentSide = current.numerator * baseline.denominator * BigInt(100);
  const baselineSide = baseline.numerator * current.denominator *
    BigInt(direction === 'increase' ? 100 + thresholdPct : 100 - thresholdPct);
  return direction === 'increase' ? currentSide >= baselineSide : currentSide <= baselineSide;
}
