import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireAgentRequest, mockCreateTailoredResumeCopyForUser } =
  vi.hoisted(() => ({
    mockRequireAgentRequest: vi.fn(),
    mockCreateTailoredResumeCopyForUser: vi.fn(),
  }));

vi.mock("@/lib/agent/http", () => ({
  requireAgentRequest: mockRequireAgentRequest,
  isAgentErrorResponse: (value: unknown) => value instanceof Response,
  agentJson: (data: unknown, init?: ResponseInit) => Response.json(data, init),
}));

vi.mock("@/lib/jobs/tailored-resume", async () => {
  const { z } = await import("zod");
  return {
    TailoredBulletChangesSchema: z.array(
      z.object({
        experienceId: z.string().min(1),
        bulletId: z.string().min(1),
        text: z.string().min(1),
      }),
    ),
    createTailoredResumeCopyForUser: mockCreateTailoredResumeCopyForUser,
  };
});

beforeEach(() => {
  mockRequireAgentRequest.mockReset();
  mockCreateTailoredResumeCopyForUser.mockReset();
});

describe("POST /api/agent/v1/tailored-resumes", () => {
  it("passes the token owner to the shared tailored-copy service", async () => {
    mockRequireAgentRequest.mockResolvedValueOnce({
      tokenId: "token-1",
      userId: "user-1",
    });
    mockCreateTailoredResumeCopyForUser.mockResolvedValueOnce("resume-new");
    const { POST } = await import("./route");
    const response = await POST(
      new Request("https://app.test/api/agent/v1/tailored-resumes", {
        method: "POST",
        body: JSON.stringify({
          jobId: "job-1",
          resumeId: "resume-1",
          changes: [
            {
              experienceId: "experience-1",
              bulletId: "bullet-1",
              text: "Truthful tailored result",
            },
          ],
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(mockCreateTailoredResumeCopyForUser).toHaveBeenCalledWith({
      userId: "user-1",
      jobId: "job-1",
      resumeId: "resume-1",
      acceptedChanges: [
        {
          experienceId: "experience-1",
          bulletId: "bullet-1",
          text: "Truthful tailored result",
        },
      ],
    });
  });
});
