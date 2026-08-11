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
      concerns: ["Availability unclear"],
      recommendations: ["Add morning shift availability"],
    });

    expect(parsed.score).toBe(82);
    expect(parsed.matchingEvidence[0]?.confidence).toBe("high");
  });

  it("rejects out-of-range scores", () => {
    expect(() => ResumeJobFitSchema.parse({ score: 101 })).toThrow();
  });
});
