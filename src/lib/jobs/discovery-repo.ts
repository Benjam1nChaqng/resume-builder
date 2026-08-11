import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  jobDiscoveryRun,
  jobListing,
  jobSearchProfile,
  jobSource,
} from "@/lib/db/jobs-schema";
import type {
  DiscoveredListing,
  JobSearchProfileInput,
  JobSourceInput,
} from "./discovery";
import { assertPublicHttpUrl } from "./public-web";

export async function createJobSearchProfile(
  userId: string,
  input: JobSearchProfileInput,
): Promise<string> {
  const id = randomUUID();
  await db.insert(jobSearchProfile).values({ id, userId, ...input });
  return id;
}

export async function createJobSourceForUser(
  userId: string,
  input: JobSourceInput,
): Promise<string> {
  await requireProfileOwner(input.profileId, userId);
  await assertPublicHttpUrl(input.url);
  const id = randomUUID();
  await db
    .insert(jobSource)
    .values({ id, profileId: input.profileId, label: input.label, url: input.url })
    .onConflictDoNothing();
  return id;
}

export async function requireProfileOwner(
  profileId: string,
  userId: string,
): Promise<void> {
  const rows = await db
    .select({ id: jobSearchProfile.id })
    .from(jobSearchProfile)
    .where(and(eq(jobSearchProfile.id, profileId), eq(jobSearchProfile.userId, userId)))
    .limit(1);
  if (!rows[0]) throw new Error("Job search profile not found.");
}

export async function listDiscoveryData(userId: string) {
  const profiles = await db.query.jobSearchProfile.findMany({
    where: eq(jobSearchProfile.userId, userId),
    orderBy: (cols, { desc }) => [desc(cols.updatedAt)],
    with: {
      sources: true,
      listings: {
        orderBy: (cols, { desc }) => [desc(cols.discoveredAt)],
      },
    },
  });
  return profiles;
}

export async function getEnabledSourcesForProfile(
  profileId: string,
  userId: string,
) {
  await requireProfileOwner(profileId, userId);
  return db
    .select()
    .from(jobSource)
    .where(and(eq(jobSource.profileId, profileId), eq(jobSource.enabled, true)));
}

export async function createDiscoveryRun(profileId: string): Promise<string> {
  const id = randomUUID();
  await db.insert(jobDiscoveryRun).values({ id, profileId, status: "running" });
  return id;
}

export async function completeDiscoveryRun(
  runId: string,
  status: "completed" | "failed",
  errorSummary?: string,
): Promise<void> {
  await db
    .update(jobDiscoveryRun)
    .set({ status, completedAt: new Date(), errorSummary: errorSummary ?? null })
    .where(eq(jobDiscoveryRun.id, runId));
}

export async function upsertDiscoveredListings({
  profileId,
  sourceId,
  listings,
}: {
  profileId: string;
  sourceId: string;
  listings: DiscoveredListing[];
}): Promise<number> {
  if (listings.length === 0) return 0;
  const inserted = await db
    .insert(jobListing)
    .values(
      listings.map((listing) => ({
        profileId,
        sourceId,
        canonicalUrl: listing.canonicalUrl,
        title: listing.title,
        company: listing.company,
        location: listing.location,
      })),
    )
    .onConflictDoNothing()
    .returning({ id: jobListing.id });
  return inserted.length;
}

export async function updateListingStatusForUser({
  userId,
  listingId,
  status,
  jobId,
}: {
  userId: string;
  listingId: string;
  status: "saved" | "rejected" | "tailored" | "applied";
  jobId?: string;
}): Promise<void> {
  const rows = await db
    .select({ profileId: jobListing.profileId })
    .from(jobListing)
    .innerJoin(jobSearchProfile, eq(jobListing.profileId, jobSearchProfile.id))
    .where(and(eq(jobListing.id, listingId), eq(jobSearchProfile.userId, userId)))
    .limit(1);
  if (!rows[0]) throw new Error("Job listing not found.");

  await db
    .update(jobListing)
    .set({ status, ...(jobId ? { jobId } : {}) })
    .where(eq(jobListing.id, listingId));
}

export async function getDiscoveredListingForUser({
  userId,
  listingId,
}: {
  userId: string;
  listingId: string;
}) {
  const rows = await db
    .select({
      id: jobListing.id,
      canonicalUrl: jobListing.canonicalUrl,
      jobId: jobListing.jobId,
      status: jobListing.status,
    })
    .from(jobListing)
    .innerJoin(jobSearchProfile, eq(jobListing.profileId, jobSearchProfile.id))
    .where(and(eq(jobListing.id, listingId), eq(jobSearchProfile.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getRecentProfiles(userId: string) {
  return db
    .select({
      id: jobSearchProfile.id,
      candidateName: jobSearchProfile.candidateName,
    })
    .from(jobSearchProfile)
    .where(eq(jobSearchProfile.userId, userId))
    .orderBy(desc(jobSearchProfile.updatedAt));
}
