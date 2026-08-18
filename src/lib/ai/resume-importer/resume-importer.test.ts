import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { ParsedResume } from "./schema";
import { ParsedResumeSchema } from "./schema";

const mockGenerateStructured = vi.fn();
const mockBlobGet = vi.fn();

vi.mock("@/lib/ai/openai", () => ({
  generateStructured: mockGenerateStructured,
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

beforeEach(() => {
  mockGenerateStructured.mockReset();
  mockBlobGet.mockReset();
});

describe("importResume", () => {
  it("generates an OpenAI-compatible schema without the unsupported uri format", () => {
    const jsonSchema = JSON.stringify(z.toJSONSchema(ParsedResumeSchema));

    expect(jsonSchema).not.toContain('"format":"uri"');
    expect(jsonSchema).toContain('"pattern":"^https?:\\\\/\\\\/');
  });

  it("returns a structured resume for text input", async () => {
    mockGenerateStructured.mockResolvedValueOnce(validResumeFixture);

    const { importResume } = await import("./index");
    const result = await importResume({ kind: "text", content: "Jane Doe\nAcme, Senior Engineer..." });

    expect(result).toMatchObject({
      title: "Software Engineer Resume",
      contactInfo: { fullName: "Jane Doe" },
    });
    expect(mockGenerateStructured).toHaveBeenCalledOnce();
  });

  it("fetches the private PDF and sends base64 bytes instead of its Blob URL", async () => {
    const pdfBytes = new Uint8Array([1, 2, 3, 4]);
    mockBlobGet.mockResolvedValueOnce(fakeBlobResponse(pdfBytes));
    mockGenerateStructured.mockResolvedValueOnce(validResumeFixture);

    const { importResume } = await import("./index");
    await importResume({ kind: "pdf", pdfUrl: "https://blob.example.com/r.pdf" });

    expect(mockBlobGet).toHaveBeenCalledWith(
      "https://blob.example.com/r.pdf",
      expect.objectContaining({ access: "private" }),
    );

    const call = mockGenerateStructured.mock.calls[0][0];
    const userContent = call.input as Array<{
      type: string;
      text?: string;
      filename?: string;
      file_data?: string;
    }>;
    const doc = userContent.find((c) => c.type === "input_file");
    expect(doc).toBeDefined();
    expect(doc).toMatchObject({
      filename: "resume.pdf",
      file_data: `data:application/pdf;base64,${Buffer.from(pdfBytes).toString("base64")}`,
    });
    const text = userContent.find((c) => c.type === "input_text");
    expect(text?.text).toMatch(/structured format/i);
  });

  it("throws when the private Blob is not found (get returns null)", async () => {
    mockBlobGet.mockResolvedValueOnce(null);

    const { importResume } = await import("./index");
    await expect(
      importResume({ kind: "pdf", pdfUrl: "https://blob.example.com/missing.pdf" }),
    ).rejects.toThrow(/not found|blob/i);
    expect(mockGenerateStructured).not.toHaveBeenCalled();
  });

  it("requests strict extract_resume structured output", async () => {
    mockGenerateStructured.mockResolvedValueOnce(validResumeFixture);

    const { importResume } = await import("./index");
    await importResume({ kind: "text", content: "x" });

    expect(mockGenerateStructured.mock.calls[0][0]).toMatchObject({
      schemaName: "extract_resume",
      maxOutputTokens: 8192,
    });
  });

  it("uses the GPT planner tier", async () => {
    mockGenerateStructured.mockResolvedValueOnce(validResumeFixture);

    const { importResume } = await import("./index");
    await importResume({ kind: "text", content: "x" });

    expect(mockGenerateStructured.mock.calls[0][0].model).toBe("gpt-5.6-sol");
  });

  it("propagates a missing structured output error", async () => {
    mockGenerateStructured.mockRejectedValueOnce(
      new Error("OpenAI did not return valid structured output."),
    );

    const { importResume } = await import("./index");
    await expect(importResume({ kind: "text", content: "garbage" })).rejects.toThrow(
      /structured output/i,
    );
  });

  it("propagates structured output validation failures", async () => {
    mockGenerateStructured.mockRejectedValueOnce(
      new Error("Invalid structured resume"),
    );

    const { importResume } = await import("./index");
    await expect(importResume({ kind: "text", content: "x" })).rejects.toThrow();
  });
});
