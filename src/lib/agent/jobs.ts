import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { JobDescriptionSchema } from "@/lib/ai/jd-scraper/schema";
import { db } from "@/lib/db";
import { application, job } from "@/lib/db/jobs-schema";
import { canonicalizeJobUrl } from "@/lib/jobs/discovery";
import {
  getDiscoveredListingForUser,
  updateListingStatusForUser,
} from "@/lib/jobs/discovery-repo";
import { insertJob } from "@/lib/jobs/repo";

export const AgentStructuredJobSchema = JobDescriptionSchema.extend({
  sourceUrl: z
    .string()
    .trim()
    .url()
    .transform((value, context) => {
      try {
        return canonicalizeJobUrl(value);
      } catch (error) {
        context.addIssue({
          code: "custom",
          message: error instanceof Error ? error.message : "Invalid job URL.",
        });
        return z.NEVER;
      }
    }),
  listingId: z.string().min(1).optional(),
  researchNotes: z.string().trim().max(4_000).nullable().optional(),
});

export type AgentStructuredJob = z.infer<typeof AgentStructuredJobSchema>;

export async function saveAgentStructuredJob({
  userId,
  input,
}: {
  userId: string;
  input: AgentStructuredJob;
}) {
  const listing = input.listingId
    ? await getDiscoveredListingForUser({ userId, listingId: input.listingId })
    : null;
  if (input.listingId && !listing) throw new Error("Job listing not found.");
  if (listing && listing.canonicalUrl !== input.sourceUrl) {
    throw new Error("The structured job URL does not match the selected listing.");
  }
  if (listing?.status === "rejected") {
    throw new Error("Rejected listings must be restored before they can be saved.");
  }

  const existing = await db
    .select({ id: job.id })
    .from(job)
    .where(and(eq(job.userId, userId), eq(job.sourceUrl, input.sourceUrl)))
    .limit(1);
  const parsed = JobDescriptionSchema.parse(input);
  const jobId =
    existing[0]?.id ??
    (await insertJob({ userId, sourceUrl: input.sourceUrl, parsed }));
  if (listing?.jobId && listing.jobId !== jobId) {
    throw new Error("The selected listing is already linked to another job.");
  }

  const applicationUpdate = {
    status: sql`case when ${application.status} in ('tailored', 'applied') then ${application.status} else 'draft' end`,
    ...(input.researchNotes !== undefined
      ? { notes: input.researchNotes || null }
      : {}),
  };
  await db
    .insert(application)
    .values({
      id: randomUUID(),
      userId,
      jobId,
      status: "draft",
      notes: input.researchNotes || null,
    })
    .onConflictDoUpdate({
      target: [application.userId, application.jobId],
      set: applicationUpdate,
    });

  if (listing?.status === "discovered") {
    await updateListingStatusForUser({
      userId,
      listingId: listing.id,
      status: "saved",
      jobId,
    });
  }

  return { jobId, created: existing.length === 0 };
}
