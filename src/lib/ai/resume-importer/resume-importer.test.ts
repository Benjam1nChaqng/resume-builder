import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ParsedResume } from "./schema";

const mockCreate = vi.fn();

vi.mock("@/lib/ai/anthropic", () => ({
  getAnthropic: () => ({ messages: { create: mockCreate } }),
}));

const validResumeFixture: ParsedResume = {
  title: "Software Engineer Resume",
  contactInfo: {
    fullName: "Jane Doe",
    email: "jane@example.com",
    phone: null,
    location: "SF",
    links: [],
  },
  experiences: [
    {
      company: "Acme",
      role: "Senior Engineer",
      location: null,
      startDate: "2020-01-01",
      endDate: null,
      current: true,
      bullets: [{ text: "Built X." }],
    },
  ],
  educations: [],
  skills: [],
  projects: [],
};

const toolUseResponse = (input: unknown) => ({
  id: "msg_1",
  type: "message" as const,
  role: "assistant" as const,
  model: "claude-opus-4-7",
  content: [
    {
      type: "tool_use" as const,
      id: "toolu_1",
      name: "extract_resume",
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

describe("importResume", () => {
  it("returns parsed resume on a valid Claude tool_use response (text input)", async () => {
    mockCreate.mockResolvedValueOnce(toolUseResponse(validResumeFixture));

    const { importResume } = await import("./index");
    const result = await importResume({ kind: "text", content: "Jane Doe\nAcme, Senior Engineer..." });

    expect(result).toMatchObject({
      title: "Software Engineer Resume",
      contactInfo: { fullName: "Jane Doe" },
    });
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it("sends a document content block when kind=pdf", async () => {
    mockCreate.mockResolvedValueOnce(toolUseResponse(validResumeFixture));

    const { importResume } = await import("./index");
    await importResume({ kind: "pdf", pdfUrl: "https://example.com/r.pdf" });

    const call = mockCreate.mock.calls[0][0];
    const userContent = call.messages[0].content as Array<{ type: string }>;
    const hasDocument = userContent.some((c) => c.type === "document");
    expect(hasDocument).toBe(true);
  });

  it("forces tool_choice to extract_resume so Claude can't free-form respond", async () => {
    mockCreate.mockResolvedValueOnce(toolUseResponse(validResumeFixture));

    const { importResume } = await import("./index");
    await importResume({ kind: "text", content: "x" });

    expect(mockCreate.mock.calls[0][0].tool_choice).toEqual({
      type: "tool",
      name: "extract_resume",
    });
  });

  it("uses the planner model (Opus 4.7) per CLAUDE.md model-tier convention", async () => {
    mockCreate.mockResolvedValueOnce(toolUseResponse(validResumeFixture));

    const { importResume } = await import("./index");
    await importResume({ kind: "text", content: "x" });

    expect(mockCreate.mock.calls[0][0].model).toBe("claude-opus-4-7");
  });

  it("throws when Claude returns no tool_use block", async () => {
    mockCreate.mockResolvedValueOnce({
      id: "msg_1",
      type: "message",
      role: "assistant",
      model: "claude-opus-4-7",
      content: [{ type: "text", text: "I cannot parse this." }],
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 10 },
    });

    const { importResume } = await import("./index");
    await expect(importResume({ kind: "text", content: "garbage" })).rejects.toThrow(/tool_use/i);
  });

  it("throws when Claude's structured output fails Zod validation", async () => {
    mockCreate.mockResolvedValueOnce(
      toolUseResponse({
        // Missing required title + contactInfo.fullName
        contactInfo: {},
      }),
    );

    const { importResume } = await import("./index");
    await expect(importResume({ kind: "text", content: "x" })).rejects.toThrow();
  });
});
