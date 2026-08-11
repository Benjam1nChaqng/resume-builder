import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createJobSourceForUser,
  setJobSourceEnabledForUser,
  updateJobSourceForUser,
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
  mockSet,
  mockUpdateWhere,
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
  const mockUpdateWhere = vi.fn();
  const mockSet = vi.fn(() => ({ where: mockUpdateWhere }));
  const mockUpdate = vi.fn(() => ({ set: mockSet }));
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
    mockSet,
    mockUpdateWhere,
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
  mockSet.mockClear();
  mockUpdateWhere.mockReset();
  mockUpdate.mockClear();
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

describe("updateJobSourceForUser", () => {
  const input = {
    label: "Acme jobs",
    url: "https://acme.example/jobs",
  };

  it("checks ownership before validating or updating the URL", async () => {
    mockLimit.mockResolvedValueOnce([]);

    await expect(
      updateJobSourceForUser("user-2", "source-1", input),
    ).rejects.toThrow(/source not found/i);

    expect(mockAssertPublicHttpUrl).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("updates an owned source after public URL validation", async () => {
    mockLimit.mockResolvedValueOnce([{ profileId: "profile-1" }]);
    mockAssertPublicHttpUrl.mockResolvedValueOnce(new URL(input.url));
    mockUpdateWhere.mockResolvedValueOnce(undefined);

    await expect(
      updateJobSourceForUser("user-1", "source-1", input),
    ).resolves.toBe("profile-1");

    expect(mockAssertPublicHttpUrl).toHaveBeenCalledWith(input.url);
    expect(mockSet).toHaveBeenCalledWith(input);
  });

  it("returns a useful duplicate-source error", async () => {
    mockLimit.mockResolvedValueOnce([{ profileId: "profile-1" }]);
    mockAssertPublicHttpUrl.mockResolvedValueOnce(new URL(input.url));
    mockUpdateWhere.mockRejectedValueOnce({ code: "23505" });

    await expect(
      updateJobSourceForUser("user-1", "source-1", input),
    ).rejects.toThrow(/already added/i);
  });
});
