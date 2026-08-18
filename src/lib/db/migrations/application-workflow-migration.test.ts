import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("application workflow migration", () => {
  it("adds durable artifacts, approval requests, and expanded application history", async () => {
    const [workflowSql, claimSql] = await Promise.all([
      readFile(
        new URL("./0015_yielding_paper_doll.sql", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("./0016_wooden_smiling_tiger.sql", import.meta.url),
        "utf8",
      ),
    ]);

    expect(workflowSql).toContain('CREATE TABLE "application_artifact"');
    expect(workflowSql).toContain('CREATE TABLE "application_action_request"');
    expect(workflowSql).toContain(
      "'pending', 'approved', 'rejected', 'expired', 'executing', 'completed', 'failed'",
    );
    expect(workflowSql).toContain(
      'UPDATE "application" SET "applied_at" = NULL WHERE "status" <> \'applied\'',
    );
    expect(workflowSql).toContain("'researched', 'needs_answers', 'tailored'");
    expect(workflowSql).toContain(
      'IF NEW."status" IN (\'tailored\', \'applied\') AND EXISTS',
    );
    expect(workflowSql).toContain(
      'CREATE OR REPLACE FUNCTION "record_direct_application_pipeline_event"',
    );
    expect(claimSql).toContain('ADD COLUMN "claimed_by_token_id" text');
    expect(claimSql).toContain(
      'REFERENCES "public"."agent_access_token"("id") ON DELETE set null',
    );
  });
});
