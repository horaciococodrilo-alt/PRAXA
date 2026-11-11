import type { ExpandedCase } from './fixtures/expanded';

type Expected = ExpandedCase['expected'];
type Actual = Readonly<{ kind: string; reason: string | null;
  calls: readonly Readonly<{ name: string; args: Record<string, unknown> }>[];
  blocks: readonly Readonly<{ type: string; cells: readonly string[] }>[];
  defaulted?: boolean }>;

/** Puntúa la salida visible y la lectura efectivamente ejecutada, no la intención del modelo. */
export function scoreExpandedCase(expected: Expected, actual: Actual): boolean {
  if (expected.allowClarification && actual.kind === 'clarification') return true;
  if (actual.kind !== expected.kind) return false;
  if (expected.kind === 'abstention') return actual.reason === expected.reason;
  if (expected.kind === 'clarification') return true;
  if (expected.requireDefaulted && actual.defaulted !== true) return false;
  const chosen = expected.tool === null || actual.calls.some((call) =>
    call.name === expected.tool &&
    (expected.metric === null || call.args.metric === expected.metric) &&
    (expected.period === null || JSON.stringify(call.args.period) ===
      JSON.stringify(expected.period)));
  const block = expected.block === null || actual.blocks.some((item) =>
    item.type === expected.block);
  const value = expected.value === undefined || actual.blocks.some((item) =>
    item.cells.some((cell) => cell === expected.value ||
      cell.startsWith(`${expected.value} `)));
  return chosen && block && value;
}
