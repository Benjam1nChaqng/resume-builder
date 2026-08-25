import { fetchPublicJson } from "./public-web";
import {
  canonicalizeJobUrl,
  type DiscoveredListing,
  type SearchCriteria,
} from "./discovery";

/**
 * Pulls real listings into the app from a free, no-key job feed (Remotive),
 * so the user gets actual jobs without hunting for URLs. Remotive covers
 * remote/professional roles; local/hourly work is served by the search links
 * instead, so we skip the feed when the focus is purely local.
 *
 * The fetch is best-effort: if the feed is down or unreachable we return an
 * empty list with a note, and the UI falls back to the one-click search links.
 */
const REMOTIVE_ENDPOINT = "https://remotive.com/api/remote-jobs";
const MAX_LISTINGS = 25;

type RemotiveJob = {
  url?: unknown;
  title?: unknown;
  company_name?: unknown;
  job_type?: unknown;
  candidate_required_location?: unknown;
  salary?: unknown;
  publication_date?: unknown;
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function humanizeJobType(jobType: string | null): string | null {
  if (!jobType) return null;
  const dashed = jobType.replace(/_/g, "-");
  return dashed.charAt(0).toUpperCase() + dashed.slice(1);
}

function asDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Pure: turn a Remotive API payload into our listing shape. */
export function normalizeRemotiveJobs(
  payload: unknown,
  criteria: Pick<SearchCriteria, "employmentType">,
): DiscoveredListing[] {
  const jobs =
    payload && typeof payload === "object" && Array.isArray((payload as { jobs?: unknown }).jobs)
      ? ((payload as { jobs: RemotiveJob[] }).jobs)
      : [];

  const listings: DiscoveredListing[] = [];
  const seen = new Set<string>();

  for (const job of jobs) {
    const rawUrl = asString(job.url);
    const title = asString(job.title);
    if (!rawUrl || !title) continue;

    const jobType = asString(job.job_type);
    if (criteria.employmentType !== "any" && jobType !== criteria.employmentType) {
      continue;
    }

    let canonicalUrl: string;
    try {
      canonicalUrl = canonicalizeJobUrl(rawUrl);
    } catch {
      continue;
    }
    if (seen.has(canonicalUrl)) continue;
    seen.add(canonicalUrl);

    const location = [
      asString(job.candidate_required_location),
      humanizeJobType(jobType),
    ]
      .filter(Boolean)
      .join(" | ");

    listings.push({
      canonicalUrl,
      title: title.slice(0, 180),
      company: asString(job.company_name),
      location: location || null,
      compensationText: asString(job.salary),
      postedAt: asDate(job.publication_date),
    });

    if (listings.length >= MAX_LISTINGS) break;
  }

  return listings;
}

export async function fetchJobFeed(
  criteria: SearchCriteria,
): Promise<{ listings: DiscoveredListing[]; error: string | null }> {
  // Remotive is remote/professional only, so local searches use site links.
  if (criteria.jobFocus === "local") {
    return { listings: [], error: null };
  }

  const search = criteria.roles.filter(Boolean)[0] ?? "";
  const params = new URLSearchParams({ limit: String(MAX_LISTINGS) });
  if (search) params.set("search", search);

  try {
    const { data } = await fetchPublicJson(
      `${REMOTIVE_ENDPOINT}?${params.toString()}`,
      { timeoutMs: 12_000 },
    );
    return { listings: normalizeRemotiveJobs(data, criteria), error: null };
  } catch (err) {
    return {
      listings: [],
      error: err instanceof Error ? err.message : "Job feed unavailable",
    };
  }
}
