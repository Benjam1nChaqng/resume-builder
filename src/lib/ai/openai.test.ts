import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const mockParse = vi.fn();

vi.mock("openai", () => ({
  default: class MockOpenAI {
    responses = { parse: mockParse };
  },
}));

vi.mock("@/env", () => ({
  env: { OPENAI_API_KEY: "openai-test-key" },
}));

const TestSchema = z.object({ value: z.string().min(1) });

beforeEach(() => mockParse.mockReset());

describe("generateStructured", () => {
  it("uses private Responses API structured output with explicit reasoning", async () => {
    mockParse.mockResolvedValueOnce({
      output_parsed: { value: "ok" },
      status: "completed",
    });

    const { generateStructured } = await import("./openai");
    await expect(
      generateStructured({
        model: "gpt-5.6-sol",
        schema: TestSchema,
        schemaName: "test_output",
        system: "Return the requested value.",
        input: "hello",
        maxOutputTokens: 512,
        reasoningEffort: "medium",
      }),
    ).resolves.toEqual({ value: "ok" });

    expect(mockParse).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-5.6-sol",
        instructions: "Return the requested value.",
        input: "hello",
        max_output_tokens: 512,
        reasoning: { effort: "medium" },
        store: false,
        text: expect.objectContaining({ verbosity: "low" }),
      }),
    );
  });

  it("rejects a response without parsed structured output", async () => {
    mockParse.mockResolvedValueOnce({ output_parsed: null, status: "incomplete" });
    const { generateStructured } = await import("./openai");

    await expect(
      generateStructured({
        model: "gpt-5.6-luna",
        schema: TestSchema,
        schemaName: "test_output",
        system: "Return the requested value.",
        input: "hello",
        maxOutputTokens: 512,
      }),
    ).rejects.toThrow(/structured output/i);
  });

  it("validates parsed output again at the application boundary", async () => {
    mockParse.mockResolvedValueOnce({
      output_parsed: { value: "" },
      status: "completed",
    });
    const { generateStructured } = await import("./openai");

    await expect(
      generateStructured({
        model: "gpt-5.6-luna",
        schema: TestSchema,
        schemaName: "test_output",
        system: "Return the requested value.",
        input: "hello",
        maxOutputTokens: 512,
      }),
    ).rejects.toThrow();
  });
});
