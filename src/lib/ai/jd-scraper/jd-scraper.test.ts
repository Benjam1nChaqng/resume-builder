import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JobDescription } from "./schema";

const mockCreate = vi.fn();
const mockFetchHtml = vi.fn();

vi.mock("@/lib/ai/anthropic", () => ({
  getAnthropic: () => ({ messages: { create: mockCreate } }),
}));

vi.mock("@/lib/net/safe-fetch", () => ({
  fetchExternalHtml: mockFetchHtml,
}));

const validJobFixture: JobDescription = {
  title: "Senior Software Engineer",
  company: "Acme Corp",
  location: "Remote (US)",
  description: "Build great things at Acme.",
  requirements: ["5+ years TypeScript", "Experience with Next.js"],
  niceToHaves: ["Background in agentic AI"],
  seniority: "Senior",
  salaryMin: 180000,
  salaryMax: 220000,
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
      name: "extract_job_description",
      input,
    },
  ],
  stop_reason: "tool_use" as const,
  stop_sequence: null,
  usage: { input_tokens: 100, output_tokens: 100 },
});

const fetchResult = (init: { ok: boolean; status: number; html?: string }) => ({
  ok: init.ok,
  status: init.status,
  html: init.html ?? "",
});

beforeEach(() => {
  mockCreate.mockReset();
  mockFetchHtml.mockReset();
});

describe("scrapeJobDescription", () => {
  it("returns parsed job description on a valid fetch + Claude response", async () => {
    mockFetchHtml.mockResolvedValueOnce(
      fetchResult({ ok: true, status: 200, html: "<html>...</html>" }),
    );
    mockCreate.mockResolvedValueOnce(toolUseResponse(validJobFixture));

    const { scrapeJobDescription } = await import("./index");
    const result = await scrapeJobDescription({
      url: "https://example.com/jobs/1",
    });

    expect(result).toMatchObject({
      title: "Senior Software Engineer",
      company: "Acme Corp",
      requirements: ["5+ years TypeScript", "Experience with Next.js"],
    });
    expect(mockFetchHtml).toHaveBeenCalledOnce();
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it("throws with the status code when fetch returns non-200", async () => {
    mockFetchHtml.mockResolvedValueOnce(
      fetchResult({ ok: false, status: 404 }),
    );

    const { scrapeJobDescription } = await import("./index");
    await expect(
      scrapeJobDescription({ url: "https://example.com/missing" }),
    ).rejects.toThrow(/404/);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("throws when Claude returns no tool_use block", async () => {
    mockFetchHtml.mockResolvedValueOnce(
      fetchResult({ ok: true, status: 200, html: "<html>x</html>" }),
    );
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

    const { scrapeJobDescription } = await import("./index");
    await expect(
      scrapeJobDescription({ url: "https://example.com/jobs/1" }),
    ).rejects.toThrow(/tool_use/i);
  });

  it("throws when Claude's structured output fails Zod validation", async () => {
    mockFetchHtml.mockResolvedValueOnce(
      fetchResult({ ok: true, status: 200, html: "<html>x</html>" }),
    );
    mockCreate.mockResolvedValueOnce(
      toolUseResponse({
        // Missing required title + company + description
        location: "Remote",
      }),
    );

    const { scrapeJobDescription } = await import("./index");
    await expect(
      scrapeJobDescription({ url: "https://example.com/jobs/1" }),
    ).rejects.toThrow();
  });

  it("uses Opus 4.7 and forces tool_choice to extract_job_description", async () => {
    mockFetchHtml.mockResolvedValueOnce(
      fetchResult({ ok: true, status: 200, html: "<html>x</html>" }),
    );
    mockCreate.mockResolvedValueOnce(toolUseResponse(validJobFixture));

    const { scrapeJobDescription } = await import("./index");
    await scrapeJobDescription({ url: "https://example.com/jobs/1" });

    expect(mockCreate.mock.calls[0][0].model).toBe("claude-opus-4-7");
    expect(mockCreate.mock.calls[0][0].tool_choice).toEqual({
      type: "tool",
      name: "extract_job_description",
    });
  });
});
