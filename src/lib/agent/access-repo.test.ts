import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockLimit,
  mockWhere,
  mockFrom,
  mockSelect,
  mockUpdateWhere,
  mockSet,
  mockUpdate,
  mockValues,
  mockInsert,
} = vi.hoisted(() => {
  const mockLimit = vi.fn();
  const mockWhere = vi.fn(() => ({ limit: mockLimit }));
  const mockFrom = vi.fn(() => ({ where: mockWhere }));
  const mockSelect = vi.fn(() => ({ from: mockFrom }));
  const mockUpdateWhere = vi.fn();
  const mockSet = vi.fn(() => ({ where: mockUpdateWhere }));
  const mockUpdate = vi.fn(() => ({ set: mockSet }));
  const mockValues = vi.fn();
  const mockInsert = vi.fn(() => ({ values: mockValues }));
  return {
    mockLimit,
    mockWhere,
    mockFrom,
    mockSelect,
    mockUpdateWhere,
    mockSet,
    mockUpdate,
    mockValues,
    mockInsert,
  };
});

vi.mock("@/lib/db", () => ({
  db: {
    select: mockSelect,
    update: mockUpdate,
    insert: mockInsert,
  },
}));

beforeEach(() => {
  mockLimit.mockReset();
  mockWhere.mockClear();
  mockFrom.mockClear();
  mockSelect.mockClear();
  mockUpdateWhere.mockReset();
  mockSet.mockClear();
  mockUpdate.mockClear();
  mockValues.mockReset();
  mockInsert.mockClear();
});

describe("authenticateAgentRequest", () => {
  it("rejects malformed credentials without querying token storage", async () => {
    const { authenticateAgentRequest } = await import("./access");
    await expect(
      authenticateAgentRequest(
        new Request("https://app.test", {
          headers: { authorization: "Bearer wrong-prefix" },
        }),
      ),
    ).resolves.toBeNull();
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("returns the token owner and records usage for an active key", async () => {
    mockLimit.mockResolvedValueOnce([{ tokenId: "token-1", userId: "user-1" }]);
    mockUpdateWhere.mockResolvedValueOnce(undefined);
    const { authenticateAgentRequest } = await import("./access");
    const token = `rb_agent_${"a".repeat(43)}`;

    await expect(
      authenticateAgentRequest(
        new Request("https://app.test", {
          headers: { authorization: `Bearer ${token}` },
        }),
      ),
    ).resolves.toEqual({ tokenId: "token-1", userId: "user-1" });
    expect(mockUpdate).toHaveBeenCalledOnce();
    expect(mockSet).toHaveBeenCalledWith({ lastUsedAt: expect.any(Date) });
  });
});

describe("createAgentAccessToken", () => {
  it("persists only a hash and display prefix, never the raw token", async () => {
    mockValues.mockResolvedValueOnce(undefined);
    const { createAgentAccessToken } = await import("./access");
    const result = await createAgentAccessToken({
      userId: "user-1",
      name: "Codex job agent",
    });
    const stored = mockValues.mock.calls[0]?.[0] as Record<string, unknown>;

    expect(result.token).toMatch(/^rb_agent_/);
    expect(stored.userId).toBe("user-1");
    expect(stored.name).toBe("Codex job agent");
    expect(stored.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.tokenPrefix).toMatch(/^rb_agent_.+\.\.\.$/);
    expect(Object.values(stored)).not.toContain(result.token);
  });
});
