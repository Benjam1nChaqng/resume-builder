import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireJobAccess = vi.fn();
const mockRequireResumeAccess = vi.fn();
const mockAnalyzeResumeFit = vi.fn();
const mockLoadRenderableResume = vi.fn();
const mockResumeToPlainText = vi.fn();
const mockLimit = vi.fn();
const mockWhere = vi.fn(() => ({ limit: mockLimit }));
const mockFrom = vi.fn(() => ({ where: mockWhere }));
const mockSelect = vi.fn(() => ({ from: mockFrom }));
const mockValues = vi.fn();
const mockInsert = vi.fn(() => ({ values: mockValues }));

vi.mock("@/lib/db", () => ({
  db: { select: mockSelect, insert: mockInsert },
}));
vi.mock("@/lib/jobs/access", () => ({
  requireJobAccess: mockRequireJobAccess,
}));
vi.mock("@/lib/resumes/access", () => ({
  requireResumeAccess: mockRequireResumeAccess,
}));
vi.mock("@/lib/ai/resume-fit", () => ({
  analyzeResumeFit: mockAnalyzeResumeFit,
  RESUME_FIT_RUBRIC_VERSION: "resume-fit-v2",
}));
vi.mock("@/lib/resumes/render", () => ({
  loadRenderableResume: mockLoadRenderableResume,
  resumeToPlainText: mockResumeToPlainText,
}));

const jobRow = {
  title: "Customer Support Associate",
  company: "Acme",
  description: "Help customers.",
  requirements: ["Customer service experience"],
  niceToHaves: ["Zendesk"],
};

beforeEach(() => {
  mockRequireJobAccess.mockReset();
  mockRequireResumeAccess.mockReset();
  mockAnalyzeResumeFit.mockReset();
  mockLoadRenderableResume.mockReset();
  mockResumeToPlainText.mockReset();
  mockLimit.mockReset();
  mockWhere.mockClear();
  mockFrom.mockClear();
  mockSelect.mockClear();
  mockValues.mockReset();
  mockInsert.mockClear();
});

describe("runResumeJobFit", () => {
  it("rejects mismatched owners before loading or analyzing private data", async () => {
    mockRequireJobAccess.mockResolvedValueOnce({ userId: "user-1" });
    mockRequireResumeAccess.mockResolvedValueOnce({ userId: "user-2" });

    const { runResumeJobFit } = await import("./fit");
    await expect(
      runResumeJobFit({ jobId: "job-1", resumeId: "resume-2" }),
    ).rejects.toThrow(/owners do not match/);

    expect(mockAnalyzeResumeFit).not.toHaveBeenCalled();
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("persists a safe failed result when model analysis fails", async () => {
    mockRequireJobAccess.mockResolvedValueOnce({ userId: "user-1" });
    mockRequireResumeAccess.mockResolvedValueOnce({ userId: "user-1" });
    mockLimit.mockResolvedValueOnce([jobRow]);
    mockLoadRenderableResume.mockResolvedValueOnce({ id: "resume-1" });
    mockResumeToPlainText.mockReturnValueOnce(
      "Customer support and customer service experience.",
    );
    mockAnalyzeResumeFit.mockRejectedValueOnce(new Error("provider timeout"));
    mockValues.mockResolvedValueOnce(undefined);

    const { FIT_CHECK_FAILURE_MESSAGE, runResumeJobFit } = await import("./fit");
    await expect(
      runResumeJobFit({ jobId: "job-1", resumeId: "resume-1" }),
    ).rejects.toThrow(FIT_CHECK_FAILURE_MESSAGE);

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        jobId: "job-1",
        resumeId: "resume-1",
        status: "failed",
        errorSummary: FIT_CHECK_FAILURE_MESSAGE,
        score: null,
        modelMetadata: expect.objectContaining({
          model: expect.any(String),
          rubricVersion: "resume-fit-v2",
          baselineScore: expect.any(Number),
        }),
      }),
    );
  });

  it("persists a completed source-backed result", async () => {
    mockRequireJobAccess.mockResolvedValueOnce({ userId: "user-1" });
    mockRequireResumeAccess.mockResolvedValueOnce({ userId: "user-1" });
    mockLimit.mockResolvedValueOnce([jobRow]);
    mockLoadRenderableResume.mockResolvedValueOnce({ id: "resume-1" });
    mockResumeToPlainText.mockReturnValueOnce("Customer service experience.");
    mockAnalyzeResumeFit.mockResolvedValueOnce({
      score: 82,
      matchingEvidence: [
        {
          label: "Customer service",
          evidence: "Customer service experience.",
          sourceSection: "experience",
          confidence: "high",
        },
      ],
      missingRequirements: [],
      missingPreferredRequirements: ["Zendesk"],
      concerns: [],
      unsupportedClaims: ["Do not claim Zendesk experience"],
      recommendations: [],
    });
    mockValues.mockResolvedValueOnce(undefined);

    const { runResumeJobFit } = await import("./fit");
    await expect(
      runResumeJobFit({ jobId: "job-1", resumeId: "resume-1" }),
    ).resolves.toEqual(expect.any(String));

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "completed",
        errorSummary: null,
        score: 82,
        matchingEvidence: expect.arrayContaining([
          expect.objectContaining({ confidence: "high" }),
        ]),
        missingPreferredRequirements: ["Zendesk"],
        unsupportedClaims: ["Do not claim Zendesk experience"],
      }),
    );
  });

  it("scopes direct agent fit execution to the token owner", async () => {
    mockLimit.mockResolvedValueOnce([jobRow]);
    mockLoadRenderableResume.mockResolvedValueOnce(null);

    const { runResumeJobFitForUser } = await import("./fit");
    await expect(
      runResumeJobFitForUser({
        userId: "user-1",
        jobId: "job-1",
        resumeId: "resume-2",
      }),
    ).rejects.toThrow("Resume not found.");

    expect(mockLoadRenderableResume).toHaveBeenCalledWith(
      "resume-2",
      "user-1",
    );
    expect(mockAnalyzeResumeFit).not.toHaveBeenCalled();
  });
});
