import { z } from "zod";
import {
  canonicalizeJobUrl,
  parseJobListingsFromHtml,
  type DiscoveredListing,
} from "./discovery";
import { fetchPublicHtml, fetchPublicJson } from "./public-web";

const MAX_ADAPTER_LISTINGS = 100;
const ATS_SLUG_PATTERN = /^[a-zA-Z0-9_-]+$/;

const GreenhouseResponseSchema = z.object({
  jobs: z.array(
    z.object({
      title: z.string().trim().min(1),
      absolute_url: z.string().url(),
      updated_at: z.string().trim().optional(),
      location: z
        .object({ name: z.string().trim().nullable().optional() })
        .optional(),
    }),
  ),
});

const LeverResponseSchema = z.array(
  z.object({
    text: z.string().trim().min(1),
    hostedUrl: z.string().url(),
    categories: z
      .object({
        location: z.string().trim().nullable().optional(),
        commitment: z.string().trim().nullable().optional(),
      })
      .passthrough()
      .optional(),
    workplaceType: z.string().trim().nullable().optional(),
    createdAt: z.number().int().nonnegative().optional(),
  }),
);

const AshbyResponseSchema = z.object({
  jobs: z.array(
    z.object({
      title: z.string().trim().min(1),
      location: z.string().trim().nullable().optional(),
      isListed: z.boolean().optional(),
      isRemote: z.boolean().optional(),
      workplaceType: z.string().trim().nullable().optional(),
      employmentType: z.string().trim().nullable().optional(),
      publishedAt: z.string().trim().nullable().optional(),
      jobUrl: z.string().url(),
      compensation: z
        .object({
          compensationTierSummary: z.string().trim().nullable().optional(),
          scrapeableCompensationSalarySummary: z
            .string()
            .trim()
            .nullable()
            .optional(),
        })
        .nullable()
        .optional(),
    }),
  ),
});

export type SupportedJobSource =
  | { kind: "greenhouse"; endpoint: string }
  | { kind: "lever"; endpoint: string }
  | { kind: "ashby"; endpoint: string };

type SourceAdapterDependencies = {
  fetchHtml?: typeof fetchPublicHtml;
  fetchJson?: typeof fetchPublicJson;
};

function firstPathSegment(url: URL): string | null {
  return url.pathname.split("/").filter(Boolean)[0] ?? null;
}

function greenhouseSource(url: URL): SupportedJobSource | null {
  if (
    url.hostname !== "boards.greenhouse.io" &&
    url.hostname !== "job-boards.greenhouse.io"
  ) {
    return null;
  }

  const boardToken =
    url.searchParams.get("for")?.trim() || firstPathSegment(url)?.trim();
  if (!boardToken || !ATS_SLUG_PATTERN.test(boardToken)) return null;

  return {
    kind: "greenhouse",
    endpoint: `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs`,
  };
}

function leverSource(url: URL): SupportedJobSource | null {
  const regions = new Map([
    ["jobs.lever.co", "api.lever.co"],
    ["jobs.eu.lever.co", "api.eu.lever.co"],
  ]);
  const apiHostname = regions.get(url.hostname);
  if (!apiHostname) return null;

  const site = firstPathSegment(url)?.trim();
  if (!site || !ATS_SLUG_PATTERN.test(site)) return null;

  const endpoint = new URL(`https://${apiHostname}/v0/postings/${site}`);
  endpoint.searchParams.set("mode", "json");
  endpoint.searchParams.set("limit", String(MAX_ADAPTER_LISTINGS));
  for (const filter of ["location", "team", "department", "commitment"] as const) {
    for (const value of url.searchParams.getAll(filter)) {
      if (value.trim()) endpoint.searchParams.append(filter, value.trim());
    }
  }

  return { kind: "lever", endpoint: endpoint.toString() };
}

function ashbySource(url: URL): SupportedJobSource | null {
  if (url.hostname !== "jobs.ashbyhq.com") return null;
  const boardName = firstPathSegment(url)?.trim();
  if (!boardName || !ATS_SLUG_PATTERN.test(boardName)) return null;

  return {
    kind: "ashby",
    endpoint:
      `https://api.ashbyhq.com/posting-api/job-board/${boardName}?includeCompensation=true`,
  };
}

export function detectSupportedJobSource(rawUrl: string): SupportedJobSource | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  url.hostname = url.hostname.toLowerCase();
  return greenhouseSource(url) ?? leverSource(url) ?? ashbySource(url);
}

export function attributeListingsToSourceCompany(
  listings: DiscoveredListing[],
  {
    sourceUrl,
    sourceLabel,
  }: {
    sourceUrl: string;
    sourceLabel: string;
  },
): DiscoveredListing[] {
  if (!detectSupportedJobSource(sourceUrl)) return listings;
  const company = sourceLabel.trim();
  if (!company) return listings;

  return listings.map((listing) => ({
    ...listing,
    company: listing.company ?? company,
  }));
}

function validDate(value: string | number | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseGreenhouseListings(data: unknown): DiscoveredListing[] {
  const parsed = GreenhouseResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Greenhouse returned unexpected job data.");
  }

  return parsed.data.jobs.slice(0, MAX_ADAPTER_LISTINGS).map((listing) => ({
    canonicalUrl: canonicalizeJobUrl(listing.absolute_url),
    title: listing.title.slice(0, 180),
    company: null,
    location: listing.location?.name || null,
    postedAt: validDate(listing.updated_at),
  }));
}

function leverLocation(listing: z.infer<typeof LeverResponseSchema>[number]): string | null {
  const location = listing.categories?.location || null;
  if (listing.workplaceType?.toLowerCase() !== "remote") return location;
  if (!location || location.toLowerCase().includes("remote")) return "Remote";
  return `Remote - ${location}`;
}

function parseLeverListings(data: unknown): DiscoveredListing[] {
  const parsed = LeverResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Lever returned unexpected job data.");
  }

  return parsed.data.slice(0, MAX_ADAPTER_LISTINGS).map((listing) => ({
    canonicalUrl: canonicalizeJobUrl(listing.hostedUrl),
    title: listing.text.slice(0, 180),
    company: null,
    location: leverLocation(listing),
    employmentType: listing.categories?.commitment || null,
    postedAt: validDate(listing.createdAt),
  }));
}

function parseAshbyListings(data: unknown): DiscoveredListing[] {
  const parsed = AshbyResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Ashby returned unexpected job data.");
  }

  return parsed.data.jobs
    .filter((listing) => listing.isListed !== false)
    .slice(0, MAX_ADAPTER_LISTINGS)
    .map((listing) => {
      const isRemote =
        listing.isRemote ||
        listing.workplaceType?.toLowerCase() === "remote";
      const location = listing.location || null;
      const remoteLocation = isRemote
        ? location && !location.toLowerCase().includes("remote")
          ? `Remote - ${location}`
          : "Remote"
        : location;
      return {
        canonicalUrl: canonicalizeJobUrl(listing.jobUrl),
        title: listing.title.slice(0, 180),
        company: null,
        location: remoteLocation,
        employmentType: listing.employmentType || null,
        compensationText:
          listing.compensation?.scrapeableCompensationSalarySummary ||
          listing.compensation?.compensationTierSummary ||
          null,
        postedAt: validDate(listing.publishedAt),
      };
    });
}

export async function discoverListingsFromSource(
  sourceUrl: string,
  dependencies: SourceAdapterDependencies = {},
): Promise<DiscoveredListing[]> {
  const adapter = detectSupportedJobSource(sourceUrl);
  if (!adapter) {
    const { html, finalUrl } = await (dependencies.fetchHtml ?? fetchPublicHtml)(
      sourceUrl,
    );
    return parseJobListingsFromHtml(html, finalUrl);
  }

  const { data } = await (dependencies.fetchJson ?? fetchPublicJson)(
    adapter.endpoint,
  );
  if (adapter.kind === "greenhouse") return parseGreenhouseListings(data);
  if (adapter.kind === "lever") return parseLeverListings(data);
  return parseAshbyListings(data);
}
