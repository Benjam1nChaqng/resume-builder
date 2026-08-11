import { describe, expect, it, vi } from "vitest";
import {
  detectSupportedJobSource,
  discoverListingsFromSource,
} from "./source-adapters";

describe("job source adapters", () => {
  it("maps Greenhouse board and embed URLs to the public jobs API", () => {
    expect(
      detectSupportedJobSource("https://boards.greenhouse.io/acme/jobs/123"),
    ).toEqual({
      kind: "greenhouse",
      endpoint: "https://boards-api.greenhouse.io/v1/boards/acme/jobs",
    });
    expect(
      detectSupportedJobSource(
        "https://job-boards.greenhouse.io/embed/job_board?for=acme",
      ),
    ).toEqual({
      kind: "greenhouse",
      endpoint: "https://boards-api.greenhouse.io/v1/boards/acme/jobs",
    });
  });

  it("preserves supported filters for global and EU Lever boards", () => {
    expect(
      detectSupportedJobSource(
        "https://jobs.lever.co/acme?location=Remote&team=Support",
      ),
    ).toEqual({
      kind: "lever",
      endpoint:
        "https://api.lever.co/v0/postings/acme?mode=json&limit=100&location=Remote&team=Support",
    });
    expect(detectSupportedJobSource("https://jobs.eu.lever.co/acme")).toEqual({
      kind: "lever",
      endpoint: "https://api.eu.lever.co/v0/postings/acme?mode=json&limit=100",
    });
  });

  it("extracts Greenhouse jobs from structured API data", async () => {
    const fetchJson = vi.fn().mockResolvedValue({
      finalUrl: "https://boards-api.greenhouse.io/v1/boards/acme/jobs",
      data: {
        jobs: [
          {
            title: "Customer Support Associate",
            absolute_url:
              "https://job-boards.greenhouse.io/acme/jobs/123?gh_src=feed",
            location: { name: "Remote - US" },
          },
        ],
      },
    });

    await expect(
      discoverListingsFromSource("https://boards.greenhouse.io/acme", {
        fetchJson,
      }),
    ).resolves.toEqual([
      {
        canonicalUrl: "https://job-boards.greenhouse.io/acme/jobs/123",
        title: "Customer Support Associate",
        company: null,
        location: "Remote - US",
      },
    ]);
  });

  it("extracts Lever jobs and normalizes remote location", async () => {
    const fetchJson = vi.fn().mockResolvedValue({
      finalUrl: "https://api.lever.co/v0/postings/acme?mode=json",
      data: [
        {
          text: "Operations Coordinator",
          hostedUrl: "https://jobs.lever.co/acme/abc?utm_source=feed",
          categories: { location: "United States" },
          workplaceType: "remote",
        },
      ],
    });

    await expect(
      discoverListingsFromSource("https://jobs.lever.co/acme", { fetchJson }),
    ).resolves.toEqual([
      {
        canonicalUrl: "https://jobs.lever.co/acme/abc",
        title: "Operations Coordinator",
        company: null,
        location: "Remote - United States",
      },
    ]);
  });

  it("falls back to safe HTML discovery for unsupported sources", async () => {
    const fetchHtml = vi.fn().mockResolvedValue({
      finalUrl: "https://careers.example.com/openings",
      html: '<a href="/jobs/1">Office Assistant Job</a>',
    });

    const listings = await discoverListingsFromSource(
      "https://careers.example.com/openings",
      { fetchHtml },
    );

    expect(fetchHtml).toHaveBeenCalledWith("https://careers.example.com/openings");
    expect(listings[0]?.canonicalUrl).toBe("https://careers.example.com/jobs/1");
  });

  it("rejects malformed ATS API responses", async () => {
    const fetchJson = vi.fn().mockResolvedValue({ data: { jobs: [{}] } });
    await expect(
      discoverListingsFromSource("https://boards.greenhouse.io/acme", {
        fetchJson,
      }),
    ).rejects.toThrow(/unexpected job data/);
  });
});
