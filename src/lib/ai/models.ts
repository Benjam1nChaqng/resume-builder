export const MODELS = {
  PLANNER: "claude-opus-4-7",
  EXECUTOR: "claude-sonnet-4-6",
  REVIEWER: "claude-opus-4-7",
  CHEAP: "claude-haiku-4-5-20251001",
} as const;

export type ModelName = (typeof MODELS)[keyof typeof MODELS];
