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
        postedAt: null,
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
        employmentType: null,
        postedAt: null,
      },
    ]);
  });

  it("extracts listed Ashby jobs with public compensation metadata", async () => {
    expect(detectSupportedJobSource("https://jobs.ashbyhq.com/Acme")).toEqual({
      kind: "ashby",
      endpoint:
        "https://api.ashbyhq.com/posting-api/job-board/Acme?includeCompensation=true",
    });
    const fetchJson = vi.fn().mockResolvedValue({
      finalUrl:
        "https://api.ashbyhq.com/posting-api/job-board/Acme?includeCompensation=true",
      data: {
        jobs: [
          {
            title: "Customer Experience Associate",
            location: "United States",
            isListed: true,
            isRemote: true,
            employmentType: "FullTime",
            publishedAt: "2026-08-01T12:00:00.000Z",
            jobUrl: "https://jobs.ashbyhq.com/Acme/abc?utm_source=feed",
            compensation: {
              scrapeableCompensationSalarySummary: "$50K - $60K",
            },
          },
          {
            title: "Unlisted Role",
            location: "New York",
            isListed: false,
            jobUrl: "https://jobs.ashbyhq.com/Acme/hidden",
          },
        ],
      },
    });

    await expect(
      discoverListingsFromSource("https://jobs.ashbyhq.com/Acme", {
        fetchJson,
      }),
    ).resolves.toEqual([
      {
        canonicalUrl: "https://jobs.ashbyhq.com/Acme/abc",
        title: "Customer Experience Associate",
        company: null,
        location: "Remote - United States",
        employmentType: "FullTime",
        compensationText: "$50K - $60K",
        postedAt: new Date("2026-08-01T12:00:00.000Z"),
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
