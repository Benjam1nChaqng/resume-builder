import { fetchJobFeed } from "./job-feed";
import type { SearchCriteria } from "./discovery";
import {
  completeDiscoveryRun,
  createDiscoveryRun,
  getOwnedProfile,
  requireProfileOwner,
  upsertDiscoveredListings,
} from "./discovery-repo";

export function profileToCriteria(profile: {
  targetRoles: string[];
  locationPreference: string | null;
  employmentType: string;
  salaryMin: number | null;
  jobFocus: string;
}): SearchCriteria {
  return {
    roles: profile.targetRoles,
    location: profile.locationPreference,
    employmentType: profile.employmentType as SearchCriteria["employmentType"],
    salaryMin: profile.salaryMin,
    jobFocus: profile.jobFocus as SearchCriteria["jobFocus"],
  };
}

/**
 * Pulls fresh listings for a saved search into the app. The user never supplies
 * a URL — we build the search from their criteria and fetch from a job feed.
 */
export async function runJobDiscovery({
  profileId,
  userId,
}: {
  profileId: string;
  userId: string;
}): Promise<{ discovered: number; errors: string[] }> {
  await requireProfileOwner(profileId, userId);
  const profile = await getOwnedProfile(profileId, userId);
  if (!profile) {
    throw new Error("Job search profile not found.");
  }

  const runId = await createDiscoveryRun(profileId);
  const errors: string[] = [];

  const { listings, error } = await fetchJobFeed(profileToCriteria(profile));
  if (error) errors.push(error);

  const discovered = await upsertDiscoveredListings({ profileId, listings });

  await completeDiscoveryRun(
    runId,
    error && discovered === 0 ? "failed" : "completed",
    errors.length > 0 ? errors.join("; ") : undefined,
  );

  return { discovered, errors };
}
