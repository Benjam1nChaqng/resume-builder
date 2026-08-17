import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  TailorExperience,
  TailorJobDescription,
  TailoredBullets,
} from "./schema";

const mockGenerateStructured = vi.fn();

vi.mock("@/lib/ai/openai", () => ({
  generateStructured: mockGenerateStructured,
}));

const experience: TailorExperience = {
  company: "Acme",
  role: "Senior Engineer",
  bullets: [
    "Built backend services in Go.",
    "Mentored junior engineers and ran weekly design reviews.",
  ],
};

const jobDescription: TailorJobDescription = {
  title: "Staff Backend Engineer",
  requirements: ["Strong Go experience", "Designed distributed systems"],
  niceToHaves: ["Mentorship experience"],
};

const tailoredOutput: TailoredBullets = {
  bullets: [
    {
      originalText: "Built backend services in Go.",
      text: "Designed and built distributed backend services in Go serving production traffic.",
      rationale: "Surfaces the JD's distributed-systems requirement.",
    },
    {
      originalText:
        "Mentored junior engineers and ran weekly design reviews.",
      text: "Mentored junior engineers and led weekly design reviews to raise team velocity.",
      rationale: "Keeps the user's mentorship line, aligns vocab with JD nice-to-have.",
    },
  ],
};

beforeEach(() => {
  mockGenerateStructured.mockReset();
});

describe("tailorBullets", () => {
  it("returns tailored bullets matching the input bullet count on a valid response", async () => {
    mockGenerateStructured.mockResolvedValueOnce(tailoredOutput);

    const { tailorBullets } = await import("./index");
    const result = await tailorBullets({ experience, jobDescription });

    expect(result.bullets).toHaveLength(experience.bullets.length);
    expect(result.bullets[0]).toMatchObject({
      originalText: experience.bullets[0],
      text: expect.any(String),
      rationale: expect.any(String),
    });
    expect(mockGenerateStructured).toHaveBeenCalledOnce();
  });

  it("uses the cost-efficient GPT executor tier", async () => {
    mockGenerateStructured.mockResolvedValueOnce(tailoredOutput);

    const { tailorBullets } = await import("./index");
    await tailorBullets({ experience, jobDescription });

    expect(mockGenerateStructured.mock.calls[0][0].model).toBe("gpt-5.6-luna");
  });

  it("requests strict tailor_bullets structured output", async () => {
    mockGenerateStructured.mockResolvedValueOnce(tailoredOutput);

    const { tailorBullets } = await import("./index");
    await tailorBullets({ experience, jobDescription });

    expect(mockGenerateStructured.mock.calls[0][0]).toMatchObject({
      schemaName: "tailor_bullets",
      maxOutputTokens: 4096,
    });
  });

  it("propagates a missing structured output error", async () => {
    mockGenerateStructured.mockRejectedValueOnce(
      new Error("OpenAI did not return valid structured output."),
    );

    const { tailorBullets } = await import("./index");
    await expect(
      tailorBullets({ experience, jobDescription }),
    ).rejects.toThrow(/structured output/i);
  });

  it("propagates structured output validation failures", async () => {
    mockGenerateStructured.mockRejectedValueOnce(
      new Error("Invalid tailored bullet output"),
    );

    const { tailorBullets } = await import("./index");
    await expect(
      tailorBullets({ experience, jobDescription }),
    ).rejects.toThrow();
  });
});
