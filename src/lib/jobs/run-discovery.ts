import { parseJobListingsFromHtml } from "./discovery";
import { fetchPublicHtml } from "./public-web";
import {
  completeDiscoveryRun,
  createDiscoveryRun,
  getEnabledSourcesForProfile,
  upsertDiscoveredListings,
} from "./discovery-repo";

export async function runJobDiscovery({
  profileId,
  userId,
}: {
  profileId: string;
  userId: string;
}): Promise<{ discovered: number; errors: string[] }> {
  const sources = await getEnabledSourcesForProfile(profileId, userId);
  const runId = await createDiscoveryRun(profileId);
  let discovered = 0;
  const errors: string[] = [];

  for (const source of sources) {
    try {
      const { html, finalUrl } = await fetchPublicHtml(source.url);
      const listings = parseJobListingsFromHtml(html, finalUrl);
      discovered += await upsertDiscoveredListings({
        profileId,
        sourceId: source.id,
        listings,
      });
    } catch (err) {
      errors.push(
        `${source.label}: ${err instanceof Error ? err.message : "unknown error"}`,
      );
    }
  }

  await completeDiscoveryRun(
    runId,
    errors.length === sources.length && sources.length > 0 ? "failed" : "completed",
    errors.length > 0 ? errors.join("; ") : undefined,
  );
  return { discovered, errors };
}
