import { createHash, randomUUID } from "node:crypto";
import {
  and,
  desc,
  eq,
  exists,
  gt,
  inArray,
  lte,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  application,
  applicationActionRequest,
  applicationArtifact,
  job,
  jobListing,
} from "@/lib/db/jobs-schema";
import { resume } from "@/lib/db/resume-schema";
import {
  APPLICATION_ARTIFACT_KINDS,
  APPLICATION_STATUSES,
} from "./application-constants";

const PRE_APPLICATION_STATUSES = new Set([
  "draft",
  "researched",
  "needs_answers",
  "tailored",
  "ready_to_apply",
  "approved",
]);
const APPLIED_APPLICATION_STATUS_VALUES = [
  "applied",
  "interviewing",
  "offered",
] as const;
const APPLIED_APPLICATION_STATUSES = new Set<string>(
  APPLIED_APPLICATION_STATUS_VALUES,
);
const POST_SUBMISSION_STATUS_VALUES = [
  ...APPLIED_APPLICATION_STATUS_VALUES,
  "rejected",
  "withdrawn",
  "closed",
] as const;
const POST_SUBMISSION_STATUSES = new Set<string>(
  POST_SUBMISSION_STATUS_VALUES,
);

export const ApplicationStatusSchema = z.enum(APPLICATION_STATUSES);
export const ApplicationArtifactKindSchema = z.enum(
  APPLICATION_ARTIFACT_KINDS,
);

const IdSchema = z.string().trim().min(1).max(200);
const IdempotencyKeySchema = z
  .string()
  .trim()
  .min(8)
  .max(200)
  .regex(/^[A-Za-z0-9._:-]+$/, "Use letters, numbers, dots, colons, dashes, or underscores.");
const MetadataSchema = z.record(z.string(), z.unknown());

export const ApplicationArtifactInputSchema = z
  .object({
    jobId: IdSchema,
    kind: ApplicationArtifactKindSchema,
    title: z.string().trim().min(1).max(300),
    content: z.string().trim().min(1).max(100_000),
    metadata: MetadataSchema.default({}),
    sourceUrls: z.array(z.string().trim().url()).max(25).default([]),
    idempotencyKey: IdempotencyKeySchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.kind === "research" && value.sourceUrls.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["sourceUrls"],
        message: "Research artifacts require at least one source URL.",
      });
    }
  });

const ResumeAttachmentSchema = z
  .object({
    resumeId: IdSchema,
    filename: z.string().trim().min(1).max(240).optional(),
  })
  .strict();

const ActionRequestBaseSchema = z.object({
  jobId: IdSchema,
  summary: z.string().trim().min(1).max(500),
  idempotencyKey: IdempotencyKeySchema,
});

const SendEmailActionRequestSchema = ActionRequestBaseSchema.extend({
  action: z.literal("send_email"),
  artifactId: IdSchema,
  payload: z
    .object({
      to: z.string().trim().email().max(320),
      subject: z.string().trim().min(1).max(500),
      body: z.string().trim().min(1).max(100_000),
      attachments: z.array(ResumeAttachmentSchema).max(5).default([]),
    })
    .strict(),
});

const SubmitApplicationActionRequestSchema = ActionRequestBaseSchema.extend({
  action: z.literal("submit_application"),
  artifactId: IdSchema.nullable().optional(),
  payload: z
    .object({
      applicationUrl: z.string().trim().url(),
      resumeId: IdSchema,
      answerSummary: z
        .array(
          z
            .object({
              question: z.string().trim().min(1).max(1_000),
              answer: z.string().trim().min(1).max(5_000),
            })
            .strict(),
        )
        .max(100)
        .default([]),
    })
    .strict(),
});

export const ApplicationActionRequestInputSchema = z.discriminatedUnion(
  "action",
  [SendEmailActionRequestSchema, SubmitApplicationActionRequestSchema],
);

export const ApplicationActionFailureSchema = z
  .object({
    errorSummary: z.string().trim().min(1).max(1_000),
  })
  .strict();

export const QueueOutreachEmailInputSchema = z
  .object({
    jobId: IdSchema,
    resumeId: IdSchema,
    to: z.string().trim().email().max(320),
    subject: z.string().trim().min(1).max(500),
    body: z.string().trim().min(1).max(100_000),
  })
  .strict();

const nullableText = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .nullable()
    .transform((value) => value || null);

export const ApplicationDetailsInputSchema = z
  .object({
    status: ApplicationStatusSchema,
    notes: nullableText(4_000),
    contactName: nullableText(200),
    contactEmail: z
      .union([z.string().trim().email().max(320), z.literal(""), z.null()])
      .transform((value) => value || null),
    sourceLabel: nullableText(200),
    followUpAt: z.date().nullable(),
  })
  .strict();

export type ApplicationArtifactInput = z.infer<
  typeof ApplicationArtifactInputSchema
>;
export type ApplicationActionRequestInput = z.infer<
  typeof ApplicationActionRequestInputSchema
>;
export type ApplicationDetailsInput = z.infer<
  typeof ApplicationDetailsInputSchema
>;
export type QueueOutreachEmailInput = z.infer<
  typeof QueueOutreachEmailInputSchema
>;

export type ApplicationWorkflowErrorCode =
  | "not_found"
  | "conflict"
  | "expired";

export class ApplicationWorkflowError extends Error {
  constructor(
    public readonly code: ApplicationWorkflowErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ApplicationWorkflowError";
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

async function requireOwnedJob(userId: string, jobId: string): Promise<void> {
  const rows = await db
    .select({ id: job.id })
    .from(job)
    .where(and(eq(job.id, jobId), eq(job.userId, userId)))
    .limit(1);
  if (!rows[0]) {
    throw new ApplicationWorkflowError("not_found", "Job not found.");
  }
}

async function requireOwnedResumes(
  userId: string,
  resumeIds: string[],
): Promise<void> {
  const uniqueIds = [...new Set(resumeIds)];
  if (uniqueIds.length === 0) return;
  const rows = await db
    .select({ id: resume.id })
    .from(resume)
    .where(and(eq(resume.userId, userId), inArray(resume.id, uniqueIds)));
  if (rows.length !== uniqueIds.length) {
    throw new ApplicationWorkflowError("not_found", "Resume not found.");
  }
}

async function getOwnedArtifact(
  userId: string,
  artifactId: string,
  jobId: string,
) {
  const rows = await db
    .select()
    .from(applicationArtifact)
    .where(
      and(
        eq(applicationArtifact.id, artifactId),
        eq(applicationArtifact.userId, userId),
        eq(applicationArtifact.jobId, jobId),
      ),
    )
    .limit(1);
  if (!rows[0]) {
    throw new ApplicationWorkflowError(
      "not_found",
      "Application artifact not found.",
    );
  }
  return rows[0];
}

async function getOwnedActionRequest(userId: string, requestId: string) {
  const rows = await db
    .select()
    .from(applicationActionRequest)
    .where(
      and(
        eq(applicationActionRequest.id, requestId),
        eq(applicationActionRequest.userId, userId),
      ),
    )
    .limit(1);
  if (!rows[0]) {
    throw new ApplicationWorkflowError(
      "not_found",
      "Application action request not found.",
    );
  }
  return rows[0];
}

function sameArtifact(
  existing: typeof applicationArtifact.$inferSelect,
  input: ApplicationArtifactInput,
): boolean {
  return (
    existing.jobId === input.jobId &&
    existing.kind === input.kind &&
    existing.title === input.title &&
    existing.content === input.content &&
    stableJson(existing.metadata) === stableJson(input.metadata) &&
    stableJson(existing.sourceUrls) === stableJson(input.sourceUrls)
  );
}

function sameActionRequest(
  existing: typeof applicationActionRequest.$inferSelect,
  input: ApplicationActionRequestInput,
): boolean {
  return (
    existing.jobId === input.jobId &&
    existing.artifactId === (input.artifactId ?? null) &&
    existing.action === input.action &&
    existing.summary === input.summary &&
    stableJson(existing.payload) === stableJson(input.payload)
  );
}

async function ensureApplicationStage({
  userId,
  jobId,
  status,
  resumeId,
}: {
  userId: string;
  jobId: string;
  status: "researched" | "ready_to_apply";
  resumeId?: string;
}): Promise<void> {
  const protectedStatuses = [
    "applied",
    "interviewing",
    "offered",
    "rejected",
    "withdrawn",
    "closed",
  ];
  await db
    .insert(application)
    .values({
      id: randomUUID(),
      userId,
      jobId,
      resumeId,
      status,
    })
    .onConflictDoUpdate({
      target: [application.userId, application.jobId],
      set: {
        status: sql`case when ${application.status} in (${sql.join(
          protectedStatuses.map((value) => sql`${value}`),
          sql`, `,
        )}) then ${application.status} when ${status} = 'researched' and ${application.status} <> 'draft' then ${application.status} else ${status} end`,
        ...(resumeId ? { resumeId } : {}),
        updatedAt: new Date(),
      },
    });
}

async function requireApplicationOpenForSubmission(
  userId: string,
  jobId: string,
): Promise<void> {
  const rows = await db
    .select({ status: application.status })
    .from(application)
    .where(and(eq(application.userId, userId), eq(application.jobId, jobId)))
    .limit(1);
  if (rows[0] && POST_SUBMISSION_STATUSES.has(rows[0].status)) {
    throw new ApplicationWorkflowError(
      "conflict",
      "This application is already in a post-submission state.",
    );
  }
}

export async function createApplicationArtifactForUser({
  userId,
  input,
}: {
  userId: string;
  input: ApplicationArtifactInput;
}) {
  await requireOwnedJob(userId, input.jobId);
  const inserted = await db
    .insert(applicationArtifact)
    .values({
      id: randomUUID(),
      userId,
      ...input,
    })
    .onConflictDoNothing()
    .returning();
  const artifact =
    inserted[0] ??
    (
      await db
        .select()
        .from(applicationArtifact)
        .where(
          and(
            eq(applicationArtifact.userId, userId),
            eq(applicationArtifact.idempotencyKey, input.idempotencyKey),
          ),
        )
        .limit(1)
    )[0];
  if (!artifact || !sameArtifact(artifact, input)) {
    throw new ApplicationWorkflowError(
      "conflict",
      "The artifact idempotency key is already used for different content.",
    );
  }
  await ensureApplicationStage({
    userId,
    jobId: input.jobId,
    status: "researched",
  });
  return { artifact, created: inserted.length > 0 };
}

export async function createApplicationActionRequestForUser({
  userId,
  input,
}: {
  userId: string;
  input: ApplicationActionRequestInput;
}) {
  await requireOwnedJob(userId, input.jobId);
  const artifact = input.artifactId
    ? await getOwnedArtifact(userId, input.artifactId, input.jobId)
    : null;

  if (input.action === "send_email") {
    if (artifact?.kind !== "outreach_email") {
      throw new ApplicationWorkflowError(
        "conflict",
        "Email actions require an outreach email artifact.",
      );
    }
    if (artifact.content !== input.payload.body) {
      throw new ApplicationWorkflowError(
        "conflict",
        "The frozen email body must match the selected artifact.",
      );
    }
    await requireOwnedResumes(
      userId,
      input.payload.attachments.map((item) => item.resumeId),
    );
  } else {
    await requireOwnedResumes(userId, [input.payload.resumeId]);
    await requireApplicationOpenForSubmission(userId, input.jobId);
  }

  const inserted = await db
    .insert(applicationActionRequest)
    .values({
      id: randomUUID(),
      userId,
      jobId: input.jobId,
      artifactId: input.artifactId ?? null,
      action: input.action,
      status: "pending",
      summary: input.summary,
      payload: input.payload,
      idempotencyKey: input.idempotencyKey,
    })
    .onConflictDoNothing()
    .returning();
  const actionRequest =
    inserted[0] ??
    (
      await db
        .select()
        .from(applicationActionRequest)
        .where(
          and(
            eq(applicationActionRequest.userId, userId),
            eq(
              applicationActionRequest.idempotencyKey,
              input.idempotencyKey,
            ),
          ),
        )
        .limit(1)
    )[0];
  if (!actionRequest || !sameActionRequest(actionRequest, input)) {
    throw new ApplicationWorkflowError(
      "conflict",
      "The action idempotency key is already used for a different request.",
    );
  }

  await ensureApplicationStage({
    userId,
    jobId: input.jobId,
    status: input.action === "submit_application" ? "ready_to_apply" : "researched",
    resumeId:
      input.action === "submit_application" ? input.payload.resumeId : undefined,
  });
  return { actionRequest, created: inserted.length > 0 };
}

export async function queueOutreachEmailForUser({
  userId,
  input,
}: {
  userId: string;
  input: QueueOutreachEmailInput;
}) {
  const digest = createHash("sha256")
    .update(stableJson(input))
    .digest("hex")
    .slice(0, 32);
  const artifactResult = await createApplicationArtifactForUser({
    userId,
    input: {
      jobId: input.jobId,
      kind: "outreach_email",
      title: input.subject,
      content: input.body,
      metadata: {
        to: input.to,
        subject: input.subject,
        resumeId: input.resumeId,
      },
      sourceUrls: [],
      idempotencyKey: `outreach:${input.jobId}:${digest}`,
    },
  });
  const requestResult = await createApplicationActionRequestForUser({
    userId,
    input: {
      jobId: input.jobId,
      artifactId: artifactResult.artifact.id,
      action: "send_email",
      summary: `Send application email to ${input.to}`,
      payload: {
        to: input.to,
        subject: input.subject,
        body: input.body,
        attachments: [{ resumeId: input.resumeId }],
      },
      idempotencyKey: `send-email:${input.jobId}:${digest}`,
    },
  });
  return {
    artifact: artifactResult.artifact,
    actionRequest: requestResult.actionRequest,
    created: artifactResult.created || requestResult.created,
  };
}

export async function approveApplicationActionRequestForUser({
  userId,
  requestId,
  now = new Date(),
}: {
  userId: string;
  requestId: string;
  now?: Date;
}) {
  const request = await getOwnedActionRequest(userId, requestId);
  if (request.status !== "pending") {
    throw new ApplicationWorkflowError(
      "conflict",
      "Only a pending action can be approved.",
    );
  }
  if (request.action === "submit_application") {
    await requireApplicationOpenForSubmission(userId, request.jobId);
  }
  const expiresAt = new Date(now.getTime() + 30 * 60 * 1_000);
  const requestIsPending = exists(
    db
      .select({ id: applicationActionRequest.id })
      .from(applicationActionRequest)
      .where(
        and(
          eq(applicationActionRequest.id, requestId),
          eq(applicationActionRequest.userId, userId),
          eq(applicationActionRequest.status, "pending"),
        ),
      ),
  );
  const requestUpdate = db
    .update(applicationActionRequest)
    .set({
      status: "approved",
      decidedAt: now,
      expiresAt,
      errorSummary: null,
    })
    .where(
      and(
        eq(applicationActionRequest.id, requestId),
        eq(applicationActionRequest.userId, userId),
        eq(applicationActionRequest.status, "pending"),
      ),
    )
    .returning();

  const updated =
    request.action === "submit_application"
      ? (
          await db.batch([
            db
              .update(application)
              .set({
                status: sql`case when ${application.status} in ('applied', 'interviewing', 'offered', 'rejected', 'withdrawn', 'closed') then ${application.status} else 'approved' end`,
                updatedAt: now,
              })
              .where(
                and(
                  eq(application.userId, userId),
                  eq(application.jobId, request.jobId),
                  requestIsPending,
                ),
              ),
            requestUpdate,
          ])
        )[1]
      : await requestUpdate;
  if (!updated[0]) {
    throw new ApplicationWorkflowError(
      "conflict",
      "The action changed before it could be approved.",
    );
  }
  return updated[0];
}

export async function rejectApplicationActionRequestForUser({
  userId,
  requestId,
  now = new Date(),
}: {
  userId: string;
  requestId: string;
  now?: Date;
}) {
  const request = await getOwnedActionRequest(userId, requestId);
  if (request.status !== "pending" && request.status !== "approved") {
    throw new ApplicationWorkflowError(
      "conflict",
      "This action can no longer be rejected.",
    );
  }
  const rejectable = exists(
    db
      .select({ id: applicationActionRequest.id })
      .from(applicationActionRequest)
      .where(
        and(
          eq(applicationActionRequest.id, requestId),
          eq(applicationActionRequest.userId, userId),
          inArray(applicationActionRequest.status, ["pending", "approved"]),
        ),
      ),
  );
  const requestUpdate = db
    .update(applicationActionRequest)
    .set({
      status: "rejected",
      decidedAt: now,
      expiresAt: null,
      errorSummary: null,
    })
    .where(
      and(
        eq(applicationActionRequest.id, requestId),
        eq(applicationActionRequest.userId, userId),
        inArray(applicationActionRequest.status, ["pending", "approved"]),
      ),
    )
    .returning();
  const updated =
    request.action === "submit_application"
      ? (
          await db.batch([
            db
              .update(application)
              .set({
                status: sql`case when ${application.status} = 'approved' then 'ready_to_apply' else ${application.status} end`,
                updatedAt: now,
              })
              .where(
                and(
                  eq(application.userId, userId),
                  eq(application.jobId, request.jobId),
                  rejectable,
                ),
              ),
            requestUpdate,
          ])
        )[1]
      : await requestUpdate;
  if (!updated[0]) {
    throw new ApplicationWorkflowError(
      "conflict",
      "The action changed before it could be rejected.",
    );
  }
  return updated[0];
}

export async function claimApprovedApplicationActionForUser({
  userId,
  tokenId,
  requestId,
  now = new Date(),
}: {
  userId: string;
  tokenId: string;
  requestId: string;
  now?: Date;
}) {
  const applicationCanBeSubmitted = exists(
    db
      .select({ id: application.id })
      .from(application)
      .where(
        and(
          eq(application.userId, applicationActionRequest.userId),
          eq(application.jobId, applicationActionRequest.jobId),
          notInArray(application.status, [...POST_SUBMISSION_STATUS_VALUES]),
        ),
      ),
  );
  const claimed = await db
    .update(applicationActionRequest)
    .set({
      status: "executing",
      claimedAt: now,
      claimedByTokenId: tokenId,
      errorSummary: null,
    })
    .where(
      and(
        eq(applicationActionRequest.id, requestId),
        eq(applicationActionRequest.userId, userId),
        eq(applicationActionRequest.status, "approved"),
        gt(applicationActionRequest.expiresAt, now),
        or(
          eq(applicationActionRequest.action, "send_email"),
          applicationCanBeSubmitted,
        ),
      ),
    )
    .returning();
  if (claimed[0]) return claimed[0];

  const request = await getOwnedActionRequest(userId, requestId);
  if (request.action === "submit_application") {
    await requireApplicationOpenForSubmission(userId, request.jobId);
  }
  if (
    request.status === "approved" &&
    request.expiresAt &&
    request.expiresAt.getTime() <= now.getTime()
  ) {
    await db
      .update(applicationActionRequest)
      .set({ status: "expired" })
      .where(
        and(
          eq(applicationActionRequest.id, requestId),
          eq(applicationActionRequest.userId, userId),
          eq(applicationActionRequest.status, "approved"),
          lte(applicationActionRequest.expiresAt, now),
        ),
      );
    throw new ApplicationWorkflowError(
      "expired",
      "The action approval expired. Request a new approval.",
    );
  }
  throw new ApplicationWorkflowError(
    "conflict",
    "The action is not available to claim.",
  );
}

function executingRequestGuard(
  userId: string,
  tokenId: string,
  requestId: string,
) {
  return exists(
    db
      .select({ id: applicationActionRequest.id })
      .from(applicationActionRequest)
      .where(
        and(
          eq(applicationActionRequest.id, requestId),
          eq(applicationActionRequest.userId, userId),
          eq(applicationActionRequest.status, "executing"),
          eq(applicationActionRequest.claimedByTokenId, tokenId),
        ),
      ),
  );
}

export async function completeClaimedApplicationActionForUser({
  userId,
  tokenId,
  requestId,
  now = new Date(),
}: {
  userId: string;
  tokenId: string;
  requestId: string;
  now?: Date;
}) {
  const request = await getOwnedActionRequest(userId, requestId);
  if (request.status !== "executing") {
    throw new ApplicationWorkflowError(
      "conflict",
      "Only a claimed action can be completed.",
    );
  }
  if (request.claimedByTokenId !== tokenId) {
    throw new ApplicationWorkflowError(
      "conflict",
      "This action was claimed by another agent key.",
    );
  }
  const guard = executingRequestGuard(userId, tokenId, requestId);
  const requestUpdate = db
    .update(applicationActionRequest)
    .set({
      status: "completed",
      completedAt: now,
      errorSummary: null,
    })
    .where(
      and(
        eq(applicationActionRequest.id, requestId),
        eq(applicationActionRequest.userId, userId),
        eq(applicationActionRequest.status, "executing"),
        eq(applicationActionRequest.claimedByTokenId, tokenId),
      ),
    )
    .returning();

  let completed: (typeof applicationActionRequest.$inferSelect)[];
  if (request.action === "send_email") {
    const results = await db.batch([
      db
        .update(applicationArtifact)
        .set({ usedAt: now, updatedAt: now })
        .where(
          and(
            eq(applicationArtifact.id, request.artifactId!),
            eq(applicationArtifact.userId, userId),
            guard,
          ),
        ),
      requestUpdate,
    ]);
    completed = results[1];
  } else {
    const parsed = SubmitApplicationActionRequestSchema.shape.payload.parse(
      request.payload,
    );
    const results = await db.batch([
      db
        .update(application)
        .set({
          status: sql`case when ${application.status} in ('interviewing', 'offered', 'rejected', 'withdrawn', 'closed') then ${application.status} else 'applied' end`,
          resumeId: parsed.resumeId,
          appliedAt: sql`coalesce(${application.appliedAt}, ${now})`,
          updatedAt: now,
        })
        .where(
          and(
            eq(application.userId, userId),
            eq(application.jobId, request.jobId),
            guard,
          ),
        ),
      db
        .update(jobListing)
        .set({ status: "applied" })
        .where(and(eq(jobListing.jobId, request.jobId), guard)),
      requestUpdate,
    ]);
    completed = results[2];
  }
  if (!completed[0]) {
    throw new ApplicationWorkflowError(
      "conflict",
      "The action changed before completion could be recorded.",
    );
  }
  return completed[0];
}

export async function failClaimedApplicationActionForUser({
  userId,
  tokenId,
  requestId,
  errorSummary,
  now = new Date(),
}: {
  userId: string;
  tokenId: string;
  requestId: string;
  errorSummary: string;
  now?: Date;
}) {
  const parsed = ApplicationActionFailureSchema.parse({ errorSummary });
  const request = await getOwnedActionRequest(userId, requestId);
  if (request.status !== "executing") {
    throw new ApplicationWorkflowError(
      "conflict",
      "Only a claimed action can be marked failed.",
    );
  }
  if (request.claimedByTokenId !== tokenId) {
    throw new ApplicationWorkflowError(
      "conflict",
      "This action was claimed by another agent key.",
    );
  }
  const guard = executingRequestGuard(userId, tokenId, requestId);
  const requestUpdate = db
    .update(applicationActionRequest)
    .set({
      status: "failed",
      completedAt: now,
      errorSummary: parsed.errorSummary,
    })
    .where(
      and(
        eq(applicationActionRequest.id, requestId),
        eq(applicationActionRequest.userId, userId),
        eq(applicationActionRequest.status, "executing"),
        eq(applicationActionRequest.claimedByTokenId, tokenId),
      ),
    )
    .returning();
  const failed =
    request.action === "submit_application"
      ? (
          await db.batch([
            db
              .update(application)
              .set({
                status: sql`case when ${application.status} = 'approved' then 'ready_to_apply' else ${application.status} end`,
                updatedAt: now,
              })
              .where(
                and(
                  eq(application.userId, userId),
                  eq(application.jobId, request.jobId),
                  guard,
                ),
              ),
            requestUpdate,
          ])
        )[1]
      : await requestUpdate;
  if (!failed[0]) {
    throw new ApplicationWorkflowError(
      "conflict",
      "The action changed before failure could be recorded.",
    );
  }
  return failed[0];
}

export async function loadApplicationWorkspaceForUser({
  userId,
  jobId,
  now = new Date(),
}: {
  userId: string;
  jobId: string;
  now?: Date;
}) {
  await requireOwnedJob(userId, jobId);
  await db
    .update(applicationActionRequest)
    .set({ status: "expired" })
    .where(
      and(
        eq(applicationActionRequest.userId, userId),
        eq(applicationActionRequest.jobId, jobId),
        eq(applicationActionRequest.status, "approved"),
        lte(applicationActionRequest.expiresAt, now),
      ),
    );
  const [artifacts, actionRequests] = await Promise.all([
    db
      .select()
      .from(applicationArtifact)
      .where(
        and(
          eq(applicationArtifact.userId, userId),
          eq(applicationArtifact.jobId, jobId),
        ),
      )
      .orderBy(desc(applicationArtifact.createdAt)),
    db
      .select()
      .from(applicationActionRequest)
      .where(
        and(
          eq(applicationActionRequest.userId, userId),
          eq(applicationActionRequest.jobId, jobId),
        ),
      )
      .orderBy(desc(applicationActionRequest.createdAt)),
  ]);
  return { artifacts, actionRequests };
}

export async function updateApplicationDetailsForUser({
  userId,
  jobId,
  input,
}: {
  userId: string;
  jobId: string;
  input: ApplicationDetailsInput;
}) {
  await requireOwnedJob(userId, jobId);
  const now = new Date();
  const isAppliedStatus = APPLIED_APPLICATION_STATUSES.has(input.status);
  const isPreApplicationStatus = PRE_APPLICATION_STATUSES.has(input.status);
  const applicationUpdate = db
    .insert(application)
    .values({
      id: randomUUID(),
      userId,
      jobId,
      ...input,
      appliedAt: isAppliedStatus ? now : null,
    })
    .onConflictDoUpdate({
      target: [application.userId, application.jobId],
      set: {
        ...input,
        ...(isAppliedStatus
          ? { appliedAt: sql`coalesce(${application.appliedAt}, ${now})` }
          : isPreApplicationStatus
            ? { appliedAt: null }
            : {}),
        updatedAt: now,
      },
    })
    .returning();
  const updated =
    isAppliedStatus
      ? (
          await db.batch([
            applicationUpdate,
            db
              .update(jobListing)
              .set({ status: "applied" })
              .where(eq(jobListing.jobId, jobId)),
          ])
        )[0]
      : await applicationUpdate;
  return updated[0];
}
