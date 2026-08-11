import { describe, expect, it } from "vitest";
import { ResumeJobFitSchema } from "./schema";

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
