import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireAgentRequest, mockUpdateResumeContentForUser } = vi.hoisted(
  () => ({
    mockRequireAgentRequest: vi.fn(),
    mockUpdateResumeContentForUser: vi.fn(),
  }),
);

vi.mock("@/lib/agent/http", () => ({
  requireAgentRequest: mockRequireAgentRequest,
  isAgentErrorResponse: (value: unknown) => value instanceof Response,
  agentJson: (data: unknown, init?: ResponseInit) => Response.json(data, init),
}));

vi.mock("@/lib/agent/resume-updates", async () => {
  const { z } = await import("zod");
  return {
    AgentResumeContentUpdateSchema: z
      .object({
        educationUpdates: z.array(z.unknown()).default([]),
        educationAdds: z.array(z.unknown()).default([]),
        projectUpdates: z.array(z.unknown()).default([]),
        projectOrder: z.array(z.string()).optional(),
      })
      .strict(),
    updateResumeContentForUser: mockUpdateResumeContentForUser,
  };
});

beforeEach(() => {
  mockRequireAgentRequest.mockReset();
  mockUpdateResumeContentForUser.mockReset();
});

describe("PATCH /api/agent/v1/resumes/[id]", () => {
  it("returns unauthorized without writing", async () => {
    mockRequireAgentRequest.mockResolvedValueOnce(
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("https://app.test/api/agent/v1/resumes/resume-1", {
        method: "PATCH",
        body: JSON.stringify({ educationUpdates: [] }),
      }),
      { params: Promise.resolve({ id: "resume-1" }) },
    );

    expect(response.status).toBe(401);
    expect(mockUpdateResumeContentForUser).not.toHaveBeenCalled();
  });

  it("rejects invalid content before writing", async () => {
    mockRequireAgentRequest.mockResolvedValueOnce({
      tokenId: "token-1",
      userId: "user-1",
    });
    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("https://app.test/api/agent/v1/resumes/resume-1", {
        method: "PATCH",
        body: JSON.stringify({ unsupported: true }),
      }),
      { params: Promise.resolve({ id: "resume-1" }) },
    );

    expect(response.status).toBe(400);
    expect(mockUpdateResumeContentForUser).not.toHaveBeenCalled();
  });

  it("updates content for the authenticated token owner", async () => {
    mockRequireAgentRequest.mockResolvedValueOnce({
      tokenId: "token-1",
      userId: "user-1",
    });
    mockUpdateResumeContentForUser.mockResolvedValueOnce({
      addedEducationIds: ["education-new"],
    });
    const { PATCH } = await import("./route");
    const body = {
      educationUpdates: [
        { educationId: "education-1", patch: { field: "Computer Science" } },
      ],
      educationAdds: [],
      projectUpdates: [],
    };
    const response = await PATCH(
      new Request("https://app.test/api/agent/v1/resumes/resume-1", {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id: "resume-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      addedEducationIds: ["education-new"],
    });
    expect(mockUpdateResumeContentForUser).toHaveBeenCalledWith({
      userId: "user-1",
      resumeId: "resume-1",
      input: body,
    });
  });

  it("returns not found for a resume outside the token owner's account", async () => {
    mockRequireAgentRequest.mockResolvedValueOnce({
      tokenId: "token-1",
      userId: "user-1",
    });
    mockUpdateResumeContentForUser.mockRejectedValueOnce(
      new Error("Resume not found."),
    );
    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("https://app.test/api/agent/v1/resumes/resume-2", {
        method: "PATCH",
        body: JSON.stringify({ educationUpdates: [] }),
      }),
      { params: Promise.resolve({ id: "resume-2" }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Resume not found" });
  });
});
