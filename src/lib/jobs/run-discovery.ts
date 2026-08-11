import {
  completeDiscoveryRun,
  createDiscoveryRun,
  getEnabledSourcesForProfile,
  getSearchProfileForDiscovery,
  upsertDiscoveredListings,
} from "./discovery-repo";
import { filterAndRankJobListings } from "./discovery-ranking";
import { mapWithConcurrency } from "./concurrency";
import {
  DiscoveryRetryError,
  retryDiscoveryOperation,
  type DiscoveryRetryOptions,
} from "./discovery-retry";
import {
  attributeListingsToSourceCompany,
  discoverListingsFromSource,
} from "./source-adapters";

const SOURCE_CONCURRENCY = 3;

export async function runJobDiscovery({
  profileId,
  userId,
}: {
  profileId: string;
  userId: string;
}, dependencies: {
  retry?: DiscoveryRetryOptions;
} = {}): Promise<{ discovered: number; errors: string[] }> {
  const [sources, profile] = await Promise.all([
    getEnabledSourcesForProfile(profileId, userId),
    getSearchProfileForDiscovery(profileId, userId),
  ]);
  const runId = await createDiscoveryRun(profileId);
  const outcomes = await mapWithConcurrency(sources, SOURCE_CONCURRENCY, async (source) => {
    const startedAt = Date.now();
    try {
      const { value: rawListings, attempts } = await retryDiscoveryOperation(
        () => discoverListingsFromSource(source.url),
        dependencies.retry,
      );
      const listings = filterAndRankJobListings(
        attributeListingsToSourceCompany(rawListings, {
          sourceUrl: source.url,
          sourceLabel: source.label,
        }),
        profile,
      );
      const discovered = await upsertDiscoveredListings({
        profileId,
        sourceId: source.id,
        listings,
      });
      return {
        sourceId: source.id,
        label: source.label,
        discovered,
        attempts,
        durationMs: Date.now() - startedAt,
        error: null,
      };
    } catch (err) {
      return {
        sourceId: source.id,
        label: source.label,
        discovered: 0,
        attempts: err instanceof DiscoveryRetryError ? err.attempts : 1,
        durationMs: Date.now() - startedAt,
        error: `${source.label}: ${err instanceof Error ? err.message : "unknown error"}`,
      };
    }
  });
  const discovered = outcomes.reduce((total, outcome) => total + outcome.discovered, 0);
  const errors = outcomes
    .map((outcome) => outcome.error)
    .filter((error): error is string => Boolean(error));

  const status =
    errors.length === 0
      ? "completed"
      : errors.length === sources.length && sources.length > 0
        ? "failed"
        : "partial";
  await completeDiscoveryRun(
    runId,
    status,
    errors.length > 0 ? errors.join("; ") : undefined,
    discovered,
    outcomes.map((outcome) => ({
      sourceId: outcome.sourceId,
      label: outcome.label,
      status: outcome.error ? "failed" : "completed",
      inserted: outcome.discovered,
      attempts: outcome.attempts,
      durationMs: outcome.durationMs,
      ...(outcome.error ? { error: outcome.error } : {}),
    })),
  );
  return { discovered, errors };
}
