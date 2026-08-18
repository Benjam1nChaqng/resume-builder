import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireAgentRequest, mockInsertResumeWithRelations } = vi.hoisted(
  () => ({
    mockRequireAgentRequest: vi.fn(),
    mockInsertResumeWithRelations: vi.fn(),
  }),
);

vi.mock("@/lib/agent/http", () => ({
  requireAgentRequest: mockRequireAgentRequest,
  isAgentErrorResponse: (value: unknown) => value instanceof Response,
  agentJson: (data: unknown, init?: ResponseInit) => Response.json(data, init),
}));

vi.mock("@/lib/resumes/repo", () => ({
  insertResumeWithRelations: mockInsertResumeWithRelations,
}));

const validResume = {
  title: "IT Support Resume",
  contactInfo: {
    fullName: "Ben Example",
    email: "ben@example.com",
    phone: null,
    location: "Hayward, CA",
    links: [],
  },
  experiences: [],
  educations: [],
  skills: [],
  projects: [],
};

beforeEach(() => {
  mockRequireAgentRequest.mockReset();
  mockInsertResumeWithRelations.mockReset();
});

describe("POST /api/agent/v1/resumes", () => {
  it("returns an unauthorized response without creating a resume", async () => {
    mockRequireAgentRequest.mockResolvedValueOnce(
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const { POST } = await import("./route");
    const response = await POST(
      new Request("https://app.test/api/agent/v1/resumes", {
        method: "POST",
        body: JSON.stringify(validResume),
      }),
    );

    expect(response.status).toBe(401);
    expect(mockInsertResumeWithRelations).not.toHaveBeenCalled();
  });

  it("rejects invalid structured resume data before writing", async () => {
    mockRequireAgentRequest.mockResolvedValueOnce({
      tokenId: "token-1",
      userId: "user-1",
    });
    const { POST } = await import("./route");
    const response = await POST(
      new Request("https://app.test/api/agent/v1/resumes", {
        method: "POST",
        body: JSON.stringify({ title: "Missing contact info" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(mockInsertResumeWithRelations).not.toHaveBeenCalled();
  });

  it("creates the resume for the authenticated token owner", async () => {
    mockRequireAgentRequest.mockResolvedValueOnce({
      tokenId: "token-1",
      userId: "user-1",
    });
    mockInsertResumeWithRelations.mockResolvedValueOnce("resume-1");
    const { POST } = await import("./route");
    const response = await POST(
      new Request("https://app.test/api/agent/v1/resumes", {
        method: "POST",
        body: JSON.stringify(validResume),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ resumeId: "resume-1" });
    expect(mockInsertResumeWithRelations).toHaveBeenCalledWith({
      userId: "user-1",
      parsed: validResume,
      sourcePdfUrl: null,
    });
  });
});
