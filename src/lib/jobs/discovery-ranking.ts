import type { JobSearchProfileInput } from "./discovery";
import type { DiscoveredListing } from "./discovery";

type RankedListing = DiscoveredListing & { matchScore: number };

const BASIC_FILTER_TERMS: Record<
  keyof JobSearchProfileInput["basicJobFilters"],
  string[]
> = {
  partTime: ["part time", "part-time"],
  hourly: ["hourly", "per hour"],
  entryLevel: ["entry level", "junior", "associate", "assistant", "trainee", "clerk"],
  retail: ["retail", "cashier", "store", "sales associate"],
  admin: ["admin", "coordinator", "receptionist", "office", "data entry"],
  service: ["service", "support", "hospitality", "server", "barista", "customer"],
  warehouse: ["warehouse", "fulfillment", "picker", "packer", "inventory", "material handler"],
  internship: ["intern", "internship"],
};

const STOP_WORDS = new Set(["a", "an", "and", "for", "in", "of", "or", "the", "to"]);

function normalize(value: string | null): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function meaningfulTokens(value: string): string[] {
  return normalize(value)
    .split(" ")
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function phraseScore(haystack: string, phrase: string): number {
  const normalizedPhrase = normalize(phrase);
  if (!normalizedPhrase) return 0;
  if (haystack.includes(normalizedPhrase)) return 1;
  const tokens = meaningfulTokens(phrase);
  if (tokens.length === 0) return 0;
  const words = new Set(haystack.split(" "));
  return tokens.filter((token) => words.has(token)).length / tokens.length;
}

function matchesRemotePreference(
  location: string | null,
  preference: JobSearchProfileInput["remotePreference"],
): boolean {
  if (preference === "any" || !location) return true;
  const normalized = normalize(location);
  if (preference === "remote") return normalized.includes("remote");
  if (preference === "hybrid") return normalized.includes("hybrid");
  return !normalized.includes("remote") || normalized.includes("hybrid");
}

function matchesBasicFilters(
  haystack: string,
  filters: JobSearchProfileInput["basicJobFilters"],
): boolean {
  const active = Object.entries(filters).filter(([, enabled]) => enabled) as Array<
    [keyof typeof filters, boolean]
  >;
  if (active.length === 0) return true;
  return active.some(([filter]) =>
    BASIC_FILTER_TERMS[filter].some((term) => haystack.includes(normalize(term))),
  );
}

function scoreListing(
  listing: DiscoveredListing,
  profile: JobSearchProfileInput,
): number {
  const title = normalize(listing.title);
  const fullText = normalize(
    [listing.title, listing.company, listing.location].filter(Boolean).join(" "),
  );
  const roleScore = Math.max(
    0,
    ...profile.targetRoles.map((role) => phraseScore(title, role)),
  );
  const keywordScore = Math.min(
    1,
    profile.keywords.reduce(
      (total, keyword) => total + phraseScore(fullText, keyword),
      0,
    ) / Math.max(1, Math.min(profile.keywords.length, 4)),
  );
  const locationScore = profile.locationPreference
    ? phraseScore(normalize(listing.location), profile.locationPreference)
    : 0;
  const remoteScore =
    profile.remotePreference !== "any" && listing.location
      ? matchesRemotePreference(listing.location, profile.remotePreference)
        ? 1
        : 0
      : 0;
  const hasBasicFilters = Object.values(profile.basicJobFilters).some(Boolean);

  return Math.min(
    100,
    Math.round(
      roleScore * 55 +
        keywordScore * 20 +
        locationScore * 15 +
        remoteScore * 10 +
        (hasBasicFilters ? 10 : 0),
    ),
  );
}

export function filterAndRankJobListings(
  listings: DiscoveredListing[],
  profile: JobSearchProfileInput,
): RankedListing[] {
  return listings
    .filter((listing) => {
      const haystack = normalize(
        [listing.title, listing.company, listing.location].filter(Boolean).join(" "),
      );
      if (
        profile.exclusions.some((exclusion) =>
          haystack.includes(normalize(exclusion)),
        )
      ) {
        return false;
      }
      return (
        matchesRemotePreference(listing.location, profile.remotePreference) &&
        matchesBasicFilters(haystack, profile.basicJobFilters)
      );
    })
    .map((listing) => ({
      ...listing,
      matchScore: scoreListing(listing, profile),
    }))
    .sort((left, right) => right.matchScore - left.matchScore);
}
