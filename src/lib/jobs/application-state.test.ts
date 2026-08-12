import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRequireJobAccess,
  mockBatch,
  mockInsert,
  mockValues,
  mockOnConflictDoUpdate,
  mockUpdate,
  mockSet,
  mockWhere,
  applicationWrite,
  listingWrite,
} = vi.hoisted(() => {
  const applicationWrite = { kind: "application-write" };
  const listingWrite = { kind: "listing-write" };
  const mockOnConflictDoUpdate = vi.fn(() => applicationWrite);
  const mockValues = vi.fn(() => ({ onConflictDoUpdate: mockOnConflictDoUpdate }));
  const mockInsert = vi.fn(() => ({ values: mockValues }));
  const mockWhere = vi.fn(() => listingWrite);
  const mockSet = vi.fn(() => ({ where: mockWhere }));
  const mockUpdate = vi.fn(() => ({ set: mockSet }));
  return {
    mockRequireJobAccess: vi.fn(),
    mockBatch: vi.fn(),
    mockInsert,
    mockValues,
    mockOnConflictDoUpdate,
    mockUpdate,
    mockSet,
    mockWhere,
    applicationWrite,
    listingWrite,
  };
});

vi.mock("@/lib/db", () => ({
  db: {
    batch: mockBatch,
    insert: mockInsert,
    update: mockUpdate,
  },
}));
vi.mock("./access", () => ({ requireJobAccess: mockRequireJobAccess }));

beforeEach(() => {
  mockRequireJobAccess.mockReset();
  mockBatch.mockReset();
  mockInsert.mockClear();
  mockValues.mockClear();
  mockOnConflictDoUpdate.mockClear();
  mockUpdate.mockClear();
  mockSet.mockClear();
  mockWhere.mockClear();
});

describe("markJobApplied", () => {
  it("does not read or mutate application data before authorization", async () => {
    mockRequireJobAccess.mockRejectedValueOnce(new Error("Forbidden"));

    const { markJobApplied } = await import("./application-state");
    await expect(markJobApplied({ jobId: "job-foreign" })).rejects.toThrow(
      /Forbidden/,
    );
    expect(mockBatch).not.toHaveBeenCalled();
  });

  it("atomically upserts applied state and synchronizes its listing", async () => {
    mockRequireJobAccess.mockResolvedValueOnce({ userId: "user-1" });
    mockBatch.mockResolvedValueOnce([]);

    const { markJobApplied } = await import("./application-state");
    await markJobApplied({ jobId: "job-1" });

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        jobId: "job-1",
        status: "applied",
        appliedAt: expect.any(Date),
      }),
    );
    expect(mockOnConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.any(Array),
        set: {
          status: "applied",
          appliedAt: expect.any(Date),
        },
      }),
    );
    expect(mockSet).toHaveBeenCalledWith({ status: "applied" });
    expect(mockBatch).toHaveBeenCalledWith([applicationWrite, listingWrite]);
  });
});
