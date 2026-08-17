import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JobDescription } from "./schema";

const mockGenerateStructured = vi.fn();
const mockFetchPublicHtml = vi.fn();

vi.mock("@/lib/ai/openai", () => ({
  generateStructured: mockGenerateStructured,
}));

vi.mock("@/lib/jobs/public-web", () => ({
  fetchPublicHtml: mockFetchPublicHtml,
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

beforeEach(() => {
  mockGenerateStructured.mockReset();
  mockFetchPublicHtml.mockReset();
});

describe("scrapeJobDescription", () => {
  it("returns a parsed job description from fetched HTML", async () => {
    mockFetchPublicHtml.mockResolvedValueOnce({
      html: "<html>...</html>",
      finalUrl: "https://example.com/jobs/1",
    });
    mockGenerateStructured.mockResolvedValueOnce(validJobFixture);

    const { scrapeJobDescription } = await import("./index");
    const result = await scrapeJobDescription({
      url: "https://example.com/jobs/1",
    });

    expect(result).toMatchObject({
      title: "Senior Software Engineer",
      company: "Acme Corp",
      requirements: ["5+ years TypeScript", "Experience with Next.js"],
    });
    expect(mockFetchPublicHtml).toHaveBeenCalledOnce();
    expect(mockGenerateStructured).toHaveBeenCalledOnce();
  });

  it("throws with the status code when fetch returns non-200", async () => {
    mockFetchPublicHtml.mockRejectedValueOnce(new Error("HTTP 404"));

    const { scrapeJobDescription } = await import("./index");
    await expect(
      scrapeJobDescription({ url: "https://example.com/missing" }),
    ).rejects.toThrow(/404/);
    expect(mockGenerateStructured).not.toHaveBeenCalled();
  });

  it("propagates a missing structured output error", async () => {
    mockFetchPublicHtml.mockResolvedValueOnce({
      html: "<html>x</html>",
      finalUrl: "https://example.com/jobs/1",
    });
    mockGenerateStructured.mockRejectedValueOnce(
      new Error("OpenAI did not return valid structured output."),
    );

    const { scrapeJobDescription } = await import("./index");
    await expect(
      scrapeJobDescription({ url: "https://example.com/jobs/1" }),
    ).rejects.toThrow(/structured output/i);
  });

  it("propagates structured output validation failures", async () => {
    mockFetchPublicHtml.mockResolvedValueOnce({
      html: "<html>x</html>",
      finalUrl: "https://example.com/jobs/1",
    });
    mockGenerateStructured.mockRejectedValueOnce(
      new Error("Invalid structured job description"),
    );

    const { scrapeJobDescription } = await import("./index");
    await expect(
      scrapeJobDescription({ url: "https://example.com/jobs/1" }),
    ).rejects.toThrow();
  });

  it("uses the GPT planner tier and job-description schema", async () => {
    mockFetchPublicHtml.mockResolvedValueOnce({
      html: "<html>x</html>",
      finalUrl: "https://example.com/jobs/1",
    });
    mockGenerateStructured.mockResolvedValueOnce(validJobFixture);

    const { scrapeJobDescription } = await import("./index");
    await scrapeJobDescription({ url: "https://example.com/jobs/1" });

    expect(mockGenerateStructured.mock.calls[0][0]).toMatchObject({
      model: "gpt-5.6-sol",
      schemaName: "extract_job_description",
      maxOutputTokens: 4096,
    });
  });
});
