import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResumeJobFitSchema } from "./schema";

const mockGenerateStructured = vi.fn();

vi.mock("@/lib/ai/openai", () => ({
  generateStructured: mockGenerateStructured,
}));

beforeEach(() => mockGenerateStructured.mockReset());

describe("ResumeJobFitSchema", () => {
  it("accepts bounded scores and structured findings", () => {
    const parsed = ResumeJobFitSchema.parse({
      score: 82,
      matchingEvidence: [
        {
          label: "Customer service",
          evidence: "Retail role",
          sourceSection: "experience",
          confidence: "high",
        },
      ],
      missingRequirements: ["Food handler certification"],
      missingPreferredRequirements: ["Weekend availability"],
      concerns: ["Availability unclear"],
      unsupportedClaims: ["Do not claim Zendesk experience"],
      recommendations: ["Add morning shift availability"],
    });

    expect(parsed.score).toBe(82);
    expect(parsed.matchingEvidence[0]?.confidence).toBe("high");
    expect(parsed.missingPreferredRequirements).toEqual(["Weekend availability"]);
    expect(parsed.unsupportedClaims).toEqual([
      "Do not claim Zendesk experience",
    ]);
  });

  it("rejects out-of-range scores", () => {
    expect(() => ResumeJobFitSchema.parse({ score: 101 })).toThrow();
  });
});

describe("analyzeResumeFit", () => {
  it("uses the GPT reviewer tier with medium reasoning", async () => {
    const fit = {
      score: 82,
      matchingEvidence: [],
      missingRequirements: [],
      missingPreferredRequirements: [],
      concerns: [],
      unsupportedClaims: [],
      recommendations: [],
    };
    mockGenerateStructured.mockResolvedValueOnce(fit);

    const { analyzeResumeFit } = await import("./index");
    await expect(
      analyzeResumeFit({
        job: {
          title: "Support Technician",
          company: "Acme",
          description: "Support users.",
          requirements: ["Windows support"],
          niceToHaves: null,
        },
        resumeText: "Help Desk Technician",
      }),
    ).resolves.toBe(fit);

    expect(mockGenerateStructured.mock.calls[0][0]).toMatchObject({
      model: "gpt-5.6-sol",
      schemaName: "score_resume_fit",
      reasoningEffort: "medium",
    });
  });
});
