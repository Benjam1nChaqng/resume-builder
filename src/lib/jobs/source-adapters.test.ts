import { describe, expect, it, vi } from "vitest";
import {
  attributeListingsToSourceCompany,
  detectSupportedJobSource,
  discoverListingsFromSource,
} from "./source-adapters";

describe("job source adapters", () => {
  it("attributes missing company names only for dedicated supported boards", () => {
    const listing = {
      canonicalUrl: "https://jobs.lever.co/acme/1",
      title: "Office Assistant",
      company: null,
      location: null,
    };

    expect(
      attributeListingsToSourceCompany([listing], {
        sourceUrl: "https://jobs.lever.co/acme",
        sourceLabel: "Acme Corporation",
      }),
    ).toEqual([{ ...listing, company: "Acme Corporation" }]);
    expect(
      attributeListingsToSourceCompany([listing], {
        sourceUrl: "https://example.com/job-search",
        sourceLabel: "Local job search",
      }),
    ).toEqual([listing]);
    expect(listing.company).toBeNull();
  });

  it("does not replace company metadata already supplied by a feed", () => {
    const listing = {
      canonicalUrl: "https://jobs.ashbyhq.com/acme/1",
      title: "Barista",
      company: "Acme Coffee",
      location: null,
    };

    expect(
      attributeListingsToSourceCompany([listing], {
        sourceUrl: "https://jobs.ashbyhq.com/acme",
        sourceLabel: "Acme Careers",
      }),
    ).toEqual([listing]);
  });

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

  it("maps localized Workday search URLs and preserves search facets", () => {
    expect(
      detectSupportedJobSource(
        "https://workday.wd5.myworkdayjobs.com/en-US/Workday/jobs?q=customer%20support&locationCountry=USA&locationCountry=CAN&utm_source=feed",
      ),
    ).toEqual({
      kind: "workday",
      endpoint:
        "https://workday.wd5.myworkdayjobs.com/wday/cxs/workday/Workday/jobs",
      publicBaseUrl:
        "https://workday.wd5.myworkdayjobs.com/en-US/Workday",
      searchText: "customer support",
      appliedFacets: { locationCountry: ["USA", "CAN"] },
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

  it("paginates Workday results up to the adapter listing limit", async () => {
    const firstPage = Array.from({ length: 20 }, (_, index) => ({
      title: `Support Associate ${index + 1}`,
      externalPath: `/job/Remote/Support-Associate-${index + 1}_JR-${index + 1}`,
      locationsText: "United States",
      postedOn: "Posted Today",
      remoteType: "Remote",
    }));
    const postJson = vi
      .fn()
      .mockResolvedValueOnce({
        finalUrl: "fixture-page-1",
        data: { total: 21, jobPostings: firstPage },
      })
      .mockResolvedValueOnce({
        finalUrl: "fixture-page-2",
        data: {
          total: 21,
          jobPostings: [
            {
              title: "Office Coordinator",
              externalPath: "/job/Pleasanton/Office-Coordinator_JR-21",
              locationsText: "Pleasanton, CA",
              postedOn: "2026-08-01T12:00:00.000Z",
              remoteType: "Onsite",
            },
          ],
        },
      });

    const listings = await discoverListingsFromSource(
      "https://workday.wd5.myworkdayjobs.com/en-US/Workday?q=support",
      { postJson },
    );

    expect(listings).toHaveLength(21);
    expect(listings[0]).toMatchObject({
      canonicalUrl:
        "https://workday.wd5.myworkdayjobs.com/en-US/Workday/job/Remote/Support-Associate-1_JR-1",
      location: "Remote - United States",
      postedAt: null,
    });
    expect(postJson).toHaveBeenNthCalledWith(
      1,
      "https://workday.wd5.myworkdayjobs.com/wday/cxs/workday/Workday/jobs",
      {
        appliedFacets: {},
        limit: 20,
        offset: 0,
        searchText: "support",
      },
    );
    expect(postJson).toHaveBeenNthCalledWith(
      2,
      "https://workday.wd5.myworkdayjobs.com/wday/cxs/workday/Workday/jobs",
      {
        appliedFacets: {},
        limit: 20,
        offset: 20,
        searchText: "support",
      },
    );
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

    await expect(
      discoverListingsFromSource(
        "https://workday.wd5.myworkdayjobs.com/Workday",
        {
          postJson: vi.fn().mockResolvedValue({
            data: { total: 1, jobPostings: [{ title: "Missing path" }] },
          }),
        },
      ),
    ).rejects.toThrow(/Workday returned unexpected job data/);

    await expect(
      discoverListingsFromSource(
        "https://workday.wd5.myworkdayjobs.com/Workday",
        {
          postJson: vi.fn().mockResolvedValue({
            data: {
              total: 1,
              jobPostings: [
                { title: "Unsafe path", externalPath: "//example.com/job/1" },
              ],
            },
          }),
        },
      ),
    ).rejects.toThrow(/Workday returned unexpected job data/);
  });
});
