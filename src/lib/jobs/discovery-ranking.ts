import type { JobSearchProfileInput } from "./discovery";
import type { DiscoveredListing } from "./discovery";

type RankedListing = DiscoveredListing & { matchScore: number };

export type DiscoveryRankingPolicy = {
  minAnnualSalary?: number | null;
  minHourlySalary?: number | null;
  maxPostedAgeDays?: number | null;
  allowMissingCompensation?: boolean;
  now?: Date;
};

type CompensationRange = {
  interval: "annual" | "hourly";
  minimum: number;
  maximum: number;
};

type CompensationTier = 0 | 1 | 2 | 3;

type ResolvedDiscoveryRankingPolicy = {
  minAnnualSalary: number | null;
  minHourlySalary: number | null;
  maxPostedAgeDays: number | null;
  allowMissingCompensation: boolean;
};

type RankedCandidate = {
  listing: RankedListing;
  compensationTier: CompensationTier;
  postedAtTime: number | null;
};

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

const MONEY_TOKEN =
  "(?:(?:us)?\\$|usd\\s*)?(?:\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?)\\s*k?";
const PAY_INTERVAL =
  "(?:per\\s*(?:hour|year|annum|month|week|biweekly)|an\\s*hour|every\\s*two\\s*weeks|\\/\\s*(?:hr|hour|yr|year|mo|month|wk|week)|hourly|annual|yearly|monthly|biweekly|weekly)";
const RANGE_SEPARATOR = "(?:-|–|—|to)";

function parseMoneyToken(value: string): number | null {
  const match = /(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(k)?/i.exec(
    value,
  );
  if (!match) return null;
  const amount = Number(match[1]?.replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return amount * (match[2] ? 1_000 : 1);
}

function normalizePayRange(
  minimum: number,
  maximum: number,
  marker: string,
): CompensationRange {
  const normalized = marker.toLowerCase();
  if (/(?:hour|hr)/.test(normalized)) {
    return { interval: "hourly", minimum, maximum };
  }
  const multiplier = /month|mo/.test(normalized)
    ? 12
    : /biweekly|two\s*weeks/.test(normalized)
      ? 26
      : /week|wk/.test(normalized)
        ? 52
        : 1;
  return {
    interval: "annual",
    minimum: minimum * multiplier,
    maximum: maximum * multiplier,
  };
}

function parseCompensationRange(value: string | null | undefined): CompensationRange | null {
  if (!value) return null;
  const foreignDollarPrefix = [...value.matchAll(/\b([a-z]{1,3})\$/gi)].some(
    (match) => match[1]?.toLowerCase() !== "us",
  );
  if (
    foreignDollarPrefix ||
    /[€£₹¥₩]|\b(?:aed|aud|brl|cad|chf|cny|czk|dkk|eur|gbp|hkd|huf|ils|inr|jpy|krw|mxn|nok|nzd|pln|rmb|ron|sar|sek|sgd|twd|zar)\b/i.test(
      value,
    )
  ) {
    return null;
  }
  if (!/(?:\$|\busd\b)/i.test(value)) return null;

  const ranges: CompensationRange[] = [];
  const trailingInterval = new RegExp(
    `(${MONEY_TOKEN})(?:\\s*${RANGE_SEPARATOR}\\s*(${MONEY_TOKEN}))?\\s*(${PAY_INTERVAL})`,
    "gi",
  );
  for (const match of value.matchAll(trailingInterval)) {
    const minimum = parseMoneyToken(match[1] ?? "");
    const maximum = parseMoneyToken(match[2] ?? match[1] ?? "");
    if (minimum !== null && maximum !== null && match[3]) {
      ranges.push(normalizePayRange(minimum, maximum, match[3]));
    }
  }

  const leadingInterval = new RegExp(
    `(${PAY_INTERVAL})\\s*(?:rate|salary|pay)?\\s*:?\\s*(${MONEY_TOKEN})(?:\\s*${RANGE_SEPARATOR}\\s*(${MONEY_TOKEN}))?`,
    "gi",
  );
  for (const match of value.matchAll(leadingInterval)) {
    const minimum = parseMoneyToken(match[2] ?? "");
    const maximum = parseMoneyToken(match[3] ?? match[2] ?? "");
    if (minimum !== null && maximum !== null && match[1]) {
      ranges.push(normalizePayRange(minimum, maximum, match[1]));
    }
  }

  if (ranges.length > 0) {
    const intervals = new Set(ranges.map((range) => range.interval));
    if (intervals.size !== 1) return null;
    return {
      interval: ranges[0]?.interval ?? "annual",
      minimum: Math.min(...ranges.map((range) => range.minimum)),
      maximum: Math.max(...ranges.map((range) => range.maximum)),
    };
  }

  const standaloneRange = new RegExp(
    `^\\s*(?:(?:base|salary|pay|compensation|range)\\s*:?\\s*)?(${MONEY_TOKEN})(?:\\s*${RANGE_SEPARATOR}\\s*(${MONEY_TOKEN}))?\\s*$`,
    "i",
  ).exec(value);
  const minimum = parseMoneyToken(standaloneRange?.[1] ?? "");
  const maximum = parseMoneyToken(
    standaloneRange?.[2] ?? standaloneRange?.[1] ?? "",
  );
  if (minimum === null || maximum === null || maximum < 1_000) return null;
  return { interval: "annual", minimum, maximum };
}

function compensationTier(
  listing: DiscoveredListing,
  policy: ResolvedDiscoveryRankingPolicy,
): CompensationTier | null {
  const hasFloor =
    policy.minAnnualSalary !== null || policy.minHourlySalary !== null;
  if (!hasFloor) return 0;

  const compensation = parseCompensationRange(listing.compensationText);
  if (!compensation) return policy.allowMissingCompensation ? 1 : null;
  const floor =
    compensation.interval === "hourly"
      ? policy.minHourlySalary
      : policy.minAnnualSalary;
  if (floor === null) return policy.allowMissingCompensation ? 1 : null;
  if (compensation.maximum < floor) return null;
  return compensation.minimum >= floor ? 3 : 2;
}

function postedAtTime(listing: DiscoveredListing): number | null {
  if (!listing.postedAt) return null;
  const value = listing.postedAt.getTime();
  return Number.isFinite(value) ? value : null;
}

function freshnessScore(postedTime: number | null, now: Date): number {
  if (postedTime === null) return 0;
  const ageDays = Math.max(0, (now.getTime() - postedTime) / 86_400_000);
  if (ageDays <= 7) return 10;
  if (ageDays <= 30) return 7;
  if (ageDays <= 60) return 4;
  if (ageDays <= 90) return 2;
  return 0;
}

function persistedRankingScore(
  relevanceScore: number,
  compensation: CompensationTier,
): number {
  if (compensation === 3) return 76 + Math.round(relevanceScore * 0.24);
  if (compensation === 2) return 51 + Math.round(relevanceScore * 0.24);
  if (compensation === 1) return Math.round(relevanceScore * 0.5);
  return relevanceScore;
}

function scoreListing(
  listing: DiscoveredListing,
  profile: JobSearchProfileInput,
): number {
  const title = normalize(listing.title);
  const fullText = normalize(
    [
      listing.title,
      listing.company,
      listing.location,
      listing.employmentType,
      listing.compensationText,
    ]
      .filter(Boolean)
      .join(" "),
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
  policy: DiscoveryRankingPolicy = {},
): RankedListing[] {
  const now = policy.now ?? new Date();
  const resolvedPolicy = {
    minAnnualSalary:
      policy.minAnnualSalary === undefined
        ? profile.salaryMin
        : policy.minAnnualSalary,
    minHourlySalary: policy.minHourlySalary ?? null,
    maxPostedAgeDays: policy.maxPostedAgeDays ?? null,
    allowMissingCompensation: policy.allowMissingCompensation ?? true,
  };

  return listings
    .filter((listing) => {
      const haystack = normalize(
        [
          listing.title,
          listing.company,
          listing.location,
          listing.employmentType,
          listing.compensationText,
        ]
          .filter(Boolean)
          .join(" "),
      );
      if (
        profile.exclusions.some((exclusion) =>
          haystack.includes(normalize(exclusion)),
        )
      ) {
        return false;
      }
      const postedTime = postedAtTime(listing);
      if (
        postedTime !== null &&
        resolvedPolicy.maxPostedAgeDays !== null &&
        now.getTime() - postedTime >
          resolvedPolicy.maxPostedAgeDays * 86_400_000
      ) {
        return false;
      }
      return (
        matchesRemotePreference(listing.location, profile.remotePreference) &&
        matchesBasicFilters(haystack, profile.basicJobFilters) &&
        compensationTier(listing, resolvedPolicy) !== null
      );
    })
    .map((listing): RankedCandidate => {
      const tier = compensationTier(listing, resolvedPolicy) ?? 0;
      const time = postedAtTime(listing);
      const relevanceScore = Math.min(
        100,
        scoreListing(listing, profile) + freshnessScore(time, now),
      );
      return {
        listing: {
          ...listing,
          matchScore: persistedRankingScore(relevanceScore, tier),
        },
        compensationTier: tier,
        postedAtTime: time,
      };
    })
    .sort(
      (left, right) =>
        right.compensationTier - left.compensationTier ||
        right.listing.matchScore - left.listing.matchScore ||
        (right.postedAtTime ?? 0) - (left.postedAtTime ?? 0),
    )
    .map((candidate) => candidate.listing);
}
