import { parseSqlDecimal } from './decimal';

function coefficients(values: readonly (string | null)[]): (bigint | null)[] {
  const parsed = values.map((value) => value === null ? null : parseSqlDecimal(value));
  if (parsed.some((value, index) => values[index] !== null && value === null)) {
    throw new Error('Escala inválida.');
  }
  const scale = Math.max(0, ...parsed.map((value) => value?.scale ?? 0));
  return parsed.map((value) => value === null ? null :
    value.coefficient * BigInt(10) ** BigInt(scale - value.scale));
}

/** Solo las proporciones geométricas acotadas pasan a number. */
export function relativeToMax(values: readonly (string | null)[]): (number | null)[] {
  const nums = coefficients(values);
  const maximum = nums.reduce<bigint>((max, value) =>
    value !== null && value > max ? value : max, BigInt(0));
  return nums.map((value) => value === null ? null :
    maximum === BigInt(0) || value <= BigInt(0) ? 0 :
      Number(value * BigInt(10000) / maximum));
}

/** Mayor resto estable: las partes presentes suman exactamente 10000 si el total es positivo. */
export function shareOfTotal(values: readonly (string | null)[]): (number | null)[] {
  const nums = coefficients(values);
  if (nums.some((value) => value !== null && value < BigInt(0))) {
    throw new Error('Escala inválida.');
  }
  const total = nums.reduce<bigint>((sum, value) => sum + (value ?? BigInt(0)), BigInt(0));
  if (total === BigInt(0)) return nums.map((value) => value === null ? null : 0);
  const base = nums.map((value) => value === null ? null :
    Number(value * BigInt(10000) / total));
  const remainder = nums.map((value, index) => ({ index,
    remainder: value === null ? BigInt(-1) : value * BigInt(10000) % total }));
  remainder.sort((a, b) => a.remainder === b.remainder ? a.index - b.index :
    a.remainder > b.remainder ? -1 : 1);
  let left = 10000 - base.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  for (const item of remainder) {
    if (left === 0) break;
    if (base[item.index] !== null) {
      base[item.index]! += 1;
      left -= 1;
    }
  }
  return base;
}
