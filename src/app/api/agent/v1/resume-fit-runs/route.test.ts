import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireAgentRequest, mockRunResumeJobFitForUser } = vi.hoisted(
  () => ({
    mockRequireAgentRequest: vi.fn(),
    mockRunResumeJobFitForUser: vi.fn(),
  }),
);

vi.mock("@/lib/agent/http", () => ({
  requireAgentRequest: mockRequireAgentRequest,
  isAgentErrorResponse: (value: unknown) => value instanceof Response,
  agentJson: (data: unknown, init?: ResponseInit) => Response.json(data, init),
}));

vi.mock("@/lib/jobs/fit", () => ({
  FIT_CHECK_FAILURE_MESSAGE: "Fit check failed.",
  runResumeJobFitForUser: mockRunResumeJobFitForUser,
}));

beforeEach(() => {
  mockRequireAgentRequest.mockReset();
  mockRunResumeJobFitForUser.mockReset();
});

describe("POST /api/agent/v1/resume-fit-runs", () => {
  it("rejects invalid identifiers before running a paid fit check", async () => {
    mockRequireAgentRequest.mockResolvedValueOnce({
      tokenId: "token-1",
      userId: "user-1",
    });
    const { POST } = await import("./route");
    const response = await POST(
      new Request("https://app.test/api/agent/v1/resume-fit-runs", {
        method: "POST",
        body: JSON.stringify({ jobId: "", resumeId: "resume-1" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(mockRunResumeJobFitForUser).not.toHaveBeenCalled();
  });

  it("runs the fit check as the authenticated token owner", async () => {
    mockRequireAgentRequest.mockResolvedValueOnce({
      tokenId: "token-1",
      userId: "user-1",
    });
    mockRunResumeJobFitForUser.mockResolvedValueOnce("fit-1");
    const { POST } = await import("./route");
    const response = await POST(
      new Request("https://app.test/api/agent/v1/resume-fit-runs", {
        method: "POST",
        body: JSON.stringify({ jobId: "job-1", resumeId: "resume-1" }),
      }),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ fitId: "fit-1" });
    expect(mockRunResumeJobFitForUser).toHaveBeenCalledWith({
      userId: "user-1",
      jobId: "job-1",
      resumeId: "resume-1",
    });
  });

  it("returns not found without leaking cross-owner job or resume details", async () => {
    mockRequireAgentRequest.mockResolvedValueOnce({
      tokenId: "token-1",
      userId: "user-1",
    });
    mockRunResumeJobFitForUser.mockRejectedValueOnce(
      new Error("Resume not found."),
    );
    const { POST } = await import("./route");
    const response = await POST(
      new Request("https://app.test/api/agent/v1/resume-fit-runs", {
        method: "POST",
        body: JSON.stringify({ jobId: "job-1", resumeId: "resume-2" }),
      }),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Job or resume not found" });
  });
});
