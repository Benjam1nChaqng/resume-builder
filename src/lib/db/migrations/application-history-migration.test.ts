import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("application history migration", () => {
  it("persists notes and records listing/direct-job transitions", async () => {
    const sql = await readFile(
      new URL("./0012_complete_steve_rogers.sql", import.meta.url),
      "utf8",
    );

    expect(sql).toContain('ALTER TABLE "application" ADD COLUMN "notes" text');
    expect(sql).toContain('CREATE TABLE "job_pipeline_event"');
    expect(sql).toContain('AFTER UPDATE OF "status" ON "job_listing"');
    expect(sql).toContain('OLD."status" IS DISTINCT FROM NEW."status"');
    expect(sql).toContain(
      'CREATE TRIGGER "direct_application_pipeline_insert_event_trigger"',
    );
    expect(sql).toContain(
      'CREATE TRIGGER "direct_application_pipeline_update_event_trigger"',
    );
    expect(sql).toContain(
      'IF TG_OP = \'UPDATE\' AND OLD."status" IS NOT DISTINCT FROM NEW."status"',
    );
    expect(sql).toContain(
      'SELECT 1 FROM "job_listing" WHERE "job_id" = NEW."job_id"',
    );
  });
});
