import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSources = vi.fn();
const mockCreateRun = vi.fn();
const mockCompleteRun = vi.fn();
const mockUpsertListings = vi.fn();
const mockFetchPublicHtml = vi.fn();

vi.mock("./discovery-repo", () => ({
  getEnabledSourcesForProfile: mockGetSources,
  createDiscoveryRun: mockCreateRun,
  completeDiscoveryRun: mockCompleteRun,
  upsertDiscoveredListings: mockUpsertListings,
}));

vi.mock("./public-web", () => ({
  fetchPublicHtml: mockFetchPublicHtml,
}));

beforeEach(() => {
  mockGetSources.mockReset();
  mockCreateRun.mockReset();
  mockCompleteRun.mockReset();
  mockUpsertListings.mockReset();
  mockFetchPublicHtml.mockReset();
});

describe("runJobDiscovery", () => {
  it("returns the number of rows actually inserted", async () => {
    mockGetSources.mockResolvedValueOnce([
      { id: "source-1", label: "Acme", url: "https://acme.test/careers" },
    ]);
    mockCreateRun.mockResolvedValueOnce("run-1");
    mockFetchPublicHtml.mockResolvedValueOnce({
      finalUrl: "https://acme.test/careers",
      html: '<a href="/jobs/1">Warehouse Associate</a>',
    });
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
    mockFetchPublicHtml.mockRejectedValueOnce(new Error("Private URL blocked"));

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
