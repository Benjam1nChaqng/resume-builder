import { beforeEach, describe, expect, it, vi } from "vitest";
import { createJobSourceForUser } from "./discovery-repo";

const {
  mockLimit,
  mockWhere,
  mockFrom,
  mockSelect,
  mockOnConflictDoNothing,
  mockValues,
  mockInsert,
  mockAssertPublicHttpUrl,
} = vi.hoisted(() => {
  const mockLimit = vi.fn();
  const mockWhere = vi.fn(() => ({ limit: mockLimit }));
  const mockFrom = vi.fn(() => ({ where: mockWhere }));
  const mockSelect = vi.fn(() => ({ from: mockFrom }));
  const mockOnConflictDoNothing = vi.fn();
  const mockValues = vi.fn(() => ({ onConflictDoNothing: mockOnConflictDoNothing }));
  const mockInsert = vi.fn(() => ({ values: mockValues }));
  const mockAssertPublicHttpUrl = vi.fn();
  return {
    mockLimit,
    mockWhere,
    mockFrom,
    mockSelect,
    mockOnConflictDoNothing,
    mockValues,
    mockInsert,
    mockAssertPublicHttpUrl,
  };
});

vi.mock("@/lib/db", () => ({
  db: {
    select: mockSelect,
    insert: mockInsert,
  },
}));

vi.mock("./public-web", () => ({
  assertPublicHttpUrl: mockAssertPublicHttpUrl,
}));

beforeEach(() => {
  mockLimit.mockReset();
  mockWhere.mockClear();
  mockFrom.mockClear();
  mockSelect.mockClear();
  mockOnConflictDoNothing.mockReset();
  mockValues.mockClear();
  mockInsert.mockClear();
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
    mockOnConflictDoNothing.mockResolvedValueOnce(undefined);

    await createJobSourceForUser("user-1", input);

    expect(mockAssertPublicHttpUrl).toHaveBeenCalledWith(input.url);
    expect(mockInsert).toHaveBeenCalledOnce();
  });
});
