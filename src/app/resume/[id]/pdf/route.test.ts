import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSession = vi.fn();
const mockLoadRenderableResume = vi.fn();
const mockLoadResumeExportJob = vi.fn();
const mockBuildFilename = vi.fn();
const mockRenderResumePdf = vi.fn();

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mockGetSession } },
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
  mockGetSession.mockReset();
  mockLoadRenderableResume.mockReset();
  mockLoadResumeExportJob.mockReset();
  mockBuildFilename.mockReset();
  mockRenderResumePdf.mockReset();
});

describe("GET /resume/[id]/pdf", () => {
  it("returns 401 without a session", async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const { GET } = await import("./route");

    const response = await GET(new Request("https://app.test/resume/resume-1/pdf"), {
      params: Promise.resolve({ id: "resume-1" }),
    });

    expect(response.status).toBe(401);
    expect(mockLoadRenderableResume).not.toHaveBeenCalled();
  });

  it("returns 404 for another user's resume without rendering", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });
    mockLoadRenderableResume.mockResolvedValueOnce({
      id: "resume-2",
      userId: "user-2",
    });
    const { GET } = await import("./route");

    const response = await GET(new Request("https://app.test/resume/resume-2/pdf"), {
      params: Promise.resolve({ id: "resume-2" }),
    });

    expect(response.status).toBe(404);
    expect(mockRenderResumePdf).not.toHaveBeenCalled();
  });

  it("returns an attachment with PDF bytes for the owner", async () => {
    const resume = {
      id: "resume-1",
      userId: "user-1",
      title: "Base Resume",
      contactInfo: { fullName: "Jordan Lee" },
    };
    const bytes = Buffer.from("%PDF-1.7\nfixture");
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });
    mockLoadRenderableResume.mockResolvedValueOnce(resume);
    mockLoadResumeExportJob.mockResolvedValueOnce({
      company: "Acme",
      role: "Engineer",
    });
    mockBuildFilename.mockReturnValueOnce("Jordan-Lee-Acme-Engineer.pdf");
    mockRenderResumePdf.mockResolvedValueOnce(bytes);
    const { GET } = await import("./route");

    const response = await GET(new Request("https://app.test/resume/resume-1/pdf"), {
      params: Promise.resolve({ id: "resume-1" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="Jordan-Lee-Acme-Engineer.pdf"',
    );
    expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
  });
});
