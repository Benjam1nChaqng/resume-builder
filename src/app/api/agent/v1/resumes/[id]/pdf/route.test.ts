import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRequireAgentRequest,
  mockLoadRenderableResume,
  mockLoadResumeExportJob,
  mockBuildFilename,
  mockRenderResumePdf,
} = vi.hoisted(() => ({
  mockRequireAgentRequest: vi.fn(),
  mockLoadRenderableResume: vi.fn(),
  mockLoadResumeExportJob: vi.fn(),
  mockBuildFilename: vi.fn(),
  mockRenderResumePdf: vi.fn(),
}));

vi.mock("@/lib/agent/http", () => ({
  requireAgentRequest: mockRequireAgentRequest,
  isAgentErrorResponse: (value: unknown) => value instanceof Response,
}));
vi.mock("@/lib/resumes/render", () => ({
  loadRenderableResume: mockLoadRenderableResume,
}));
vi.mock("@/lib/resumes/export", () => ({
  loadResumeExportJob: mockLoadResumeExportJob,
  buildResumePdfFilename: mockBuildFilename,
}));
vi.mock("@/lib/resumes/resume-pdf", () => ({
  renderResumePdf: mockRenderResumePdf,
}));

beforeEach(() => {
  mockRequireAgentRequest.mockReset();
  mockLoadRenderableResume.mockReset();
  mockLoadResumeExportJob.mockReset();
  mockBuildFilename.mockReset();
  mockRenderResumePdf.mockReset();
});

describe("GET /api/agent/v1/resumes/[id]/pdf", () => {
  it("does not render another user's resume", async () => {
    mockRequireAgentRequest.mockResolvedValueOnce({
      tokenId: "token-1",
      userId: "user-1",
    });
    mockLoadRenderableResume.mockResolvedValueOnce({
      id: "resume-2",
      userId: "user-2",
    });
    const { GET } = await import("./route");
    const response = await GET(
      new Request("https://app.test/api/agent/v1/resumes/resume-2/pdf"),
      { params: Promise.resolve({ id: "resume-2" }) },
    );

    expect(response.status).toBe(404);
    expect(mockRenderResumePdf).not.toHaveBeenCalled();
  });
});
