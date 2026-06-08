import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreate = vi.fn();

vi.mock("@/lib/ai/anthropic", () => ({
  getAnthropic: () => ({ messages: { create: mockCreate } }),
}));

const toolUseResponse = (input: unknown) => ({
  id: "msg_1",
  type: "message" as const,
  role: "assistant" as const,
  model: "claude-opus-4-7",
  content: [{ type: "tool_use" as const, id: "t1", name: "compose_job_email", input }],
  stop_reason: "tool_use" as const,
  stop_sequence: null,
  usage: { input_tokens: 10, output_tokens: 10 },
});

const input = {
  job: {
    title: "AV Technician",
    company: "Acme",
    description: "Install AV systems.",
    requirements: ["IP cameras", "Cabling"],
  },
  resumeText: "Benjamin Chang\nExperience\nTelecom Technician",
  candidateName: "Benjamin Chang",
};

beforeEach(() => mockCreate.mockReset());

describe("draftJobEmail", () => {
  it("returns a validated subject + body from Claude", async () => {
    mockCreate.mockResolvedValueOnce(
      toolUseResponse({
        subject: "Application: AV Technician — Acme",
        body: "Hi,\n\nI'd love to apply. Resume attached.\n\nThanks,\nBenjamin",
      }),
    );
    const { draftJobEmail } = await import("./index");
    const result = await draftJobEmail(input);
    expect(result.subject).toContain("AV Technician");
    expect(result.body).toContain("Resume attached.");
  });

  it("uses Opus 4.7 and forces the compose_job_email tool", async () => {
    mockCreate.mockResolvedValueOnce(
      toolUseResponse({ subject: "s", body: "b" }),
    );
    const { draftJobEmail } = await import("./index");
    await draftJobEmail(input);
    expect(mockCreate.mock.calls[0][0].model).toBe("claude-opus-4-7");
    expect(mockCreate.mock.calls[0][0].tool_choice).toEqual({
      type: "tool",
      name: "compose_job_email",
    });
  });

  it("throws when Claude returns no tool_use block", async () => {
    mockCreate.mockResolvedValueOnce({
      id: "m",
      type: "message",
      role: "assistant",
      model: "claude-opus-4-7",
      content: [{ type: "text", text: "no" }],
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 },
    });
    const { draftJobEmail } = await import("./index");
    await expect(draftJobEmail(input)).rejects.toThrow(/tool_use/i);
  });

  it("throws when the structured output fails validation", async () => {
    mockCreate.mockResolvedValueOnce(toolUseResponse({ subject: "" }));
    const { draftJobEmail } = await import("./index");
    await expect(draftJobEmail(input)).rejects.toThrow();
  });
});
