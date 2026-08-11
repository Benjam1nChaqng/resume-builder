import { describe, expect, it, vi } from "vitest";

const mockRequireJobAccess = vi.fn();
const mockRequireResumeAccess = vi.fn();
const mockAnalyzeResumeFit = vi.fn();

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/jobs/access", () => ({
  requireJobAccess: mockRequireJobAccess,
}));
vi.mock("@/lib/resumes/access", () => ({
  requireResumeAccess: mockRequireResumeAccess,
}));
vi.mock("@/lib/ai/resume-fit", () => ({
  analyzeResumeFit: mockAnalyzeResumeFit,
}));
vi.mock("@/lib/resumes/render", () => ({
  loadRenderableResume: vi.fn(),
  resumeToPlainText: vi.fn(),
}));

describe("runResumeJobFit", () => {
  it("rejects mismatched owners before loading or analyzing private data", async () => {
    mockRequireJobAccess.mockResolvedValueOnce({ userId: "user-1" });
    mockRequireResumeAccess.mockResolvedValueOnce({ userId: "user-2" });

    const { runResumeJobFit } = await import("./fit");
    await expect(
      runResumeJobFit({ jobId: "job-1", resumeId: "resume-2" }),
    ).rejects.toThrow(/owners do not match/);

    expect(mockAnalyzeResumeFit).not.toHaveBeenCalled();
  });
});
