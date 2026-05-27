import { describe, expect, it } from "vitest";
import {
  JobSearchProfileInputSchema,
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
    expect(parsed.basicJobFilters.partTime).toBe(true);
  });
});

