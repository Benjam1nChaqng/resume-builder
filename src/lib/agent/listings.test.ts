import { beforeEach, describe, expect, it, vi } from "vitest";
import { AgentListingBatchSchema, ingestAgentListings } from "./listings";

const { mockGetSearchProfile, mockUpsert } = vi.hoisted(() => ({
  mockGetSearchProfile: vi.fn(),
  mockUpsert: vi.fn(),
}));

vi.mock("@/lib/jobs/discovery-repo", () => ({
  getSearchProfileForDiscovery: mockGetSearchProfile,
  upsertDiscoveredListings: mockUpsert,
}));

const profile = {
  candidateName: "Benji",
  targetRoles: ["Help Desk"],
  locationPreference: "Hayward",
  remotePreference: "any" as const,
  employmentType: "any" as const,
  salaryMin: null,
  jobFocus: "both" as const,
  experienceLevel: "entry level",
  keywords: ["Microsoft 365"],
  exclusions: ["senior"],
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

beforeEach(() => {
  mockGetSearchProfile.mockReset();
  mockUpsert.mockReset();
});

describe("AgentListingBatchSchema", () => {
  it("canonicalizes tracking parameters before ingestion", () => {
    const parsed = AgentListingBatchSchema.parse({
      profileId: "profile-1",
      listings: [
        {
          url: "https://EXAMPLE.com/jobs/1/?utm_source=codex#apply",
          title: "Help Desk Technician",
        },
      ],
    });

    expect(parsed.listings[0]?.url).toBe("https://example.com/jobs/1");
  });
});

describe("ingestAgentListings", () => {
  it("checks profile ownership, filters exclusions, and reports duplicates", async () => {
    mockGetSearchProfile.mockResolvedValueOnce(profile);
    mockUpsert.mockResolvedValueOnce(1);
    const input = AgentListingBatchSchema.parse({
      profileId: "profile-1",
      listings: [
        {
          url: "https://example.com/jobs/help-desk",
          title: "Help Desk Technician",
          company: "Acme",
          location: "Hayward, CA",
          matchScore: 94,
        },
        {
          url: "https://example.com/jobs/senior-help-desk",
          title: "Senior Help Desk Manager",
          company: "Acme",
          location: "Hayward, CA",
        },
      ],
    });

    await expect(
      ingestAgentListings({ userId: "user-1", input }),
    ).resolves.toEqual({
      received: 2,
      accepted: 1,
      inserted: 1,
      duplicates: 0,
      filtered: 1,
    });
    expect(mockGetSearchProfile).toHaveBeenCalledWith("profile-1", "user-1");
    expect(mockUpsert).toHaveBeenCalledWith({
      profileId: "profile-1",
      sourceId: null,
      listings: [
        expect.objectContaining({
          canonicalUrl: "https://example.com/jobs/help-desk",
          matchScore: 94,
        }),
      ],
    });
  });
});
