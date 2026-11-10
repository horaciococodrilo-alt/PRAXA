export const CHAT_LIMITS = {
  maxPeriodDays: 93,
  maxToolCallsPerTurn: 4,
  maxOutputTokensPerCall: 2400,
  turnDeadlineMs: 60_000,
  finalizationReserveMs: 10_000,
  modelCallTimeoutMs: 20_000,
  turnLeaseSeconds: 90,
  maxQuestionChars: 500,
  maxBlocksPerAnswer: 4,
  previousQuestions: 3,
  modelEntitiesLimit: 50,
  maxClarificationChars: 300,
} as const;

export const CHAT_DEFAULT_PERIOD_DAYS = 7;
