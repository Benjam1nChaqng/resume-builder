import { fetchExternalHtml } from "@/lib/net/safe-fetch";
import { parseJobListingsFromHtml } from "./discovery";
import {
  completeDiscoveryRun,
  createDiscoveryRun,
  getEnabledSourcesForProfile,
  upsertDiscoveredListings,
} from "./discovery-repo";

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (compatible; ResumeBuilderBot/0.1; +https://github.com/Benjam1nChaqng/resume-builder)",
  Accept: "text/html,application/xhtml+xml",
};

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
      const { ok, status, html } = await fetchExternalHtml(source.url, {
        headers: FETCH_HEADERS,
      });
      if (!ok) {
        errors.push(`${source.label}: HTTP ${status}`);
        continue;
      }
      const listings = parseJobListingsFromHtml(html, source.url);
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

