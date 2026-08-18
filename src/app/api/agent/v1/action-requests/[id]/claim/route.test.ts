import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireAgentRequest, mockClaimAction } = vi.hoisted(() => ({
  mockRequireAgentRequest: vi.fn(),
  mockClaimAction: vi.fn(),
}));

vi.mock("@/lib/agent/http", () => ({
  requireAgentRequest: mockRequireAgentRequest,
  isAgentErrorResponse: (value: unknown) => value instanceof Response,
  agentJson: (data: unknown, init?: ResponseInit) => Response.json(data, init),
}));
vi.mock("@/lib/agent/application-workflow-http", () => ({
  applicationWorkflowErrorResponse: () => null,
}));
vi.mock("@/lib/jobs/application-workflow", () => ({
  claimApprovedApplicationActionForUser: mockClaimAction,
}));

beforeEach(() => {
  mockRequireAgentRequest.mockReset();
  mockClaimAction.mockReset();
});

describe("POST /api/agent/v1/action-requests/:id/claim", () => {
  it("binds the claim to both the token owner and exact token", async () => {
    mockRequireAgentRequest.mockResolvedValueOnce({
      tokenId: "token-1",
      userId: "user-1",
    });
    mockClaimAction.mockResolvedValueOnce({
      id: "request-1",
      status: "executing",
      claimedByTokenId: "token-1",
    });
    const { POST } = await import("./route");
    const response = await POST(
      new Request("https://app.test/api/agent/v1/action-requests/request-1/claim", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "request-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mockClaimAction).toHaveBeenCalledWith({
      userId: "user-1",
      tokenId: "token-1",
      requestId: "request-1",
    });
  });
});
