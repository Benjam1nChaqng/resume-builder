import { describe, expect, it } from "vitest";
import { indexLatestFitsByResume } from "./fit-history";

describe("indexLatestFitsByResume", () => {
  it("keeps immutable history while selecting the newest row per resume", () => {
    const history = [
      { id: "fit-new-a", resumeId: "resume-a", score: 80 },
      { id: "fit-b", resumeId: "resume-b", score: 70 },
      { id: "fit-old-a", resumeId: "resume-a", score: 60 },
    ];

    const latest = indexLatestFitsByResume(history);

    expect(latest.get("resume-a")?.id).toBe("fit-new-a");
    expect(latest.get("resume-b")?.id).toBe("fit-b");
    expect(history).toHaveLength(3);
  });
});
