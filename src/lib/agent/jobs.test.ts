import { beforeEach, describe, expect, it, vi } from "vitest";
import { AgentStructuredJobSchema, saveAgentStructuredJob } from "./jobs";

const {
  mockLimit,
  mockWhere,
  mockFrom,
  mockSelect,
  mockOnConflictDoUpdate,
  mockValues,
  mockDbInsert,
  mockGetListing,
  mockUpdateListing,
  mockInsertJob,
} = vi.hoisted(() => {
  const mockLimit = vi.fn();
  const mockWhere = vi.fn(() => ({ limit: mockLimit }));
  const mockFrom = vi.fn(() => ({ where: mockWhere }));
  const mockSelect = vi.fn(() => ({ from: mockFrom }));
  const mockOnConflictDoUpdate = vi.fn();
  const mockValues = vi.fn(() => ({ onConflictDoUpdate: mockOnConflictDoUpdate }));
  return {
    mockLimit,
    mockWhere,
    mockFrom,
    mockSelect,
    mockOnConflictDoUpdate,
    mockValues,
    mockDbInsert: vi.fn(() => ({ values: mockValues })),
    mockGetListing: vi.fn(),
    mockUpdateListing: vi.fn(),
    mockInsertJob: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({
  db: { select: mockSelect, insert: mockDbInsert },
}));
vi.mock("@/lib/jobs/discovery-repo", () => ({
  getDiscoveredListingForUser: mockGetListing,
  updateListingStatusForUser: mockUpdateListing,
}));
vi.mock("@/lib/jobs/repo", () => ({ insertJob: mockInsertJob }));

const input = AgentStructuredJobSchema.parse({
  listingId: "listing-1",
  sourceUrl: "https://example.com/jobs/1?utm_source=research",
  title: "Help Desk Technician",
  company: "Acme",
  location: "Hayward, CA",
  description: "Support employees and administer Microsoft 365.",
  requirements: ["Microsoft 365 support"],
  niceToHaves: ["MSP experience"],
  seniority: "Entry level",
  salaryMin: 58000,
  salaryMax: 70000,
  researchNotes: "Verified on the employer site.",
});

beforeEach(() => {
  mockLimit.mockReset();
  mockWhere.mockClear();
  mockFrom.mockClear();
  mockSelect.mockClear();
  mockOnConflictDoUpdate.mockReset();
  mockValues.mockClear();
  mockDbInsert.mockClear();
  mockGetListing.mockReset();
  mockUpdateListing.mockReset();
  mockInsertJob.mockReset();
});

describe("saveAgentStructuredJob", () => {
  it("rejects a listing URL mismatch before reading or writing job data", async () => {
    mockGetListing.mockResolvedValueOnce({
      id: "listing-1",
      canonicalUrl: "https://example.com/jobs/other",
      jobId: null,
      status: "discovered",
    });

    await expect(
      saveAgentStructuredJob({ userId: "user-1", input }),
    ).rejects.toThrow(/does not match/i);
    expect(mockSelect).not.toHaveBeenCalled();
    expect(mockInsertJob).not.toHaveBeenCalled();
  });

  it("reuses an owned job, records research, and links a discovered listing", async () => {
    mockGetListing.mockResolvedValueOnce({
      id: "listing-1",
      canonicalUrl: "https://example.com/jobs/1",
      jobId: null,
      status: "discovered",
    });
    mockLimit.mockResolvedValueOnce([{ id: "job-1" }]);
    mockOnConflictDoUpdate.mockResolvedValueOnce(undefined);
    mockUpdateListing.mockResolvedValueOnce("profile-1");

    await expect(
      saveAgentStructuredJob({ userId: "user-1", input }),
    ).resolves.toEqual({ jobId: "job-1", created: false });
    expect(mockInsertJob).not.toHaveBeenCalled();
    expect(mockUpdateListing).toHaveBeenCalledWith({
      userId: "user-1",
      listingId: "listing-1",
      status: "saved",
      jobId: "job-1",
    });
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        jobId: "job-1",
        notes: "Verified on the employer site.",
      }),
    );
  });
});
