import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSources = vi.fn();
const mockCreateRun = vi.fn();
const mockCompleteRun = vi.fn();
const mockUpsertListings = vi.fn();
const mockDiscoverListings = vi.fn();

vi.mock("./discovery-repo", () => ({
  getEnabledSourcesForProfile: mockGetSources,
  createDiscoveryRun: mockCreateRun,
  completeDiscoveryRun: mockCompleteRun,
  upsertDiscoveredListings: mockUpsertListings,
}));

vi.mock("./source-adapters", () => ({
  discoverListingsFromSource: mockDiscoverListings,
}));

beforeEach(() => {
  mockGetSources.mockReset();
  mockCreateRun.mockReset();
  mockCompleteRun.mockReset();
  mockUpsertListings.mockReset();
  mockDiscoverListings.mockReset();
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
    expect(mockCompleteRun).toHaveBeenCalledWith("run-1", "completed", undefined);
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
    );
  });
});
