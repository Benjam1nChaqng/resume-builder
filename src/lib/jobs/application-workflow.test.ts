import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockDb,
  selectResults,
  updateReturningResults,
  batchResults,
  updateSetCalls,
  conflictUpdateSetCalls,
  mockBatch,
} = vi.hoisted(() => {
  const selectResults: unknown[][] = [];
  const updateReturningResults: unknown[][] = [];
  const batchResults: unknown[][][] = [];
  const updateSetCalls: unknown[] = [];
  const conflictUpdateSetCalls: unknown[] = [];

  function thenableBuilder(result: unknown[]) {
    const builder: Record<string, unknown> = {};
    builder.from = vi.fn(() => builder);
    builder.where = vi.fn(() => builder);
    builder.limit = vi.fn(async () => result);
    builder.orderBy = vi.fn(async () => result);
    builder.then = (
      onFulfilled: (value: unknown[]) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(onFulfilled, onRejected);
    return builder;
  }

  const mockBatch = vi.fn<(queries: unknown[]) => Promise<unknown[][]>>(
    async () => batchResults.shift() ?? [],
  );
  const mockDb = {
    select: vi.fn(() => thenableBuilder(selectResults.shift() ?? [])),
    update: vi.fn(() => {
      const returningResult = updateReturningResults.shift() ?? [];
      const builder = thenableBuilder([]);
      builder.set = vi.fn((value: unknown) => {
        updateSetCalls.push(value);
        return builder;
      });
      builder.returning = vi.fn(async () => returningResult);
      return builder;
    }),
    insert: vi.fn(() => {
      const builder = thenableBuilder([]);
      builder.values = vi.fn(() => builder);
      builder.onConflictDoNothing = vi.fn(() => builder);
      builder.onConflictDoUpdate = vi.fn((value: unknown) => {
        conflictUpdateSetCalls.push(value);
        return builder;
      });
      builder.returning = vi.fn(async () => []);
      return builder;
    }),
    batch: mockBatch,
  };
  return {
    mockDb,
    selectResults,
    updateReturningResults,
    batchResults,
    updateSetCalls,
    conflictUpdateSetCalls,
    mockBatch,
  };
});

vi.mock("@/lib/db", () => ({ db: mockDb }));

import {
  ApplicationActionRequestInputSchema,
  ApplicationArtifactInputSchema,
  approveApplicationActionRequestForUser,
  claimApprovedApplicationActionForUser,
  completeClaimedApplicationActionForUser,
  createApplicationActionRequestForUser,
  updateApplicationDetailsForUser,
} from "./application-workflow";

function actionRequest(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: "request-1",
    userId: "user-1",
    jobId: "job-1",
    artifactId: "artifact-1",
    action: "send_email",
    status: "pending",
    summary: "Send reviewed email",
    payload: {
      to: "recruiter@example.com",
      subject: "Application",
      body: "Reviewed body",
      attachments: [],
    },
    idempotencyKey: "email:job-1:v1",
    createdAt: new Date("2026-08-18T16:00:00Z"),
    decidedAt: null,
    expiresAt: null,
    claimedAt: null,
    claimedByTokenId: null,
    completedAt: null,
    errorSummary: null,
    ...overrides,
  };
}

beforeEach(() => {
  selectResults.length = 0;
  updateReturningResults.length = 0;
  batchResults.length = 0;
  updateSetCalls.length = 0;
  conflictUpdateSetCalls.length = 0;
  vi.clearAllMocks();
});

describe("application workflow schemas", () => {
  it("requires source-backed artifacts and rejects unknown fields", () => {
    expect(
      ApplicationArtifactInputSchema.parse({
        jobId: "job-1",
        kind: "research",
        title: "Role research",
        content: "Verified findings",
        sourceUrls: ["https://example.com/jobs/1"],
        idempotencyKey: "research:job-1:v1",
      }),
    ).toMatchObject({ metadata: {}, sourceUrls: ["https://example.com/jobs/1"] });
    expect(() =>
      ApplicationArtifactInputSchema.parse({
        jobId: "job-1",
        kind: "research",
        title: "Role research",
        content: "Verified findings",
        idempotencyKey: "research:job-1:v1",
        canApproveItself: true,
      }),
    ).toThrow();
    expect(() =>
      ApplicationArtifactInputSchema.parse({
        jobId: "job-1",
        kind: "research",
        title: "Unsourced role research",
        content: "Unsupported findings",
        idempotencyKey: "research:job-1:v2",
      }),
    ).toThrow(/source URL/i);
  });

  it("freezes structured email and submission payloads", () => {
    expect(
      ApplicationActionRequestInputSchema.parse({
        jobId: "job-1",
        artifactId: "artifact-1",
        action: "send_email",
        summary: "Send reviewed email",
        idempotencyKey: "email:job-1:v1",
        payload: {
          to: "recruiter@example.com",
          subject: "Application",
          body: "Reviewed body",
        },
      }).payload,
    ).toMatchObject({ attachments: [] });
    expect(() =>
      ApplicationActionRequestInputSchema.parse({
        jobId: "job-1",
        action: "submit_application",
        summary: "Submit",
        idempotencyKey: "submit:job-1:v1",
        payload: {
          applicationUrl: "not-a-url",
          resumeId: "resume-1",
        },
      }),
    ).toThrow();
  });
});

describe("application approval lifecycle", () => {
  it("approves only the owned pending request for a 30 minute window", async () => {
    const now = new Date("2026-08-18T17:00:00Z");
    const approved = actionRequest({
      status: "approved",
      decidedAt: now,
      expiresAt: new Date("2026-08-18T17:30:00Z"),
    });
    selectResults.push([actionRequest()]);
    updateReturningResults.push([approved]);

    await expect(
      approveApplicationActionRequestForUser({
        userId: "user-1",
        requestId: "request-1",
        now,
      }),
    ).resolves.toMatchObject({ status: "approved" });
    expect(updateSetCalls).toContainEqual(
      expect.objectContaining({
        status: "approved",
        decidedAt: now,
        expiresAt: new Date("2026-08-18T17:30:00Z"),
      }),
    );
  });

  it("atomically claims an unexpired approval once", async () => {
    const claimed = actionRequest({
      status: "executing",
      claimedByTokenId: "token-1",
    });
    updateReturningResults.push([claimed]);

    await expect(
      claimApprovedApplicationActionForUser({
        userId: "user-1",
        tokenId: "token-1",
        requestId: "request-1",
        now: new Date("2026-08-18T17:10:00Z"),
      }),
    ).resolves.toMatchObject({ status: "executing" });
    expect(mockDb.select).toHaveBeenCalledTimes(1);
    expect(updateSetCalls[0]).toMatchObject({
      status: "executing",
      claimedByTokenId: "token-1",
    });
  });

  it("expires an approval that can no longer be claimed", async () => {
    updateReturningResults.push([]);
    selectResults.push(
      [],
      [
        actionRequest({
          status: "approved",
          expiresAt: new Date("2026-08-18T17:00:00Z"),
        }),
      ],
    );

    const promise = claimApprovedApplicationActionForUser({
      userId: "user-1",
      tokenId: "token-1",
      requestId: "request-1",
      now: new Date("2026-08-18T17:01:00Z"),
    });
    await expect(promise).rejects.toMatchObject({
      code: "expired",
    });
    expect(updateSetCalls).toContainEqual({ status: "expired" });
  });

  it("does not reveal or claim another user's request", async () => {
    updateReturningResults.push([]);
    selectResults.push([], []);

    await expect(
      claimApprovedApplicationActionForUser({
        userId: "user-1",
        tokenId: "token-1",
        requestId: "foreign-request",
      }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("does not claim a submission after the application advances elsewhere", async () => {
    updateReturningResults.push([]);
    selectResults.push(
      [],
      [
        actionRequest({
          action: "submit_application",
          status: "approved",
          artifactId: null,
          expiresAt: new Date("2026-08-18T17:30:00Z"),
          payload: {
            applicationUrl: "https://example.com/jobs/1/apply",
            resumeId: "resume-1",
            answerSummary: [],
          },
        }),
      ],
      [{ status: "applied" }],
    );

    await expect(
      claimApprovedApplicationActionForUser({
        userId: "user-1",
        tokenId: "token-1",
        requestId: "request-1",
        now: new Date("2026-08-18T17:10:00Z"),
      }),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("rejects an email request whose frozen body differs from its artifact", async () => {
    selectResults.push(
      [{ id: "job-1" }],
      [
        {
          id: "artifact-1",
          userId: "user-1",
          jobId: "job-1",
          kind: "outreach_email",
          title: "Email",
          content: "Original body",
        },
      ],
    );

    await expect(
      createApplicationActionRequestForUser({
        userId: "user-1",
        input: ApplicationActionRequestInputSchema.parse({
          jobId: "job-1",
          artifactId: "artifact-1",
          action: "send_email",
          summary: "Send reviewed email",
          idempotencyKey: "email:job-1:v1",
          payload: {
            to: "recruiter@example.com",
            subject: "Application",
            body: "Changed after review",
          },
        }),
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("records application submission effects in the same batch as completion", async () => {
    const completed = actionRequest({
      action: "submit_application",
      status: "completed",
      artifactId: null,
      payload: {
        applicationUrl: "https://example.com/jobs/1/apply",
        resumeId: "resume-1",
        answerSummary: [],
      },
    });
    selectResults.push([
      actionRequest({
        action: "submit_application",
        status: "executing",
        claimedByTokenId: "token-1",
        artifactId: null,
        payload: {
          applicationUrl: "https://example.com/jobs/1/apply",
          resumeId: "resume-1",
          answerSummary: [],
        },
      }),
    ]);
    batchResults.push([[], [], [completed]]);

    await expect(
      completeClaimedApplicationActionForUser({
        userId: "user-1",
        tokenId: "token-1",
        requestId: "request-1",
        now: new Date("2026-08-18T17:20:00Z"),
      }),
    ).resolves.toMatchObject({ status: "completed" });
    expect(mockBatch).toHaveBeenCalledWith(expect.any(Array));
    expect(mockBatch.mock.calls[0]?.[0]).toHaveLength(3);
    expect(updateSetCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ resumeId: "resume-1" }),
        expect.objectContaining({ status: "completed" }),
      ]),
    );
  });

  it("does not let another agent key complete a claimed action", async () => {
    selectResults.push([
      actionRequest({ status: "executing", claimedByTokenId: "token-1" }),
    ]);

    await expect(
      completeClaimedApplicationActionForUser({
        userId: "user-1",
        tokenId: "token-2",
        requestId: "request-1",
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(mockBatch).not.toHaveBeenCalled();
  });

  it("blocks a new submission request after an application was submitted", async () => {
    selectResults.push(
      [{ id: "job-1" }],
      [{ id: "resume-1" }],
      [{ status: "interviewing" }],
    );

    await expect(
      createApplicationActionRequestForUser({
        userId: "user-1",
        input: ApplicationActionRequestInputSchema.parse({
          jobId: "job-1",
          action: "submit_application",
          summary: "Submit application",
          idempotencyKey: "submit:job-1:v2",
          payload: {
            applicationUrl: "https://example.com/jobs/1/apply",
            resumeId: "resume-1",
          },
        }),
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(mockDb.insert).not.toHaveBeenCalled();
  });
});

describe("application detail lifecycle", () => {
  it("clears appliedAt when an application returns to a pre-application state", async () => {
    selectResults.push([{ id: "job-1" }]);

    await updateApplicationDetailsForUser({
      userId: "user-1",
      jobId: "job-1",
      input: {
        status: "ready_to_apply",
        notes: null,
        contactName: null,
        contactEmail: null,
        sourceLabel: null,
        followUpAt: null,
      },
    });

    expect(conflictUpdateSetCalls[0]).toMatchObject({
      set: expect.objectContaining({ appliedAt: null }),
    });
  });

  it("sets appliedAt for an interview reached through manual status editing", async () => {
    selectResults.push([{ id: "job-1" }]);
    batchResults.push([[], []]);

    await updateApplicationDetailsForUser({
      userId: "user-1",
      jobId: "job-1",
      input: {
        status: "interviewing",
        notes: null,
        contactName: null,
        contactEmail: null,
        sourceLabel: null,
        followUpAt: null,
      },
    });

    const conflictSet = conflictUpdateSetCalls[0] as {
      set: Record<string, unknown>;
    };
    expect(conflictSet.set.appliedAt).toBeDefined();
    expect(conflictSet.set.appliedAt).not.toBeNull();
  });
});
