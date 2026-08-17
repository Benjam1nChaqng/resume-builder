import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireAgentRequest, mockLoadAgentContext } = vi.hoisted(() => ({
  mockRequireAgentRequest: vi.fn(),
  mockLoadAgentContext: vi.fn(),
}));

vi.mock("@/lib/agent/http", () => ({
  requireAgentRequest: mockRequireAgentRequest,
  isAgentErrorResponse: (value: unknown) => value instanceof Response,
  agentJson: (data: unknown, init?: ResponseInit) => Response.json(data, init),
}));

vi.mock("@/lib/agent/context", () => ({
  loadAgentContext: mockLoadAgentContext,
}));

beforeEach(() => {
  mockRequireAgentRequest.mockReset();
  mockLoadAgentContext.mockReset();
});

describe("GET /api/agent/v1/context", () => {
  it("returns the same unauthorized response without loading private context", async () => {
    mockRequireAgentRequest.mockResolvedValueOnce(
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const { GET } = await import("./route");
    const response = await GET(new Request("https://app.test/api/agent/v1/context"));

    expect(response.status).toBe(401);
    expect(mockLoadAgentContext).not.toHaveBeenCalled();
  });

  it("loads only the token owner's context", async () => {
    mockRequireAgentRequest.mockResolvedValueOnce({
      tokenId: "token-1",
      userId: "user-1",
    });
    mockLoadAgentContext.mockResolvedValueOnce({ resumes: [], jobs: [] });
    const { GET } = await import("./route");
    const response = await GET(new Request("https://app.test/api/agent/v1/context"));

    expect(response.status).toBe(200);
    expect(mockLoadAgentContext).toHaveBeenCalledWith("user-1");
    await expect(response.json()).resolves.toEqual({ resumes: [], jobs: [] });
  });
});
