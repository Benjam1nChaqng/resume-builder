import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

  it("keeps the production recovery migrations safe to resume", () => {
    const migrationNames = [
      "0004_motionless_mauler.sql",
      "0005_pale_vanisher.sql",
      "0006_dazzling_sentry.sql",
      "0007_tired_iron_monger.sql",
      "0008_hot_banshee.sql",
      "0009_majestic_skin.sql",
      "0010_volatile_gorilla_man.sql",
      "0011_cute_warstar.sql",
      "0012_complete_steve_rogers.sql",
      "0013_colorful_mandrill.sql",
    ];
    const sql = migrationNames
      .map((name) =>
        readFileSync(resolve("src/lib/db/migrations", name), "utf8"),
      )
      .join("\n");

    expect(sql).not.toMatch(/ADD COLUMN "/);
    expect(sql).not.toMatch(/CREATE (?:UNIQUE )?INDEX "/);
    expect(sql).not.toMatch(/CREATE TABLE "/);
    expect(sql).not.toMatch(/CREATE FUNCTION "/);

    const addedConstraints = sql.match(/ADD CONSTRAINT/g) ?? [];
    const droppedConstraints = sql.match(/DROP CONSTRAINT IF EXISTS/g) ?? [];
    expect(droppedConstraints).toHaveLength(addedConstraints.length);

    const createdTriggers = sql.match(/CREATE TRIGGER/g) ?? [];
    const droppedTriggers = sql.match(/DROP TRIGGER IF EXISTS/g) ?? [];
    expect(droppedTriggers).toHaveLength(createdTriggers.length);
  });
});
