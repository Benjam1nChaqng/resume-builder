import {
  completeDiscoveryRun,
  createDiscoveryRun,
  getEnabledSourcesForProfile,
  getSearchProfileForDiscovery,
  upsertDiscoveredListings,
} from "./discovery-repo";
import { filterAndRankJobListings } from "./discovery-ranking";
import { mapWithConcurrency } from "./concurrency";
import { discoverListingsFromSource } from "./source-adapters";

const SOURCE_CONCURRENCY = 3;

export async function runJobDiscovery({
  profileId,
  userId,
}: {
  profileId: string;
  userId: string;
}): Promise<{ discovered: number; errors: string[] }> {
  const [sources, profile] = await Promise.all([
    getEnabledSourcesForProfile(profileId, userId),
    getSearchProfileForDiscovery(profileId, userId),
  ]);
  const runId = await createDiscoveryRun(profileId);
  const outcomes = await mapWithConcurrency(sources, SOURCE_CONCURRENCY, async (source) => {
    try {
      const listings = filterAndRankJobListings(
        await discoverListingsFromSource(source.url),
        profile,
      );
      const discovered = await upsertDiscoveredListings({
        profileId,
        sourceId: source.id,
        listings,
      });
      return { discovered, error: null };
    } catch (err) {
      return {
        discovered: 0,
        error: `${source.label}: ${err instanceof Error ? err.message : "unknown error"}`,
      };
    }
  });
  const discovered = outcomes.reduce((total, outcome) => total + outcome.discovered, 0);
  const errors = outcomes
    .map((outcome) => outcome.error)
    .filter((error): error is string => Boolean(error));

  await completeDiscoveryRun(
    runId,
    errors.length === sources.length && sources.length > 0 ? "failed" : "completed",
    errors.length > 0 ? errors.join("; ") : undefined,
  );
  return { discovered, errors };
}
