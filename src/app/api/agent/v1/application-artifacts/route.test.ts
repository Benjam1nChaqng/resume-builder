import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireAgentRequest, mockCreateArtifact } = vi.hoisted(() => ({
  mockRequireAgentRequest: vi.fn(),
  mockCreateArtifact: vi.fn(),
}));

vi.mock("@/lib/agent/http", () => ({
  requireAgentRequest: mockRequireAgentRequest,
  isAgentErrorResponse: (value: unknown) => value instanceof Response,
  agentJson: (data: unknown, init?: ResponseInit) => Response.json(data, init),
}));
vi.mock("@/lib/agent/application-workflow-http", () => ({
  applicationWorkflowErrorResponse: () => null,
}));
vi.mock("@/lib/jobs/application-workflow", async () => {
  const { z } = await import("zod");
  return {
    ApplicationArtifactInputSchema: z.object({
      jobId: z.string().min(1),
      kind: z.literal("research"),
      title: z.string().min(1),
      content: z.string().min(1),
      sourceUrls: z.array(z.string().url()).default([]),
      metadata: z.record(z.string(), z.unknown()).default({}),
      idempotencyKey: z.string().min(8),
    }),
    createApplicationArtifactForUser: mockCreateArtifact,
  };
});

beforeEach(() => {
  mockRequireAgentRequest.mockReset();
  mockCreateArtifact.mockReset();
});

describe("POST /api/agent/v1/application-artifacts", () => {
  it("binds artifact creation to the authenticated token owner", async () => {
    mockRequireAgentRequest.mockResolvedValueOnce({
      tokenId: "token-1",
      userId: "user-1",
    });
    mockCreateArtifact.mockResolvedValueOnce({
      artifact: { id: "artifact-1" },
      created: true,
    });
    const { POST } = await import("./route");
    const response = await POST(
      new Request("https://app.test/api/agent/v1/application-artifacts", {
        method: "POST",
        body: JSON.stringify({
          jobId: "job-1",
          kind: "research",
          title: "Research",
          content: "Verified findings",
          idempotencyKey: "research:job-1:v1",
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(mockCreateArtifact).toHaveBeenCalledWith({
      userId: "user-1",
      input: expect.objectContaining({ jobId: "job-1", kind: "research" }),
    });
  });

  it("rejects invalid artifacts before calling the service", async () => {
    mockRequireAgentRequest.mockResolvedValueOnce({
      tokenId: "token-1",
      userId: "user-1",
    });
    const { POST } = await import("./route");
    const response = await POST(
      new Request("https://app.test/api/agent/v1/application-artifacts", {
        method: "POST",
        body: JSON.stringify({ jobId: "job-1" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(mockCreateArtifact).not.toHaveBeenCalled();
  });
});
