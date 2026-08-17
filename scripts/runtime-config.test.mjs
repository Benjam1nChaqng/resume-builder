import { describe, expect, it } from "vitest";
import {
  inspectMvpEnvironment,
  REQUIRED_MVP_ENV_KEYS,
} from "./runtime-config.mjs";

const validEnvironment = {
  DATABASE_URL: "postgresql://example.com/resume_builder",
  BETTER_AUTH_SECRET: "a".repeat(32),
  OPENAI_API_KEY: "openai-test-key",
  BLOB_READ_WRITE_TOKEN: "blob-test-token",
  BETTER_AUTH_URL: "http://localhost:3000",
  NEXT_PUBLIC_BETTER_AUTH_URL: "http://localhost:3000",
};

describe("inspectMvpEnvironment", () => {
  it("reports every missing required key without inspecting secret values", () => {
    expect(inspectMvpEnvironment({})).toEqual({
      ready: false,
      missing: REQUIRED_MVP_ENV_KEYS,
      invalid: [],
    });
  });

  it("accepts a complete runtime configuration", () => {
    expect(inspectMvpEnvironment(validEnvironment)).toEqual({
      ready: true,
      missing: [],
      invalid: [],
    });
  });

  it("reports malformed database, auth secret, and auth URL values by key", () => {
    const result = inspectMvpEnvironment({
      ...validEnvironment,
      DATABASE_URL: "https://example.com/not-postgres",
      BETTER_AUTH_SECRET: "short",
      BETTER_AUTH_URL: "not-a-url",
    });

    expect(result).toEqual({
      ready: false,
      missing: [],
      invalid: ["DATABASE_URL", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL"],
    });
  });
});
