export const MODELS = {
  PLANNER: "gpt-5.6-sol",
  EXECUTOR: "gpt-5.6-luna",
  REVIEWER: "gpt-5.6-sol",
  CHEAP: "gpt-5.6-luna",
} as const;

export type ModelName = (typeof MODELS)[keyof typeof MODELS];
