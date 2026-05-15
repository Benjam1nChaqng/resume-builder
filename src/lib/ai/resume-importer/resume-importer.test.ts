import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ParsedResume } from "./schema";

const mockCreate = vi.fn();
const mockBlobGet = vi.fn();

vi.mock("@/lib/ai/anthropic", () => ({
  getAnthropic: () => ({ messages: { create: mockCreate } }),
}));

vi.mock("@vercel/blob", () => ({
  get: mockBlobGet,
}));

function fakeBlobResponse(bytes: Uint8Array) {
  return {
    statusCode: 200 as const,
    stream: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    }),
    headers: new Headers(),
    blob: {
      url: "https://blob.example.com/x.pdf",
      pathname: "x.pdf",
      contentType: "application/pdf",
      size: bytes.byteLength,
    } as never,
  };
}

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
  mockBlobGet.mockReset();
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

  it("fetches the PDF from private Blob storage and sends base64 bytes (not a URL) to Claude", async () => {
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // "%PDF-1.4"
    mockBlobGet.mockResolvedValueOnce(fakeBlobResponse(pdfBytes));
    mockCreate.mockResolvedValueOnce(toolUseResponse(validResumeFixture));

    const { importResume } = await import("./index");
    await importResume({ kind: "pdf", pdfUrl: "https://blob.example.com/r.pdf" });

    expect(mockBlobGet).toHaveBeenCalledWith(
      "https://blob.example.com/r.pdf",
      expect.objectContaining({ access: "private" }),
    );

    const call = mockCreate.mock.calls[0][0];
    const userContent = call.messages[0].content as Array<{
      type: string;
      source?: { type: string; media_type?: string; data?: string };
    }>;
    const doc = userContent.find((c) => c.type === "document");
    expect(doc).toBeDefined();
    expect(doc!.source).toEqual({
      type: "base64",
      media_type: "application/pdf",
      data: Buffer.from(pdfBytes).toString("base64"),
    });
  });

  it("throws when the private Blob is not found (get returns null)", async () => {
    mockBlobGet.mockResolvedValueOnce(null);

    const { importResume } = await import("./index");
    await expect(
      importResume({ kind: "pdf", pdfUrl: "https://blob.example.com/missing.pdf" }),
    ).rejects.toThrow(/not found|blob/i);
    expect(mockCreate).not.toHaveBeenCalled();
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
