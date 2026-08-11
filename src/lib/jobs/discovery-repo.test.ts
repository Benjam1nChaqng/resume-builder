import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createJobSourceForUser,
  setJobSourceEnabledForUser,
} from "./discovery-repo";

const {
  mockLimit,
  mockWhere,
  mockFrom,
  mockInnerJoin,
  mockSelect,
  mockReturning,
  mockOnConflictDoNothing,
  mockValues,
  mockInsert,
  mockUpdate,
  mockAssertPublicHttpUrl,
} = vi.hoisted(() => {
  const mockLimit = vi.fn();
  const mockWhere = vi.fn(() => ({ limit: mockLimit }));
  const mockInnerJoin = vi.fn(() => ({ where: mockWhere }));
  const mockFrom = vi.fn(() => ({ where: mockWhere, innerJoin: mockInnerJoin }));
  const mockSelect = vi.fn(() => ({ from: mockFrom }));
  const mockReturning = vi.fn();
  const mockOnConflictDoNothing = vi.fn(() => ({ returning: mockReturning }));
  const mockValues = vi.fn(() => ({ onConflictDoNothing: mockOnConflictDoNothing }));
  const mockInsert = vi.fn(() => ({ values: mockValues }));
  const mockUpdate = vi.fn();
  const mockAssertPublicHttpUrl = vi.fn();
  return {
    mockLimit,
    mockWhere,
    mockFrom,
    mockInnerJoin,
    mockSelect,
    mockReturning,
    mockOnConflictDoNothing,
    mockValues,
    mockInsert,
    mockUpdate,
    mockAssertPublicHttpUrl,
  };
});

vi.mock("@/lib/db", () => ({
  db: {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
  },
}));

vi.mock("./public-web", () => ({
  assertPublicHttpUrl: mockAssertPublicHttpUrl,
}));

beforeEach(() => {
  mockLimit.mockReset();
  mockWhere.mockClear();
  mockFrom.mockClear();
  mockInnerJoin.mockClear();
  mockSelect.mockClear();
  mockReturning.mockReset();
  mockOnConflictDoNothing.mockReset();
  mockValues.mockClear();
  mockInsert.mockClear();
  mockUpdate.mockReset();
  mockAssertPublicHttpUrl.mockReset();
});

describe("createJobSourceForUser", () => {
  const input = {
    profileId: "profile-1",
    label: "Acme careers",
    url: "https://acme.example/careers",
  };

  it("checks profile ownership before resolving or inserting the source", async () => {
    mockLimit.mockResolvedValueOnce([]);

    await expect(createJobSourceForUser("user-2", input)).rejects.toThrow(
      /profile not found/i,
    );

    expect(mockAssertPublicHttpUrl).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("validates the public URL after ownership and before inserting", async () => {
    mockLimit.mockResolvedValueOnce([{ id: "profile-1" }]);
    mockAssertPublicHttpUrl.mockResolvedValueOnce(new URL(input.url));
    mockReturning.mockResolvedValueOnce([{ id: "source-1" }]);

    await createJobSourceForUser("user-1", input);

    expect(mockAssertPublicHttpUrl).toHaveBeenCalledWith(input.url);
    expect(mockInsert).toHaveBeenCalledOnce();
  });

  it("reports a duplicate profile source instead of returning a phantom id", async () => {
    mockLimit.mockResolvedValueOnce([{ id: "profile-1" }]);
    mockAssertPublicHttpUrl.mockResolvedValueOnce(new URL(input.url));
    mockReturning.mockResolvedValueOnce([]);

    await expect(createJobSourceForUser("user-1", input)).rejects.toThrow(
      /already added/i,
    );
  });
});

describe("setJobSourceEnabledForUser", () => {
  it("rejects a source that is not owned by the current user", async () => {
    mockLimit.mockResolvedValueOnce([]);

    await expect(
      setJobSourceEnabledForUser("user-2", "source-1", false),
    ).rejects.toThrow(/source not found/i);

    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
