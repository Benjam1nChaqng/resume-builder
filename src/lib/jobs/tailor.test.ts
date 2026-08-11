import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TailoredBullets } from "@/lib/ai/bullet-tailorer/schema";

const mockTailorBullets = vi.fn();
const mockRequireJobAccess = vi.fn();
const mockRequireResumeAccess = vi.fn();
const mockLoadJobForTailoring = vi.fn();
const mockLoadResumeForTailoring = vi.fn();

vi.mock("@/lib/ai/bullet-tailorer", () => ({
  tailorBullets: mockTailorBullets,
}));

vi.mock("./access", () => ({
  requireJobAccess: mockRequireJobAccess,
}));

vi.mock("@/lib/resumes/access", () => ({
  requireResumeAccess: mockRequireResumeAccess,
}));

vi.mock("./tailor-repo", () => ({
  loadJobForTailoring: mockLoadJobForTailoring,
  loadResumeForTailoring: mockLoadResumeForTailoring,
}));

const jobFixture = {
  title: "Staff Backend Engineer",
  requirements: ["Go expertise", "Distributed systems"],
  niceToHaves: ["Mentorship"] as string[] | null,
};

const resumeFixture = {
  experiences: [
    {
      id: "exp-1",
      company: "Acme",
      role: "Senior Engineer",
      bullets: [
        { id: "b-1", text: "Built backend services in Go." },
        { id: "b-2", text: "Mentored junior engineers." },
      ],
    },
    {
      id: "exp-2",
      company: "Foo",
      role: "Engineer",
      bullets: [{ id: "b-3", text: "Shipped REST APIs." }],
    },
  ],
};

const tailoredOutputFor = (count: number): TailoredBullets => ({
  bullets: Array.from({ length: count }, (_, i) => ({
    originalText: `original-${i}`,
    text: `tailored-${i}`,
    rationale: `rationale-${i}`,
  })),
});

beforeEach(() => {
  mockTailorBullets.mockReset();
  mockRequireJobAccess.mockReset();
  mockRequireResumeAccess.mockReset();
  mockLoadJobForTailoring.mockReset();
  mockLoadResumeForTailoring.mockReset();
});

describe("tailorResumeForJob", () => {
  it("authorizes both job and resume, calls tailorBullets per experience, and shapes the response", async () => {
    mockRequireJobAccess.mockResolvedValueOnce({ userId: "user-1" });
    mockRequireResumeAccess.mockResolvedValueOnce({ userId: "user-1" });
    mockLoadJobForTailoring.mockResolvedValueOnce(jobFixture);
    mockLoadResumeForTailoring.mockResolvedValueOnce(resumeFixture);
    mockTailorBullets
      .mockResolvedValueOnce(tailoredOutputFor(2))
      .mockResolvedValueOnce(tailoredOutputFor(1));

    const { tailorResumeForJob } = await import("./tailor");
    const result = await tailorResumeForJob({
      jobId: "job-1",
      resumeId: "resume-1",
    });

    expect(mockRequireJobAccess).toHaveBeenCalledWith("job-1");
    expect(mockRequireResumeAccess).toHaveBeenCalledWith("resume-1");
    expect(mockTailorBullets).toHaveBeenCalledTimes(2);

    // First experience contract
    expect(mockTailorBullets.mock.calls[0][0]).toEqual({
      experience: {
        company: "Acme",
        role: "Senior Engineer",
        bullets: ["Built backend services in Go.", "Mentored junior engineers."],
      },
      jobDescription: jobFixture,
    });

    expect(result).toEqual({
      job: jobFixture,
      experiences: [
        {
          experienceId: "exp-1",
          company: "Acme",
          role: "Senior Engineer",
          before: [
            { id: "b-1", text: "Built backend services in Go." },
            { id: "b-2", text: "Mentored junior engineers." },
          ],
          tailored: tailoredOutputFor(2).bullets,
        },
        {
          experienceId: "exp-2",
          company: "Foo",
          role: "Engineer",
          before: [{ id: "b-3", text: "Shipped REST APIs." }],
          tailored: tailoredOutputFor(1).bullets,
        },
      ],
    });
  });

  it("returns an empty experiences array when the resume has no experiences (no Claude calls)", async () => {
    mockRequireJobAccess.mockResolvedValueOnce({ userId: "user-1" });
    mockRequireResumeAccess.mockResolvedValueOnce({ userId: "user-1" });
    mockLoadJobForTailoring.mockResolvedValueOnce(jobFixture);
    mockLoadResumeForTailoring.mockResolvedValueOnce({ experiences: [] });

    const { tailorResumeForJob } = await import("./tailor");
    const result = await tailorResumeForJob({
      jobId: "job-1",
      resumeId: "resume-1",
    });

    expect(mockTailorBullets).not.toHaveBeenCalled();
    expect(result.experiences).toEqual([]);
  });

  it("rejects mismatched owners before loading job or resume content", async () => {
    mockRequireJobAccess.mockResolvedValueOnce({ userId: "user-1" });
    mockRequireResumeAccess.mockResolvedValueOnce({ userId: "user-2" });

    const { tailorResumeForJob } = await import("./tailor");
    await expect(
      tailorResumeForJob({ jobId: "job-1", resumeId: "resume-2" }),
    ).rejects.toThrow(/owners do not match/);

    expect(mockLoadJobForTailoring).not.toHaveBeenCalled();
    expect(mockLoadResumeForTailoring).not.toHaveBeenCalled();
  });

  it("skips experiences with no bullets — no Claude call, no entry in output", async () => {
    mockRequireJobAccess.mockResolvedValueOnce({ userId: "user-1" });
    mockRequireResumeAccess.mockResolvedValueOnce({ userId: "user-1" });
    mockLoadJobForTailoring.mockResolvedValueOnce(jobFixture);
    mockLoadResumeForTailoring.mockResolvedValueOnce({
      experiences: [
        { id: "exp-empty", company: "Empty Co", role: "Intern", bullets: [] },
        {
          id: "exp-1",
          company: "Acme",
          role: "Senior Engineer",
          bullets: [{ id: "b-1", text: "Did a thing." }],
        },
      ],
    });
    mockTailorBullets.mockResolvedValueOnce(tailoredOutputFor(1));

    const { tailorResumeForJob } = await import("./tailor");
    const result = await tailorResumeForJob({
      jobId: "job-1",
      resumeId: "resume-1",
    });

    expect(mockTailorBullets).toHaveBeenCalledOnce();
    expect(result.experiences).toHaveLength(1);
    expect(result.experiences[0].experienceId).toBe("exp-1");
  });
});
