import { describe, expect, it } from "vitest";
import { calculateBaselineFit } from "./baseline-fit";

describe("calculateBaselineFit", () => {
  it("scores reproducible requirement and title overlap", () => {
    const result = calculateBaselineFit({
      jobTitle: "Customer Support Associate",
      requirements: [
        "Customer service experience",
        "Zendesk ticket management",
        "Spanish fluency",
      ],
      resumeText:
        "Customer Support Associate. Delivered customer service experience and Zendesk ticket management.",
    });

    expect(result.score).toBe(72);
    expect(result.matchedRequirements).toEqual([
      "Customer service experience",
      "Zendesk ticket management",
    ]);
    expect(result.missingRequirements).toEqual(["Spanish fluency"]);
  });

  it("returns a bounded zero for an empty requirement set and unrelated resume", () => {
    expect(
      calculateBaselineFit({
        jobTitle: "Warehouse Associate",
        requirements: [],
        resumeText: "Barista",
      }),
    ).toEqual({
      score: 0,
      matchedRequirements: [],
      missingRequirements: [],
    });
  });
});
