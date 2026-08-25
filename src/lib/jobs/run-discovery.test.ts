import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSources = vi.fn();
const mockGetProfile = vi.fn();
const mockCreateRun = vi.fn();
const mockCompleteRun = vi.fn();
const mockUpsertListings = vi.fn();
const mockRefreshDisqualifiedListings = vi.fn();
const mockDiscoverListings = vi.fn();
const mockAttributeListings = vi.fn();
const mockFetchFeed = vi.fn();

vi.mock("./discovery-repo", () => ({
  getEnabledSourcesForProfile: mockGetSources,
  getSearchProfileForDiscovery: mockGetProfile,
  createDiscoveryRun: mockCreateRun,
  completeDiscoveryRun: mockCompleteRun,
  upsertDiscoveredListings: mockUpsertListings,
  refreshDisqualifiedListings: mockRefreshDisqualifiedListings,
}));

vi.mock("./source-adapters", () => ({
  discoverListingsFromSource: mockDiscoverListings,
  attributeListingsToSourceCompany: mockAttributeListings,
}));

beforeEach(() => {
  mockGetSources.mockReset();
  mockGetProfile.mockReset();
  mockCreateRun.mockReset();
  mockCompleteRun.mockReset();
  mockUpsertListings.mockReset();
  mockRefreshDisqualifiedListings.mockReset();
  mockDiscoverListings.mockReset();
  mockAttributeListings.mockReset();
  mockAttributeListings.mockImplementation(
    (
      listings: Array<{ company: string | null }>,
      { sourceUrl, sourceLabel }: { sourceUrl: string; sourceLabel: string },
    ) =>
      /greenhouse\.io|lever\.co|ashbyhq\.com/.test(sourceUrl)
        ? listings.map((listing) => ({
            ...listing,
            company: listing.company ?? sourceLabel,
          }))
        : listings,
  );
  mockGetProfile.mockResolvedValue({
    candidateName: "Maya",
    targetRoles: ["warehouse associate"],
    locationPreference: null,
    remotePreference: "any",
    employmentType: "any",
    salaryMin: null,
    jobFocus: "local",
    experienceLevel: "entry level",
    keywords: [],
    exclusions: [],
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
  });
  mockFetchFeed.mockReset();
});

describe("runJobDiscovery", () => {
  it("returns the number of rows actually inserted", async () => {
    mockGetSources.mockResolvedValueOnce([
      { id: "source-1", label: "Acme", url: "https://acme.test/careers" },
    ]);
    mockCreateRun.mockResolvedValueOnce("run-1");
    mockDiscoverListings.mockResolvedValueOnce([
      {
        canonicalUrl: "https://acme.test/jobs/1",
        title: "Warehouse Associate",
        company: "Acme",
        location: null,
      },
    ]);
    mockUpsertListings.mockResolvedValueOnce(0);

    const { runJobDiscovery } = await import("./run-discovery");
    const result = await runJobDiscovery({ profileId: "profile-1", userId: "user-1" });

    expect(result).toEqual({ discovered: 0, errors: [] });
    expect(mockCompleteRun).toHaveBeenCalledWith(
      "run-1",
      "completed",
      undefined,
      0,
      [
        {
          sourceId: "source-1",
          label: "Acme",
          status: "completed",
          inserted: 0,
          attempts: 1,
          durationMs: expect.any(Number),
        },
      ],
    );
  });

  it("records a failed run when every configured source fails", async () => {
    mockGetSources.mockResolvedValueOnce([
      { id: "source-1", label: "Unsafe", url: "http://localhost/jobs" },
    ]);
    mockCreateRun.mockResolvedValueOnce("run-2");
    mockDiscoverListings.mockRejectedValueOnce(new Error("Private URL blocked"));

    const { runJobDiscovery } = await import("./run-discovery");
    const result = await runJobDiscovery({ profileId: "profile-1", userId: "user-1" });

    expect(result.errors).toEqual(["Unsafe: Private URL blocked"]);
    expect(mockCompleteRun).toHaveBeenCalledWith(
      "run-2",
      "failed",
      "Unsafe: Private URL blocked",
      0,
      [
        {
          sourceId: "source-1",
          label: "Unsafe",
          status: "failed",
          inserted: 0,
          attempts: 1,
          durationMs: expect.any(Number),
          error: "Unsafe: Private URL blocked",
        },
      ],
    );
  });

  it("records partial completion with stable per-source result order", async () => {
    mockGetSources.mockResolvedValueOnce([
      { id: "source-1", label: "Acme", url: "https://acme.test/careers" },
      { id: "source-2", label: "Broken", url: "https://broken.test/jobs" },
    ]);
    mockCreateRun.mockResolvedValueOnce("run-3");
    mockDiscoverListings
      .mockResolvedValueOnce([
        {
          canonicalUrl: "https://acme.test/jobs/1",
          title: "Warehouse Associate",
          company: "Acme",
          location: null,
        },
      ])
      .mockRejectedValue(new Error("HTTP 503"));
    mockUpsertListings.mockResolvedValueOnce(1);

    const { runJobDiscovery } = await import("./run-discovery");
    const result = await runJobDiscovery(
      { profileId: "profile-1", userId: "user-1" },
      { retry: { sleep: async () => undefined } },
    );

    expect(result).toEqual({ discovered: 1, errors: ["Broken: HTTP 503"] });
    expect(mockCompleteRun).toHaveBeenCalledWith(
      "run-3",
      "partial",
      "Broken: HTTP 503",
      1,
      [
        expect.objectContaining({
          sourceId: "source-1",
          status: "completed",
          inserted: 1,
          attempts: 1,
        }),
        expect.objectContaining({
          sourceId: "source-2",
          status: "failed",
          attempts: 3,
          error: "Broken: HTTP 503",
        }),
      ],
    );
    expect(mockDiscoverListings).toHaveBeenCalledTimes(4);
  });

  it("upserts only once after a transient source recovers", async () => {
    mockGetSources.mockResolvedValueOnce([
      { id: "source-1", label: "Acme", url: "https://acme.test/careers" },
    ]);
    mockCreateRun.mockResolvedValueOnce("run-4");
    mockDiscoverListings
      .mockRejectedValueOnce(new Error("HTTP 429"))
      .mockResolvedValueOnce([
        {
          canonicalUrl: "https://acme.test/jobs/1",
          title: "Warehouse Associate",
          company: "Acme",
          location: null,
        },
      ]);
    mockUpsertListings.mockResolvedValueOnce(1);

    const { runJobDiscovery } = await import("./run-discovery");
    const result = await runJobDiscovery(
      { profileId: "profile-1", userId: "user-1" },
      { retry: { sleep: async () => undefined } },
    );

    expect(result).toEqual({ discovered: 1, errors: [] });
    expect(mockDiscoverListings).toHaveBeenCalledTimes(2);
    expect(mockUpsertListings).toHaveBeenCalledTimes(1);
    expect(mockCompleteRun).toHaveBeenCalledWith(
      "run-4",
      "completed",
      undefined,
      1,
      [
        expect.objectContaining({
          sourceId: "source-1",
          status: "completed",
          inserted: 1,
          attempts: 2,
        }),
      ],
    );
  });

  it("uses curated ATS source metadata for missing company names", async () => {
    mockGetSources.mockResolvedValueOnce([
      {
        id: "source-1",
        label: "Acme Corporation",
        url: "https://boards.greenhouse.io/acme",
      },
    ]);
    mockCreateRun.mockResolvedValueOnce("run-5");
    mockDiscoverListings.mockResolvedValueOnce([
      {
        canonicalUrl: "https://boards.greenhouse.io/acme/jobs/1",
        title: "Warehouse Associate",
        company: null,
        location: null,
      },
    ]);
    mockUpsertListings.mockResolvedValueOnce(1);

    const { runJobDiscovery } = await import("./run-discovery");
    await runJobDiscovery({ profileId: "profile-1", userId: "user-1" });

    expect(mockUpsertListings).toHaveBeenCalledWith({
      profileId: "profile-1",
      sourceId: "source-1",
      listings: [
        expect.objectContaining({
          title: "Warehouse Associate",
          company: "Acme Corporation",
        }),
      ],
    });
  });

  it("discovers remote jobs from the no-key feed without configured sources", async () => {
    mockGetSources.mockResolvedValueOnce([]);
    mockGetProfile.mockResolvedValueOnce({
      candidateName: "Maya",
      targetRoles: ["support technician"],
      locationPreference: "California",
      remotePreference: "any",
      employmentType: "full_time",
      salaryMin: 60_000,
      jobFocus: "professional",
      experienceLevel: "entry level",
      keywords: [],
      exclusions: [],
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
    });
    mockCreateRun.mockResolvedValueOnce("run-feed");
    mockFetchFeed.mockResolvedValueOnce({
      listings: [
        {
          canonicalUrl: "https://remotive.com/jobs/1",
          title: "Support Technician",
          company: "Acme",
          location: "Remote",
        },
      ],
      error: null,
    });
    mockUpsertListings.mockResolvedValueOnce(1);

    const { runJobDiscovery } = await import("./run-discovery");
    await expect(
      runJobDiscovery(
        { profileId: "profile-1", userId: "user-1" },
        { fetchFeed: mockFetchFeed },
      ),
    ).resolves.toEqual({ discovered: 1, errors: [] });

    expect(mockUpsertListings).toHaveBeenCalledWith({
      profileId: "profile-1",
      sourceId: null,
      listings: [expect.objectContaining({ title: "Support Technician" })],
    });
    expect(mockCompleteRun).toHaveBeenCalledWith(
      "run-feed",
      "completed",
      undefined,
      1,
      [expect.objectContaining({ sourceId: "remotive", inserted: 1 })],
    );
  });

  it("applies the same compensation policy to curated sources and the public feed", async () => {
    mockGetSources.mockResolvedValueOnce([
      { id: "source-1", label: "Acme", url: "https://acme.test/careers" },
    ]);
    mockGetProfile.mockResolvedValueOnce({
      candidateName: "Maya",
      targetRoles: ["support technician"],
      locationPreference: "California",
      remotePreference: "any",
      employmentType: "full_time",
      salaryMin: null,
      jobFocus: "professional",
      experienceLevel: "entry level",
      keywords: [],
      exclusions: [],
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
    });
    mockCreateRun.mockResolvedValueOnce("run-policy");
    mockDiscoverListings.mockResolvedValueOnce([
      {
        canonicalUrl: "https://acme.test/jobs/low",
        title: "Support Technician",
        company: "Acme",
        location: "California",
        compensationText: "$70,000 - $79,000 per year",
      },
    ]);
    mockFetchFeed.mockResolvedValueOnce({
      listings: [
        {
          canonicalUrl: "https://remotive.com/jobs/low",
          title: "Support Technician",
          company: "Remote Co",
          location: "Remote",
          compensationText: "$40 - $49 per hour",
        },
      ],
      error: null,
    });
    mockUpsertListings.mockResolvedValue(0);

    const { runJobDiscovery } = await import("./run-discovery");
    await runJobDiscovery(
      { profileId: "profile-1", userId: "user-1" },
      { fetchFeed: mockFetchFeed },
      { minAnnualSalary: 80_000, minHourlySalary: 50 },
    );

    expect(mockUpsertListings).toHaveBeenNthCalledWith(1, {
      profileId: "profile-1",
      sourceId: "source-1",
      listings: [],
    });
    expect(mockUpsertListings).toHaveBeenNthCalledWith(2, {
      profileId: "profile-1",
      sourceId: null,
      listings: [],
    });
    expect(mockRefreshDisqualifiedListings).toHaveBeenNthCalledWith(1, {
      profileId: "profile-1",
      listings: [
        expect.objectContaining({
          canonicalUrl: "https://acme.test/jobs/low",
          matchScore: 0,
        }),
      ],
    });
    expect(mockRefreshDisqualifiedListings).toHaveBeenNthCalledWith(2, {
      profileId: "profile-1",
      listings: [
        expect.objectContaining({
          canonicalUrl: "https://remotive.com/jobs/low",
          matchScore: 0,
        }),
      ],
    });
  });
});
