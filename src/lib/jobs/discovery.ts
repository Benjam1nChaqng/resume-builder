import { z } from "zod";
import { normalizeHttpUrl } from "./public-web";

export const BASIC_JOB_FILTERS = [
  "partTime",
  "hourly",
  "entryLevel",
  "retail",
  "admin",
  "service",
  "warehouse",
  "internship",
] as const;

export const JobSearchFiltersSchema = z.object({
  partTime: z.boolean().default(false),
  hourly: z.boolean().default(false),
  entryLevel: z.boolean().default(false),
  retail: z.boolean().default(false),
  admin: z.boolean().default(false),
  service: z.boolean().default(false),
  warehouse: z.boolean().default(false),
  internship: z.boolean().default(false),
});

export const JobSearchProfileInputSchema = z.object({
  candidateName: z.string().trim().min(1),
  targetRoles: z.array(z.string().trim().min(1)).min(1),
  locationPreference: z.string().trim().nullable().default(null),
  remotePreference: z.enum(["any", "remote", "hybrid", "onsite"]).default("any"),
  experienceLevel: z.string().trim().nullable().default(null),
  keywords: z.array(z.string().trim().min(1)).default([]),
  exclusions: z.array(z.string().trim().min(1)).default([]),
  basicJobFilters: JobSearchFiltersSchema.default({
    partTime: false,
    hourly: false,
    entryLevel: false,
    retail: false,
    admin: false,
    service: false,
    warehouse: false,
    internship: false,
  }),
});

export const JobSourceInputSchema = z.object({
  profileId: z.string().min(1),
  label: z.string().trim().min(1),
  url: z
    .string()
    .trim()
    .url()
    .transform((value, context) => {
      try {
        return normalizeHttpUrl(value);
      } catch (error) {
        context.addIssue({
          code: "custom",
          message: error instanceof Error ? error.message : "Invalid source URL.",
        });
        return z.NEVER;
      }
    }),
});

export type JobSearchProfileInput = z.infer<typeof JobSearchProfileInputSchema>;
export type JobSourceInput = z.infer<typeof JobSourceInputSchema>;

export type DiscoveredListing = {
  canonicalUrl: string;
  title: string;
  company: string | null;
  location: string | null;
  employmentType?: string | null;
  compensationText?: string | null;
  postedAt?: Date | null;
  matchScore?: number;
};

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gh_src",
  "ref",
  "source",
]);

export function canonicalizeJobUrl(rawUrl: string, baseUrl?: string): string {
  const url = new URL(rawUrl, baseUrl);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.has(key.toLowerCase())) {
      url.searchParams.delete(key);
    }
  }
  url.hostname = url.hostname.toLowerCase();
  if (url.pathname !== "/" && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }
  return url.toString();
}

function normalizeFingerprintPart(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(incorporated|corporation|company|limited|inc|corp|llc|ltd|co)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildJobListingFingerprint({
  company,
  title,
  location,
}: {
  company: string | null;
  title: string;
  location?: string | null;
}): string | null {
  if (!company) return null;
  const normalizedCompany = normalizeFingerprintPart(company);
  const normalizedTitle = normalizeFingerprintPart(title);
  if (!normalizedCompany || !normalizedTitle) return null;
  const normalizedLocation = location
    ? normalizeFingerprintPart(location)
    : "";
  return [normalizedCompany, normalizedTitle, normalizedLocation]
    .filter(Boolean)
    .join("|");
}

function decodeHtml(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(text: string): string {
  return decodeHtml(text.replace(/<[^>]*>/g, " "));
}

function addListing(
  listings: DiscoveredListing[],
  seen: Set<string>,
  listing: DiscoveredListing,
): void {
  if (seen.has(listing.canonicalUrl) || listings.length >= 50) return;
  seen.add(listing.canonicalUrl);
  listings.push(listing);
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasJobPostingType(value: unknown): boolean {
  const types = Array.isArray(value) ? value : [value];
  return types.some(
    (type) => typeof type === "string" && type.toLowerCase() === "jobposting",
  );
}

function collectJobPostings(value: unknown, postings: JsonRecord[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectJobPostings(item, postings);
    return;
  }
  if (!isRecord(value)) return;
  if (hasJobPostingType(value["@type"])) postings.push(value);
  if (value["@graph"]) collectJobPostings(value["@graph"], postings);
}

function textValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? stripTags(value) : null;
}

function organizationName(value: unknown): string | null {
  if (!isRecord(value)) return null;
  return textValue(value.name);
}

function locationFromAddress(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const address = isRecord(value.address) ? value.address : value;
  const country = isRecord(address.addressCountry)
    ? textValue(address.addressCountry.name)
    : textValue(address.addressCountry);
  const parts = [
    textValue(address.addressLocality),
    textValue(address.addressRegion),
    country,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? [...new Set(parts)].join(", ") : null;
}

function jobLocation(posting: JsonRecord): string | null {
  if (
    textValue(posting.jobLocationType)?.toLowerCase().includes("telecommute") ||
    textValue(posting.jobLocationType)?.toLowerCase().includes("remote")
  ) {
    return "Remote";
  }
  const locations = Array.isArray(posting.jobLocation)
    ? posting.jobLocation
    : [posting.jobLocation];
  const values = locations
    .map(locationFromAddress)
    .filter((value): value is string => Boolean(value));
  return values.length > 0 ? [...new Set(values)].join(" / ") : null;
}

function parseJsonLdListings(
  html: string,
  sourceUrl: string,
  listings: DiscoveredListing[],
  seen: Set<string>,
): void {
  const scriptRegex =
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(scriptRegex)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(
        (match[1] ?? "")
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, "&")
          .trim(),
      );
    } catch {
      continue;
    }

    const postings: JsonRecord[] = [];
    collectJobPostings(parsed, postings);
    for (const posting of postings) {
      const title = textValue(posting.title) ?? textValue(posting.name);
      const rawUrl = textValue(posting.url) ?? textValue(posting.sameAs);
      if (!title || !rawUrl) continue;

      try {
        addListing(listings, seen, {
          canonicalUrl: canonicalizeJobUrl(rawUrl, sourceUrl),
          title: title.slice(0, 180),
          company: organizationName(posting.hiringOrganization),
          location: jobLocation(posting),
        });
      } catch {
        continue;
      }
    }
  }
}

function looksLikeJobLink(url: string, label: string): boolean {
  const haystack = `${url} ${label}`.toLowerCase();
  return [
    "job",
    "career",
    "position",
    "opening",
    "greenhouse",
    "lever",
    "workday",
    "ashby",
    "apply",
  ].some((needle) => haystack.includes(needle));
}

export function parseJobListingsFromHtml(
  html: string,
  sourceUrl: string,
): DiscoveredListing[] {
  const seen = new Set<string>();
  const listings: DiscoveredListing[] = [];
  const anchorRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  parseJsonLdListings(html, sourceUrl, listings, seen);

  for (const match of html.matchAll(anchorRegex)) {
    const href = match[1];
    const label = stripTags(match[2] ?? "");
    if (!href || label.length < 3 || !looksLikeJobLink(href, label)) continue;

    let canonicalUrl: string;
    try {
      canonicalUrl = canonicalizeJobUrl(href, sourceUrl);
    } catch {
      continue;
    }

    addListing(listings, seen, {
      canonicalUrl,
      title: label.slice(0, 180),
      company: new URL(sourceUrl).hostname.replace(/^www\./, ""),
      location: null,
    });
  }

  return listings.slice(0, 50);
}
