import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  TailorExperience,
  TailorJobDescription,
  TailoredBullets,
} from "./schema";

const mockCreate = vi.fn();

vi.mock("@/lib/ai/anthropic", () => ({
  getAnthropic: () => ({ messages: { create: mockCreate } }),
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

const toolUseResponse = (input: unknown) => ({
  id: "msg_1",
  type: "message" as const,
  role: "assistant" as const,
  model: "claude-sonnet-4-6",
  content: [
    {
      type: "tool_use" as const,
      id: "toolu_1",
      name: "tailor_bullets",
      input,
    },
  ],
  stop_reason: "tool_use" as const,
  stop_sequence: null,
  usage: { input_tokens: 100, output_tokens: 100 },
});

beforeEach(() => {
  mockCreate.mockReset();
});

describe("tailorBullets", () => {
  it("returns tailored bullets matching the input bullet count on a valid response", async () => {
    mockCreate.mockResolvedValueOnce(toolUseResponse(tailoredOutput));

    const { tailorBullets } = await import("./index");
    const result = await tailorBullets({ experience, jobDescription });

    expect(result.bullets).toHaveLength(experience.bullets.length);
    expect(result.bullets[0]).toMatchObject({
      originalText: experience.bullets[0],
      text: expect.any(String),
      rationale: expect.any(String),
    });
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it("uses the executor model (Sonnet 4.6) per CLAUDE.md model-tier convention", async () => {
    mockCreate.mockResolvedValueOnce(toolUseResponse(tailoredOutput));

    const { tailorBullets } = await import("./index");
    await tailorBullets({ experience, jobDescription });

    expect(mockCreate.mock.calls[0][0].model).toBe("claude-sonnet-4-6");
  });

  it("forces tool_choice to tailor_bullets so Claude can't free-form respond", async () => {
    mockCreate.mockResolvedValueOnce(toolUseResponse(tailoredOutput));

    const { tailorBullets } = await import("./index");
    await tailorBullets({ experience, jobDescription });

    expect(mockCreate.mock.calls[0][0].tool_choice).toEqual({
      type: "tool",
      name: "tailor_bullets",
    });
  });

  it("throws when Claude returns no tool_use block", async () => {
    mockCreate.mockResolvedValueOnce({
      id: "msg_1",
      type: "message",
      role: "assistant",
      model: "claude-sonnet-4-6",
      content: [{ type: "text", text: "I cannot tailor this." }],
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 10 },
    });

    const { tailorBullets } = await import("./index");
    await expect(
      tailorBullets({ experience, jobDescription }),
    ).rejects.toThrow(/tool_use/i);
  });

  it("throws when Claude's structured output fails Zod validation", async () => {
    mockCreate.mockResolvedValueOnce(
      toolUseResponse({
        bullets: [
          {
            // Missing required text + rationale
            originalText: "Built backend services in Go.",
          },
        ],
      }),
    );

    const { tailorBullets } = await import("./index");
    await expect(
      tailorBullets({ experience, jobDescription }),
    ).rejects.toThrow();
  });
});
