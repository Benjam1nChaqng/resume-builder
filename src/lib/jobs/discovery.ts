import { z } from "zod";

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
  url: z.string().trim().url(),
});

export type JobSearchProfileInput = z.infer<typeof JobSearchProfileInputSchema>;
export type JobSourceInput = z.infer<typeof JobSourceInputSchema>;

export type DiscoveredListing = {
  canonicalUrl: string;
  title: string;
  company: string | null;
  location: string | null;
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

    if (seen.has(canonicalUrl)) continue;
    seen.add(canonicalUrl);
    listings.push({
      canonicalUrl,
      title: label.slice(0, 180),
      company: new URL(sourceUrl).hostname.replace(/^www\./, ""),
      location: null,
    });
  }

  return listings.slice(0, 50);
}

