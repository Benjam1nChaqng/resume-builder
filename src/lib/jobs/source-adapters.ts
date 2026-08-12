import { z } from "zod";
import {
  canonicalizeJobUrl,
  parseJobListingsFromHtml,
  type DiscoveredListing,
} from "./discovery";
import {
  fetchPublicHtml,
  fetchPublicJson,
  postPublicJson,
} from "./public-web";

const MAX_ADAPTER_LISTINGS = 100;
const WORKDAY_PAGE_SIZE = 20;
const ATS_SLUG_PATTERN = /^[a-zA-Z0-9_-]+$/;
const WORKDAY_HOSTNAME_PATTERN = /^([a-z0-9-]+)\.wd\d+\.myworkdayjobs\.com$/;
const WORKDAY_LOCALE_PATTERN = /^[a-z]{2}(?:-[a-z]{2})?$/i;
const WORKDAY_FACET_KEY_PATTERN = /^[a-z][a-z0-9]{0,63}$/i;
const WORKDAY_SEARCH_KEYS = new Set(["q", "query", "searchText"]);

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

const WorkdayResponseSchema = z.object({
  total: z.number().int().nonnegative(),
  jobPostings: z.array(
    z.object({
      title: z.string().trim().min(1),
      externalPath: z.string().trim().regex(/^\/job\//),
      locationsText: z.string().trim().nullable().optional(),
      postedOn: z.string().trim().nullable().optional(),
      remoteType: z.string().trim().nullable().optional(),
    }),
  ),
});

type WorkdaySource = {
  kind: "workday";
  endpoint: string;
  publicBaseUrl: string;
  searchText: string;
  appliedFacets: Record<string, string[]>;
};

export type SupportedJobSource =
  | { kind: "greenhouse"; endpoint: string }
  | { kind: "lever"; endpoint: string }
  | { kind: "ashby"; endpoint: string }
  | WorkdaySource;

type SourceAdapterDependencies = {
  fetchHtml?: typeof fetchPublicHtml;
  fetchJson?: typeof fetchPublicJson;
  postJson?: typeof postPublicJson;
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

function decodePathSegment(value: string): string | null {
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return null;
  }
}

function workdaySource(url: URL): WorkdaySource | null {
  const hostnameMatch = url.hostname.match(WORKDAY_HOSTNAME_PATTERN);
  if (!hostnameMatch) return null;
  const tenant = hostnameMatch[1];
  if (!tenant || !ATS_SLUG_PATTERN.test(tenant)) return null;

  const pathSegments = url.pathname.split("/").filter(Boolean);
  const locale = pathSegments[0]?.match(WORKDAY_LOCALE_PATTERN)
    ? pathSegments.shift()
    : undefined;
  const site = decodePathSegment(pathSegments[0] ?? "");
  if (!site || !ATS_SLUG_PATTERN.test(site)) return null;

  const searchText =
    [...WORKDAY_SEARCH_KEYS]
      .map((key) => url.searchParams.get(key)?.trim())
      .find(Boolean)
      ?.slice(0, 200) ?? "";
  const appliedFacets: Record<string, string[]> = {};
  for (const key of new Set(url.searchParams.keys())) {
    if (
      WORKDAY_SEARCH_KEYS.has(key) ||
      key.toLowerCase().startsWith("utm_") ||
      !WORKDAY_FACET_KEY_PATTERN.test(key)
    ) {
      continue;
    }
    const values = url.searchParams
      .getAll(key)
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 20)
      .map((value) => value.slice(0, 200));
    if (values.length > 0) appliedFacets[key] = values;
  }

  const publicPath = [locale, site].filter(Boolean).join("/");
  return {
    kind: "workday",
    endpoint: `${url.origin}/wday/cxs/${tenant}/${site}/jobs`,
    publicBaseUrl: `${url.origin}/${publicPath}`,
    searchText,
    appliedFacets,
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
  return (
    greenhouseSource(url) ??
    leverSource(url) ??
    ashbySource(url) ??
    workdaySource(url)
  );
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

function parseWorkdayPage(
  data: unknown,
  publicBaseUrl: string,
): { listings: DiscoveredListing[]; total: number } {
  const parsed = WorkdayResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Workday returned unexpected job data.");
  }

  return {
    total: parsed.data.total,
    listings: parsed.data.jobPostings.map((listing) => {
      const location = listing.locationsText || null;
      const isRemote = listing.remoteType?.toLowerCase() === "remote";
      return {
        canonicalUrl: canonicalizeJobUrl(
          new URL(
            listing.externalPath.replace(/^\//, ""),
            `${publicBaseUrl}/`,
          ).toString(),
        ),
        title: listing.title.slice(0, 180),
        company: null,
        location: isRemote
          ? location && !location.toLowerCase().includes("remote")
            ? `Remote - ${location}`
            : "Remote"
          : location,
        postedAt: validDate(listing.postedOn),
      };
    }),
  };
}

async function discoverWorkdayListings(
  source: WorkdaySource,
  postJson: typeof postPublicJson,
): Promise<DiscoveredListing[]> {
  const listings: DiscoveredListing[] = [];

  for (let offset = 0; offset < MAX_ADAPTER_LISTINGS; offset += WORKDAY_PAGE_SIZE) {
    const limit = Math.min(
      WORKDAY_PAGE_SIZE,
      MAX_ADAPTER_LISTINGS - offset,
    );
    const { data } = await postJson(source.endpoint, {
      appliedFacets: source.appliedFacets,
      limit,
      offset,
      searchText: source.searchText,
    });
    const page = parseWorkdayPage(data, source.publicBaseUrl);
    listings.push(...page.listings);

    if (
      page.listings.length === 0 ||
      page.listings.length < limit ||
      listings.length >= page.total
    ) {
      break;
    }
  }

  return listings.slice(0, MAX_ADAPTER_LISTINGS);
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

  if (adapter.kind === "workday") {
    return discoverWorkdayListings(
      adapter,
      dependencies.postJson ?? postPublicJson,
    );
  }

  const { data } = await (dependencies.fetchJson ?? fetchPublicJson)(
    adapter.endpoint,
  );
  if (adapter.kind === "greenhouse") return parseGreenhouseListings(data);
  if (adapter.kind === "lever") return parseLeverListings(data);
  return parseAshbyListings(data);
}
