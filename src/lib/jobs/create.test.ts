import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JobDescription } from "@/lib/ai/jd-scraper/schema";

const mockScrape = vi.fn();
const mockInsertJob = vi.fn();

vi.mock("@/lib/ai/jd-scraper", () => ({
  scrapeJobDescription: mockScrape,
}));

vi.mock("./repo", () => ({
  insertJob: mockInsertJob,
}));

const fixture: JobDescription = {
  title: "Staff Backend Engineer",
  company: "Acme",
  location: "Remote (US)",
  description: "Build great things.",
  requirements: ["Go expertise", "Distributed systems"],
  niceToHaves: ["Mentorship"],
  seniority: "Staff",
  salaryMin: 200000,
  salaryMax: 260000,
};

beforeEach(() => {
  mockScrape.mockReset();
  mockInsertJob.mockReset();
});

describe("createJobForUser", () => {
  it("scrapes the URL, persists the parsed JD, and returns the new job id", async () => {
    mockScrape.mockResolvedValueOnce(fixture);
    mockInsertJob.mockResolvedValueOnce("job-123");

    const { createJobForUser } = await import("./create");
    const id = await createJobForUser({
      userId: "user-1",
      url: "https://example.com/jobs/1",
    });

    expect(id).toBe("job-123");
    expect(mockScrape).toHaveBeenCalledWith({
      url: "https://example.com/jobs/1",
    });
    expect(mockInsertJob).toHaveBeenCalledWith({
      userId: "user-1",
      sourceUrl: "https://example.com/jobs/1",
      parsed: fixture,
    });
  });

  it("propagates scrape errors without inserting", async () => {
    mockScrape.mockRejectedValueOnce(new Error("fetch failed"));

    const { createJobForUser } = await import("./create");
    await expect(
      createJobForUser({ userId: "user-1", url: "https://example.com/x" }),
    ).rejects.toThrow(/fetch failed/);

    expect(mockInsertJob).not.toHaveBeenCalled();
  });
});
