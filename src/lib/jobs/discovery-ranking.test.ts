import { describe, expect, it } from "vitest";
import type { JobSearchProfileInput } from "./discovery";
import { filterAndRankJobListings } from "./discovery-ranking";
import { createJobListingView } from "./listing-view";

const baseProfile: JobSearchProfileInput = {
  candidateName: "Maya",
  targetRoles: ["office assistant"],
  locationPreference: "Los Angeles",
  remotePreference: "any",
  employmentType: "any",
  salaryMin: null,
  jobFocus: "both",
  experienceLevel: "entry level",
  keywords: ["customer service"],
  exclusions: ["night shift"],
  basicJobFilters: {
    partTime: false,
    hourly: false,
    entryLevel: false,
    retail: false,
    admin: false,
    service: false,
    warehouse: false,
    internship: false,
  },
};

const listings = [
  {
    canonicalUrl: "https://example.com/jobs/1",
    title: "Office Assistant",
    company: "Acme",
    location: "Los Angeles, CA",
  },
  {
    canonicalUrl: "https://example.com/jobs/2",
    title: "Senior Engineer",
    company: "Acme",
    location: "New York, NY",
  },
];

describe("filterAndRankJobListings", () => {
  it("ranks role and location matches ahead of unrelated listings", () => {
    const ranked = filterAndRankJobListings(listings, baseProfile);
    expect(ranked.map((listing) => listing.title)).toEqual([
      "Office Assistant",
      "Senior Engineer",
    ]);
    expect(ranked[0]!.matchScore).toBeGreaterThan(ranked[1]!.matchScore);
  });

  it("removes explicit exclusions", () => {
    const ranked = filterAndRankJobListings(
      [
        ...listings,
        {
          canonicalUrl: "https://example.com/jobs/3",
          title: "Office Assistant - Night Shift",
          company: "Acme",
          location: "Los Angeles, CA",
        },
      ],
      baseProfile,
    );
    expect(ranked.some((listing) => listing.canonicalUrl.endsWith("/3"))).toBe(false);
  });

  it("applies selected basic-job categories", () => {
    const ranked = filterAndRankJobListings(listings, {
      ...baseProfile,
      basicJobFilters: { ...baseProfile.basicJobFilters, admin: true },
    });
    expect(ranked.map((listing) => listing.title)).toEqual(["Office Assistant"]);
  });

  it("keeps unknown locations but removes known onsite jobs for remote-only searches", () => {
    const ranked = filterAndRankJobListings(
      [
        ...listings,
        {
          canonicalUrl: "https://example.com/jobs/4",
          title: "Office Assistant",
          company: "Remote Co",
          location: "Remote - US",
        },
        {
          canonicalUrl: "https://example.com/jobs/5",
          title: "Office Assistant",
          company: null,
          location: null,
        },
      ],
      { ...baseProfile, remotePreference: "remote" },
    );
    expect(ranked.map((listing) => listing.canonicalUrl)).toEqual([
      "https://example.com/jobs/4",
      "https://example.com/jobs/5",
    ]);
  });

  it("removes annual and hourly listings whose entire range is below the configured floor", () => {
    const ranked = filterAndRankJobListings(
      [
        {
          canonicalUrl: "https://example.com/jobs/annual-low",
          title: "Office Assistant",
          company: "Acme",
          location: "Los Angeles, CA",
          compensationText: "$65,000 - $79,000 per year",
        },
        {
          canonicalUrl: "https://example.com/jobs/hourly-low",
          title: "Office Assistant",
          company: "Acme",
          location: "Los Angeles, CA",
          compensationText: "$42 - $49/hr",
        },
        {
          canonicalUrl: "https://example.com/jobs/annual-qualified",
          title: "Office Assistant",
          company: "Acme",
          location: "Los Angeles, CA",
          compensationText: "$90k - $110k",
        },
      ],
      baseProfile,
      {
        minAnnualSalary: 80_000,
        minHourlySalary: 50,
      },
    );

    expect(ranked.map((listing) => listing.canonicalUrl)).toEqual([
      "https://example.com/jobs/annual-qualified",
    ]);
  });

  it("puts confirmed qualifying compensation ahead of salary verification", () => {
    const ranked = filterAndRankJobListings(
      [
        {
          canonicalUrl: "https://example.com/jobs/unknown",
          title: "Office Assistant",
          company: "Acme",
          location: "Los Angeles, CA",
          compensationText: null,
        },
        {
          canonicalUrl: "https://example.com/jobs/crosses-floor",
          title: "Office Assistant",
          company: "Acme",
          location: "Los Angeles, CA",
          compensationText: "$75,000 - $95,000 per year",
        },
        {
          canonicalUrl: "https://example.com/jobs/qualified",
          title: "Office Assistant",
          company: "Acme",
          location: "Los Angeles, CA",
          compensationText: "$85,000 - $105,000 per year",
        },
      ],
      baseProfile,
      {
        minAnnualSalary: 80_000,
        minHourlySalary: 50,
        allowMissingCompensation: true,
      },
    );

    expect(ranked.map((listing) => listing.canonicalUrl)).toEqual([
      "https://example.com/jobs/qualified",
      "https://example.com/jobs/crosses-floor",
      "https://example.com/jobs/unknown",
    ]);
  });

  it("removes stale listings while keeping listings with no posted date", () => {
    const ranked = filterAndRankJobListings(
      [
        {
          canonicalUrl: "https://example.com/jobs/fresh",
          title: "Office Assistant",
          company: "Acme",
          location: "Los Angeles, CA",
          postedAt: new Date("2026-08-20T12:00:00.000Z"),
        },
        {
          canonicalUrl: "https://example.com/jobs/stale",
          title: "Office Assistant",
          company: "Acme",
          location: "Los Angeles, CA",
          postedAt: new Date("2026-04-01T12:00:00.000Z"),
        },
        {
          canonicalUrl: "https://example.com/jobs/no-date",
          title: "Office Assistant",
          company: "Acme",
          location: "Los Angeles, CA",
          postedAt: null,
        },
      ],
      baseProfile,
      {
        maxPostedAgeDays: 90,
        now: new Date("2026-08-24T12:00:00.000Z"),
      },
    );

    expect(ranked.map((listing) => listing.canonicalUrl)).toEqual([
      "https://example.com/jobs/fresh",
      "https://example.com/jobs/no-date",
    ]);
  });

  it("preserves compensation priority after listings are re-sorted from stored scores", () => {
    const ranked = filterAndRankJobListings(
      [
        {
          canonicalUrl: "https://example.com/jobs/unknown-perfect-match",
          title: "Office Assistant",
          company: "Acme",
          location: "Los Angeles, CA",
          compensationText: null,
        },
        {
          canonicalUrl: "https://example.com/jobs/qualified-weaker-match",
          title: "Systems Engineer",
          company: "Acme",
          location: "Los Angeles, CA",
          compensationText: "$95,000 per year",
        },
      ],
      baseProfile,
      { minAnnualSalary: 80_000, minHourlySalary: 50 },
    );
    const persistedView = createJobListingView(
      ranked.map((listing) => ({
        id: listing.canonicalUrl,
        status: "discovered",
        matchScore: listing.matchScore,
        discoveredAt: new Date("2026-08-24T12:00:00Z"),
        company: listing.company,
        title: listing.title,
      })),
      { status: "all", sort: "relevance", page: 1 },
    );

    expect(persistedView.items.map((listing) => listing.id)).toEqual([
      "https://example.com/jobs/qualified-weaker-match",
      "https://example.com/jobs/unknown-perfect-match",
    ]);
  });

  it("treats a standalone range with a trailing USD code as confirmed pay", () => {
    const ranked = filterAndRankJobListings(
      [
        {
          canonicalUrl: "https://example.com/jobs/trailing-usd",
          title: "Technical Support Engineer",
          company: "Acme",
          location: "San Francisco, CA",
          compensationText: "$125,000 - $150,000 USD",
        },
      ],
      baseProfile,
      { minAnnualSalary: 80_000, minHourlySalary: 50 },
    );

    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.matchScore).toBeGreaterThanOrEqual(76);
  });

  it("annualizes monthly USD compensation before applying the floor", () => {
    const ranked = filterAndRankJobListings(
      [
        {
          canonicalUrl: "https://example.com/jobs/monthly",
          title: "Office Assistant",
          company: "Acme",
          location: "Los Angeles, CA",
          compensationText: "$7,000 per month",
        },
      ],
      baseProfile,
      {
        minAnnualSalary: 80_000,
        minHourlySalary: 50,
        allowMissingCompensation: false,
      },
    );

    expect(ranked.map((listing) => listing.canonicalUrl)).toEqual([
      "https://example.com/jobs/monthly",
    ]);
  });

  it("does not compare explicitly non-USD compensation against USD floors", () => {
    const ranked = filterAndRankJobListings(
      [
        {
          canonicalUrl: "https://example.com/jobs/non-usd",
          title: "Office Assistant",
          company: "Acme",
          location: "Remote",
          compensationText: "₹5,000,000 per year",
        },
      ],
      baseProfile,
      {
        minAnnualSalary: 80_000,
        minHourlySalary: 50,
        allowMissingCompensation: false,
      },
    );

    expect(ranked).toEqual([]);
  });

  it.each([
    "CHF 100,000 per year",
    "NZD 120,000 per year",
    "SGD 110,000 per year",
    "A$120,000 per year",
    "C$120,000 per year",
    "R$120,000 per year",
    "S$120,000 per year",
    "NT$120,000 per year",
  ])(
    "treats %s as unknown instead of USD compensation",
    (compensationText) => {
      const ranked = filterAndRankJobListings(
        [
          {
            canonicalUrl: "https://example.com/jobs/foreign-currency",
            title: "Office Assistant",
            company: "Acme",
            location: "Remote",
            compensationText,
          },
        ],
        baseProfile,
        {
          minAnnualSalary: 80_000,
          minHourlySalary: 50,
          allowMissingCompensation: false,
        },
      );

      expect(ranked).toEqual([]);
    },
  );

  it("does not let a signing bonus raise a below-floor hourly range", () => {
    const ranked = filterAndRankJobListings(
      [
        {
          canonicalUrl: "https://example.com/jobs/hourly-with-bonus",
          title: "Office Assistant",
          company: "Acme",
          location: "Los Angeles, CA",
          compensationText: "$45 per hour + $5,000 signing bonus",
        },
      ],
      baseProfile,
      { minAnnualSalary: 80_000, minHourlySalary: 50 },
    );

    expect(ranked).toEqual([]);
  });

  it("does not include a signing bonus introduced with prose in hourly pay", () => {
    const ranked = filterAndRankJobListings(
      [
        {
          canonicalUrl: "https://example.com/jobs/hourly-with-prose-bonus",
          title: "Office Assistant",
          company: "Acme",
          location: "Los Angeles, CA",
          compensationText: "$45 per hour with a $5,000 signing bonus",
        },
      ],
      baseProfile,
      { minAnnualSalary: 80_000, minHourlySalary: 50 },
    );

    expect(ranked).toEqual([]);
  });

  it("does not include a signing bonus joined with 'and' in hourly pay", () => {
    const ranked = filterAndRankJobListings(
      [
        {
          canonicalUrl: "https://example.com/jobs/hourly-and-bonus",
          title: "Office Assistant",
          company: "Acme",
          location: "Los Angeles, CA",
          compensationText: "$45 per hour and a $5,000 signing bonus",
        },
      ],
      baseProfile,
      { minAnnualSalary: 80_000, minHourlySalary: 50 },
    );

    expect(ranked).toEqual([]);
  });

  it("keeps all interval-bound rates when prose describes a crossing range", () => {
    const ranked = filterAndRankJobListings(
      [
        {
          canonicalUrl: "https://example.com/jobs/hourly-progression",
          title: "Office Assistant",
          company: "Acme",
          location: "Los Angeles, CA",
          compensationText: "$45 per hour with increases up to $55 per hour",
        },
      ],
      baseProfile,
      { minAnnualSalary: 80_000, minHourlySalary: 50 },
    );

    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.matchScore).toBeGreaterThanOrEqual(51);
  });

  it("recognizes 'an hour' compensation before enforcing the hourly floor", () => {
    const ranked = filterAndRankJobListings(
      [
        {
          canonicalUrl: "https://example.com/jobs/hourly-words",
          title: "Office Assistant",
          company: "Acme",
          location: "Los Angeles, CA",
          compensationText: "$45 an hour",
        },
      ],
      baseProfile,
      { minAnnualSalary: 80_000, minHourlySalary: 50 },
    );

    expect(ranked).toEqual([]);
  });
});
