import { describe, expect, it } from "vitest";
import { ResumeJobFitSchema } from "./schema";

describe("ResumeJobFitSchema", () => {
  it("accepts bounded scores and structured findings", () => {
    const parsed = ResumeJobFitSchema.parse({
      score: 82,
      matchingEvidence: [{ label: "Customer service", evidence: "Retail role" }],
      missingRequirements: ["Food handler certification"],
      concerns: ["Availability unclear"],
      recommendations: ["Add morning shift availability"],
    });

    expect(parsed.score).toBe(82);
  });

  it("rejects out-of-range scores", () => {
    expect(() => ResumeJobFitSchema.parse({ score: 101 })).toThrow();
  });
});

