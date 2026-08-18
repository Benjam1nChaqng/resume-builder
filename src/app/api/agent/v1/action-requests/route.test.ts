import { access, readdir } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireAgentRequest, mockCreateActionRequest } = vi.hoisted(() => ({
  mockRequireAgentRequest: vi.fn(),
  mockCreateActionRequest: vi.fn(),
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
    ApplicationActionRequestInputSchema: z.object({
      jobId: z.string().min(1),
      artifactId: z.string().min(1),
      action: z.literal("send_email"),
      summary: z.string().min(1),
      idempotencyKey: z.string().min(8),
      payload: z.object({
        to: z.string().email(),
        subject: z.string().min(1),
        body: z.string().min(1),
      }),
    }),
    createApplicationActionRequestForUser: mockCreateActionRequest,
  };
});

beforeEach(() => {
  mockRequireAgentRequest.mockReset();
  mockCreateActionRequest.mockReset();
});

describe("POST /api/agent/v1/action-requests", () => {
  it("lets the agent queue an exact action for its token owner", async () => {
    mockRequireAgentRequest.mockResolvedValueOnce({
      tokenId: "token-1",
      userId: "user-1",
    });
    mockCreateActionRequest.mockResolvedValueOnce({
      actionRequest: { id: "request-1", status: "pending" },
      created: true,
    });
    const { POST } = await import("./route");
    const response = await POST(
      new Request("https://app.test/api/agent/v1/action-requests", {
        method: "POST",
        body: JSON.stringify({
          jobId: "job-1",
          artifactId: "artifact-1",
          action: "send_email",
          summary: "Send reviewed email",
          idempotencyKey: "email:job-1:v1",
          payload: {
            to: "recruiter@example.com",
            subject: "Application",
            body: "Reviewed body",
          },
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(mockCreateActionRequest).toHaveBeenCalledWith({
      userId: "user-1",
      input: expect.objectContaining({ action: "send_email" }),
    });
  });

  it("has no agent route that can approve its own requests", async () => {
    const entries = await readdir(new URL(".", import.meta.url), {
      recursive: true,
    });
    expect(entries.some((entry) => entry.toString().includes("approve"))).toBe(
      false,
    );
    await expect(
      access(new URL("./[id]/approve/route.ts", import.meta.url)),
    ).rejects.toThrow();
  });
});
