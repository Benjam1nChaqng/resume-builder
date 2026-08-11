import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  jobDiscoveryRun,
  jobListing,
  jobSearchProfile,
  jobSource,
  type DiscoverySourceResult,
} from "@/lib/db/jobs-schema";
import type {
  DiscoveredListing,
  JobSearchProfileInput,
  JobSourceInput,
} from "./discovery";
import { JobSearchProfileInputSchema } from "./discovery";
import { buildJobListingFingerprint } from "./discovery";
import { assertPublicHttpUrl } from "./public-web";

export async function createJobSearchProfile(
  userId: string,
  input: JobSearchProfileInput,
): Promise<string> {
  const id = randomUUID();
  await db.insert(jobSearchProfile).values({ id, userId, ...input });
  return id;
}

export async function updateJobSearchProfileForUser(
  userId: string,
  profileId: string,
  input: JobSearchProfileInput,
): Promise<void> {
  await requireProfileOwner(profileId, userId);
  await db
    .update(jobSearchProfile)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(jobSearchProfile.id, profileId));
}

export async function deleteJobSearchProfileForUser(
  userId: string,
  profileId: string,
): Promise<void> {
  const deleted = await db
    .delete(jobSearchProfile)
    .where(
      and(eq(jobSearchProfile.id, profileId), eq(jobSearchProfile.userId, userId)),
    )
    .returning({ id: jobSearchProfile.id });
  if (!deleted[0]) throw new Error("Job search profile not found.");
}

export async function createJobSourceForUser(
  userId: string,
  input: JobSourceInput,
): Promise<string> {
  await requireProfileOwner(input.profileId, userId);
  await assertPublicHttpUrl(input.url);
  const id = randomUUID();
  const inserted = await db
    .insert(jobSource)
    .values({ id, profileId: input.profileId, label: input.label, url: input.url })
    .onConflictDoNothing()
    .returning({ id: jobSource.id });
  if (!inserted[0]) throw new Error("This source is already added to the profile.");
  return id;
}

async function requireSourceOwner(
  sourceId: string,
  userId: string,
): Promise<{ profileId: string }> {
  const rows = await db
    .select({ profileId: jobSource.profileId })
    .from(jobSource)
    .innerJoin(jobSearchProfile, eq(jobSource.profileId, jobSearchProfile.id))
    .where(and(eq(jobSource.id, sourceId), eq(jobSearchProfile.userId, userId)))
    .limit(1);
  if (!rows[0]) throw new Error("Job source not found.");
  return rows[0];
}

export async function setJobSourceEnabledForUser(
  userId: string,
  sourceId: string,
  enabled: boolean,
): Promise<string> {
  const source = await requireSourceOwner(sourceId, userId);
  await db.update(jobSource).set({ enabled }).where(eq(jobSource.id, sourceId));
  return source.profileId;
}

export async function deleteJobSourceForUser(
  userId: string,
  sourceId: string,
): Promise<string> {
  const source = await requireSourceOwner(sourceId, userId);
  await db.delete(jobSource).where(eq(jobSource.id, sourceId));
  return source.profileId;
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
      runs: {
        orderBy: (cols, { desc }) => [desc(cols.startedAt)],
        limit: 1,
      },
      listings: {
        orderBy: (cols, { desc }) => [
          desc(cols.matchScore),
          desc(cols.discoveredAt),
        ],
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

export async function getSearchProfileForDiscovery(
  profileId: string,
  userId: string,
): Promise<JobSearchProfileInput> {
  const rows = await db
    .select({
      candidateName: jobSearchProfile.candidateName,
      targetRoles: jobSearchProfile.targetRoles,
      locationPreference: jobSearchProfile.locationPreference,
      remotePreference: jobSearchProfile.remotePreference,
      experienceLevel: jobSearchProfile.experienceLevel,
      keywords: jobSearchProfile.keywords,
      exclusions: jobSearchProfile.exclusions,
      basicJobFilters: jobSearchProfile.basicJobFilters,
    })
    .from(jobSearchProfile)
    .where(and(eq(jobSearchProfile.id, profileId), eq(jobSearchProfile.userId, userId)))
    .limit(1);
  const profile = rows[0];
  if (!profile) throw new Error("Job search profile not found.");
  return JobSearchProfileInputSchema.parse(profile);
}

export async function createDiscoveryRun(profileId: string): Promise<string> {
  const id = randomUUID();
  await db.insert(jobDiscoveryRun).values({ id, profileId, status: "running" });
  return id;
}

export async function completeDiscoveryRun(
  runId: string,
  status: "completed" | "partial" | "failed",
  errorSummary?: string,
  insertedCount = 0,
  sourceResults: DiscoverySourceResult[] = [],
): Promise<void> {
  await db
    .update(jobDiscoveryRun)
    .set({
      status,
      completedAt: new Date(),
      errorSummary: errorSummary ?? null,
      insertedCount,
      sourceResults,
    })
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
        fingerprint: buildJobListingFingerprint(listing),
        title: listing.title,
        company: listing.company,
        location: listing.location,
        employmentType: listing.employmentType ?? null,
        compensationText: listing.compensationText ?? null,
        postedAt: listing.postedAt ?? null,
        matchScore: listing.matchScore ?? 0,
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
  status: "discovered" | "saved" | "rejected" | "tailored" | "applied";
  jobId?: string;
}): Promise<string> {
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
  return rows[0].profileId;
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
