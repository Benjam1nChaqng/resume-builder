import { z } from "zod";
import {
  canonicalizeJobUrl,
  type DiscoveredListing,
} from "@/lib/jobs/discovery";
import {
  getSearchProfileForDiscovery,
  upsertDiscoveredListings,
} from "@/lib/jobs/discovery-repo";
import { filterAndRankJobListings } from "@/lib/jobs/discovery-ranking";

const nullableText = (max: number) =>
  z.string().trim().max(max).nullable().optional().default(null);

export const AgentListingSchema = z.object({
  url: z
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
  title: z.string().trim().min(1).max(180),
  company: nullableText(180),
  location: nullableText(240),
  employmentType: nullableText(80),
  compensationText: nullableText(240),
  postedAt: z.iso.datetime().nullable().optional().default(null),
  matchScore: z.number().int().min(0).max(100).optional(),
});

export const AgentListingBatchSchema = z.object({
  profileId: z.string().min(1),
  listings: z.array(AgentListingSchema).min(1).max(100),
});

export type AgentListingBatch = z.infer<typeof AgentListingBatchSchema>;

export async function ingestAgentListings({
  userId,
  input,
}: {
  userId: string;
  input: AgentListingBatch;
}) {
  const profile = await getSearchProfileForDiscovery(input.profileId, userId);
  const suppliedScores = new Map(
    input.listings
      .filter((listing) => listing.matchScore !== undefined)
      .map((listing) => [listing.url, listing.matchScore!]),
  );
  const normalized: DiscoveredListing[] = input.listings.map((listing) => ({
    canonicalUrl: listing.url,
    title: listing.title,
    company: listing.company,
    location: listing.location,
    employmentType: listing.employmentType,
    compensationText: listing.compensationText,
    postedAt: listing.postedAt ? new Date(listing.postedAt) : null,
  }));
  const ranked = filterAndRankJobListings(normalized, profile).map((listing) => ({
    ...listing,
    matchScore: suppliedScores.get(listing.canonicalUrl) ?? listing.matchScore,
  }));
  const inserted = await upsertDiscoveredListings({
    profileId: input.profileId,
    sourceId: null,
    listings: ranked,
  });

  return {
    received: input.listings.length,
    accepted: ranked.length,
    inserted,
    duplicates: ranked.length - inserted,
    filtered: input.listings.length - ranked.length,
  };
}
