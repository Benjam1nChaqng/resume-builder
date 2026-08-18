import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireAgentRequest, mockSaveAgentResumeJobFit } = vi.hoisted(() => ({
  mockRequireAgentRequest: vi.fn(),
  mockSaveAgentResumeJobFit: vi.fn(),
}));

vi.mock("@/lib/agent/http", () => ({
  requireAgentRequest: mockRequireAgentRequest,
  isAgentErrorResponse: (value: unknown) => value instanceof Response,
  agentJson: (data: unknown, init?: ResponseInit) => Response.json(data, init),
}));

vi.mock("@/lib/agent/fits", async () => {
  const { z } = await import("zod");
  return {
    AgentResumeJobFitSchema: z.object({
      jobId: z.string().min(1),
      resumeId: z.string().min(1),
      score: z.number().int().min(0).max(100),
    }),
    saveAgentResumeJobFit: mockSaveAgentResumeJobFit,
  };
});

beforeEach(() => {
  mockRequireAgentRequest.mockReset();
  mockSaveAgentResumeJobFit.mockReset();
});

describe("POST /api/agent/v1/resume-fits", () => {
  it("rejects invalid fit data before writing", async () => {
    mockRequireAgentRequest.mockResolvedValueOnce({
      tokenId: "token-1",
      userId: "user-1",
    });
    const { POST } = await import("./route");
    const response = await POST(
      new Request("https://app.test/api/agent/v1/resume-fits", {
        method: "POST",
        body: JSON.stringify({ jobId: "job-1", resumeId: "resume-1", score: 120 }),
      }),
    );

    expect(response.status).toBe(400);
    expect(mockSaveAgentResumeJobFit).not.toHaveBeenCalled();
  });

  it("binds the fit to the authenticated token owner", async () => {
    mockRequireAgentRequest.mockResolvedValueOnce({
      tokenId: "token-1",
      userId: "user-1",
    });
    mockSaveAgentResumeJobFit.mockResolvedValueOnce({ fitId: "fit-1" });
    const { POST } = await import("./route");
    const response = await POST(
      new Request("https://app.test/api/agent/v1/resume-fits", {
        method: "POST",
        body: JSON.stringify({ jobId: "job-1", resumeId: "resume-1", score: 82 }),
      }),
    );

    expect(response.status).toBe(201);
    expect(mockSaveAgentResumeJobFit).toHaveBeenCalledWith({
      userId: "user-1",
      input: { jobId: "job-1", resumeId: "resume-1", score: 82 },
    });
  });
});
