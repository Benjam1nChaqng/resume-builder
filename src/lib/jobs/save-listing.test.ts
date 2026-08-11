import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateJobForUser = vi.fn();
const mockGetListing = vi.fn();
const mockUpdateListing = vi.fn();

vi.mock("./create", () => ({
  createJobForUser: mockCreateJobForUser,
}));

vi.mock("./discovery-repo", () => ({
  getDiscoveredListingForUser: mockGetListing,
  updateListingStatusForUser: mockUpdateListing,
}));

beforeEach(() => {
  mockCreateJobForUser.mockReset();
  mockGetListing.mockReset();
  mockUpdateListing.mockReset();
});

describe("saveDiscoveredListingForUser", () => {
  it("does not scrape when the authorized listing cannot be found", async () => {
    mockGetListing.mockResolvedValueOnce(null);
    const { saveDiscoveredListingForUser } = await import("./save-listing");

    await expect(
      saveDiscoveredListingForUser({ userId: "user-2", listingId: "listing-1" }),
    ).rejects.toThrow(/not found/i);
    expect(mockCreateJobForUser).not.toHaveBeenCalled();
  });

  it("uses the canonical URL loaded from the authorized listing", async () => {
    mockGetListing.mockResolvedValueOnce({
      id: "listing-1",
      canonicalUrl: "https://acme.example/jobs/123",
      jobId: null,
      status: "discovered",
    });
    mockCreateJobForUser.mockResolvedValueOnce("job-1");
    const { saveDiscoveredListingForUser } = await import("./save-listing");

    const jobId = await saveDiscoveredListingForUser({
      userId: "user-1",
      listingId: "listing-1",
    });

    expect(jobId).toBe("job-1");
    expect(mockCreateJobForUser).toHaveBeenCalledWith({
      userId: "user-1",
      url: "https://acme.example/jobs/123",
    });
    expect(mockUpdateListing).toHaveBeenCalledWith({
      userId: "user-1",
      listingId: "listing-1",
      status: "saved",
      jobId: "job-1",
    });
  });

  it("reuses the linked job on a repeated save", async () => {
    mockGetListing.mockResolvedValueOnce({
      id: "listing-1",
      canonicalUrl: "https://acme.example/jobs/123",
      jobId: "job-existing",
      status: "saved",
    });
    const { saveDiscoveredListingForUser } = await import("./save-listing");

    await expect(
      saveDiscoveredListingForUser({ userId: "user-1", listingId: "listing-1" }),
    ).resolves.toBe("job-existing");
    expect(mockCreateJobForUser).not.toHaveBeenCalled();
    expect(mockUpdateListing).not.toHaveBeenCalled();
  });
});
