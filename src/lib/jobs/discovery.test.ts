import { describe, expect, it } from "vitest";
import {
  JobSourceInputSchema,
  JobSearchProfileInputSchema,
  buildJobListingFingerprint,
  canonicalizeJobUrl,
  parseJobListingsFromHtml,
} from "./discovery";

describe("job discovery helpers", () => {
  it("canonicalizes URLs for dedupe", () => {
    expect(
      canonicalizeJobUrl(
        "/careers/barista/?utm_source=x#apply",
        "https://WWW.Example.com/jobs",
      ),
    ).toBe("https://www.example.com/careers/barista");
    expect(() =>
      canonicalizeJobUrl("javascript:alert('nope')", "https://example.com"),
    ).toThrow(/HTTP or HTTPS/);
  });

  it("parses likely job links and dedupes by canonical URL", () => {
    const html = `
      <a href="/jobs/assistant?utm_campaign=social">Office Assistant</a>
      <a href="/jobs/assistant">Office Assistant duplicate</a>
      <a href="/about">About us</a>
      <a href="https://boards.greenhouse.io/acme/jobs/123">Warehouse Associate</a>
    `;

    const listings = parseJobListingsFromHtml(html, "https://acme.test/careers");

    expect(listings).toHaveLength(2);
    expect(listings.map((l) => l.title)).toEqual([
      "Office Assistant",
      "Warehouse Associate",
    ]);
  });

  it("normalizes employer and title fingerprints for cross-link dedupe", () => {
    expect(
      buildJobListingFingerprint({
        company: "Acme, Inc.",
        title: "Office Assistant (Part-Time)",
        location: "Los Angeles, CA",
      }),
    ).toBe("acme|office assistant part time|los angeles ca");
    expect(
      buildJobListingFingerprint({
        company: "ACME Company",
        title: "Office Assistant - Part Time",
        location: "Los Angeles CA",
      }),
    ).toBe("acme|office assistant part time|los angeles ca");
    expect(
      buildJobListingFingerprint({
        company: null,
        title: "Office Assistant",
      }),
    ).toBeNull();
    expect(
      buildJobListingFingerprint({
        company: "Acme",
        title: "Office Assistant",
        location: "Seattle, WA",
      }),
    ).not.toBe(
      buildJobListingFingerprint({
        company: "Acme",
        title: "Office Assistant",
        location: "Portland, OR",
      }),
    );
  });

  it("extracts JobPosting JSON-LD and dedupes it against matching links", () => {
    const html = `
      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@graph": [{
            "@type": ["Thing", "JobPosting"],
            "title": "Customer Support Associate",
            "url": "/jobs/support?utm_source=board",
            "jobLocationType": "TELECOMMUTE",
            "hiringOrganization": { "@type": "Organization", "name": "Acme Services" }
          }]
        }
      </script>
      <a href="/jobs/support">Customer Support Associate</a>
    `;

    expect(parseJobListingsFromHtml(html, "https://acme.test/careers")).toEqual([
      {
        canonicalUrl: "https://acme.test/jobs/support",
        title: "Customer Support Associate",
        company: "Acme Services",
        location: "Remote",
      },
    ]);
  });

  it("extracts structured locations and ignores malformed JSON-LD", () => {
    const html = `
      <script type="application/ld+json">{ definitely not json }</script>
      <script data-source="careers" type="application/ld+json">
        [{
          "@type": "JobPosting",
          "name": "Office Coordinator",
          "url": "https://jobs.example.com/positions/42",
          "hiringOrganization": { "name": "Example Co" },
          "jobLocation": {
            "address": {
              "addressLocality": "Seattle",
              "addressRegion": "WA",
              "addressCountry": { "name": "US" }
            }
          }
        }]
      </script>
    `;

    const [listing] = parseJobListingsFromHtml(html, "https://jobs.example.com");
    expect(listing).toMatchObject({
      title: "Office Coordinator",
      company: "Example Co",
      location: "Seattle, WA, US",
    });
  });

  it("validates search profile inputs with basic-job filters", () => {
    const parsed = JobSearchProfileInputSchema.parse({
      candidateName: "Maya",
      targetRoles: ["barista"],
      basicJobFilters: {
        partTime: true,
        hourly: true,
        entryLevel: true,
        retail: false,
        admin: false,
        service: true,
        warehouse: false,
        internship: false,
      },
    });

    expect(parsed.remotePreference).toBe("any");
    expect(parsed.employmentType).toBe("any");
    expect(parsed.salaryMin).toBeNull();
    expect(parsed.jobFocus).toBe("both");
    expect(parsed.basicJobFilters.partTime).toBe(true);
  });

  it("normalizes source URLs and rejects non-HTTP protocols", () => {
    expect(
      JobSourceInputSchema.parse({
        profileId: "profile-1",
        label: "Acme careers",
        url: "HTTPS://Careers.Example.COM/jobs/#openings",
      }).url,
    ).toBe("https://careers.example.com/jobs");

    expect(() =>
      JobSourceInputSchema.parse({
        profileId: "profile-1",
        label: "Local file",
        url: "file:///tmp/jobs.html",
      }),
    ).toThrow();
  });
});
