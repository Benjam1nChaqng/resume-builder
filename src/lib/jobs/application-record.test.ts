import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApplicationNotesSchema,
  mergeJobPipelineHistory,
} from "./application-record";

const { mockRequireJobAccess, mockValues, mockOnConflictDoUpdate, mockInsert } =
  vi.hoisted(() => {
    const mockOnConflictDoUpdate = vi.fn();
    const mockValues = vi.fn(() => ({ onConflictDoUpdate: mockOnConflictDoUpdate }));
    return {
      mockRequireJobAccess: vi.fn(),
      mockValues,
      mockOnConflictDoUpdate,
      mockInsert: vi.fn(() => ({ values: mockValues })),
    };
  });

vi.mock("@/lib/db", () => ({ db: { insert: mockInsert } }));
vi.mock("./access", () => ({ requireJobAccess: mockRequireJobAccess }));

beforeEach(() => {
  mockRequireJobAccess.mockReset();
  mockValues.mockClear();
  mockOnConflictDoUpdate.mockReset();
  mockInsert.mockClear();
});

describe("application notes", () => {
  it("validates note length", () => {
    expect(ApplicationNotesSchema.parse("  Call hiring manager  ")).toBe(
      "Call hiring manager",
    );
    expect(() => ApplicationNotesSchema.parse("x".repeat(4_001))).toThrow(
      /4,000/,
    );
  });

  it("authorizes before upserting notes without changing application state", async () => {
    mockRequireJobAccess.mockResolvedValueOnce({ userId: "user-1" });
    mockOnConflictDoUpdate.mockResolvedValueOnce(undefined);
    const { updateApplicationNotes } = await import("./application-record");

    await updateApplicationNotes({ jobId: "job-1", notes: "  Follow up Friday  " });

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        jobId: "job-1",
        status: "draft",
        notes: "Follow up Friday",
      }),
    );
    expect(mockOnConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ set: { notes: "Follow up Friday" } }),
    );
  });

  it("does not write notes before authorization", async () => {
    mockRequireJobAccess.mockRejectedValueOnce(new Error("Forbidden"));
    const { updateApplicationNotes } = await import("./application-record");

    await expect(
      updateApplicationNotes({ jobId: "job-foreign", notes: "Private note" }),
    ).rejects.toThrow(/Forbidden/);
    expect(mockInsert).not.toHaveBeenCalled();
  });
});

describe("job pipeline history", () => {
  it("merges discovery timestamps and persisted transitions chronologically", () => {
    expect(
      mergeJobPipelineHistory(
        [{ id: "listing-1", discoveredAt: new Date("2026-08-01T10:00:00Z") }],
        [
          {
            id: "event-saved",
            status: "saved",
            occurredAt: new Date("2026-08-03T10:00:00Z"),
          },
          {
            id: "event-restored",
            status: "discovered",
            occurredAt: new Date("2026-08-02T10:00:00Z"),
          },
        ],
      ).map(({ status, restored }) => ({ status, restored })),
    ).toEqual([
      { status: "discovered", restored: false },
      { status: "discovered", restored: true },
      { status: "saved", restored: false },
    ]);
  });
});
