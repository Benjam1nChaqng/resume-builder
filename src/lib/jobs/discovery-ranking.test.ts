import { describe, expect, it } from "vitest";
import type { JobSearchProfileInput } from "./discovery";
import { filterAndRankJobListings } from "./discovery-ranking";

const baseProfile: JobSearchProfileInput = {
  candidateName: "Maya",
  targetRoles: ["office assistant"],
  locationPreference: "Los Angeles",
  remotePreference: "any",
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
});
