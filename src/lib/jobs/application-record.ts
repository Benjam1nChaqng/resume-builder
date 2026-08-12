import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  application,
  jobListing,
  jobPipelineEvent,
  jobSearchProfile,
} from "@/lib/db/jobs-schema";
import { requireJobAccess } from "./access";

export const ApplicationNotesSchema = z.string().trim().max(4_000, {
  message: "Notes must be 4,000 characters or fewer.",
});

export type JobPipelineStatus =
  | "discovered"
  | "saved"
  | "rejected"
  | "tailored"
  | "applied";

export type JobPipelineHistoryItem = {
  id: string;
  status: JobPipelineStatus;
  occurredAt: Date;
  restored: boolean;
};

export function mergeJobPipelineHistory(
  listings: Array<{ id: string; discoveredAt: Date }>,
  events: Array<{
    id: string;
    status: JobPipelineStatus;
    occurredAt: Date;
  }>,
): JobPipelineHistoryItem[] {
  return [
    ...listings.map((listing) => ({
      id: `discovered:${listing.id}`,
      status: "discovered" as const,
      occurredAt: listing.discoveredAt,
      restored: false,
    })),
    ...events.map((event) => ({
      ...event,
      restored: event.status === "discovered",
    })),
  ].sort(
    (left, right) =>
      left.occurredAt.getTime() - right.occurredAt.getTime() ||
      left.id.localeCompare(right.id),
  );
}

export async function updateApplicationNotes({
  jobId,
  notes,
}: {
  jobId: string;
  notes: string;
}): Promise<void> {
  const { userId } = await requireJobAccess(jobId);
  const normalizedNotes = ApplicationNotesSchema.parse(notes) || null;
  await db
    .insert(application)
    .values({
      id: randomUUID(),
      userId,
      jobId,
      status: "draft",
      notes: normalizedNotes,
    })
    .onConflictDoUpdate({
      target: [application.userId, application.jobId],
      set: { notes: normalizedNotes },
    });
}

export async function getJobPipelineHistoryForUser({
  jobId,
  userId,
}: {
  jobId: string;
  userId: string;
}): Promise<JobPipelineHistoryItem[]> {
  const listings = await db
    .select({ id: jobListing.id, discoveredAt: jobListing.discoveredAt })
    .from(jobListing)
    .innerJoin(jobSearchProfile, eq(jobListing.profileId, jobSearchProfile.id))
    .where(
      and(
        eq(jobListing.jobId, jobId),
        eq(jobSearchProfile.userId, userId),
      ),
    );
  const listingIds = listings.map((listing) => listing.id);
  const eventSubject =
    listingIds.length > 0
      ? or(
          eq(jobPipelineEvent.jobId, jobId),
          inArray(jobPipelineEvent.listingId, listingIds),
        )
      : eq(jobPipelineEvent.jobId, jobId);
  const events = await db
    .select({
      id: jobPipelineEvent.id,
      status: jobPipelineEvent.status,
      occurredAt: jobPipelineEvent.occurredAt,
    })
    .from(jobPipelineEvent)
    .where(and(eq(jobPipelineEvent.userId, userId), eventSubject))
    .orderBy(asc(jobPipelineEvent.occurredAt));

  return mergeJobPipelineHistory(
    listings,
    events.map((event) => ({
      ...event,
      status: event.status as JobPipelineStatus,
    })),
  );
}
