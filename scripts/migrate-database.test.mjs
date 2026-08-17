import { describe, expect, it } from "vitest";
import {
  redactDatabaseSecrets,
  validateDatabaseUrl,
} from "./migrate-database.mjs";

describe("database migration safety", () => {
  it("accepts PostgreSQL connection URLs", () => {
    expect(() =>
      validateDatabaseUrl("postgresql://user:secret@example.com/resume"),
    ).not.toThrow();
    expect(() =>
      validateDatabaseUrl("postgres://user:secret@example.com/resume"),
    ).not.toThrow();
  });

  it("rejects missing, malformed, and non-PostgreSQL URLs", () => {
    expect(() => validateDatabaseUrl()).toThrow("DATABASE_URL is missing");
    expect(() => validateDatabaseUrl("not-a-url")).toThrow("valid PostgreSQL URL");
    expect(() => validateDatabaseUrl("https://example.com")).toThrow(
      "postgres or postgresql",
    );
  });

  it("redacts the configured URL and unexpected PostgreSQL URLs", () => {
    const configured = "postgresql://owner:first-secret@db.example.com/app";
    const other = "postgres://reader:second-secret@replica.example.com/app";
    const redacted = redactDatabaseSecrets(
      `Failed ${configured}; caused by ${other}`,
      configured,
    );

    expect(redacted).not.toContain("first-secret");
    expect(redacted).not.toContain("second-secret");
    expect(redacted).toBe(
      "Failed [REDACTED_DATABASE_URL]; caused by [REDACTED_DATABASE_URL]",
    );
  });
});
