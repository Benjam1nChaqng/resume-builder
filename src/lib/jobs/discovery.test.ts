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

  it("validates search profile inputs and applies sensible defaults", () => {
    const parsed = JobSearchProfileInputSchema.parse({
      candidateName: "Maya",
      targetRoles: ["barista"],
      employmentType: "part_time",
      salaryMin: 45000,
      jobFocus: "local",
    });

    expect(parsed.employmentType).toBe("part_time");
    expect(parsed.salaryMin).toBe(45000);
    expect(parsed.jobFocus).toBe("local");
  });

  it("defaults employment type, salary, and focus when omitted", () => {
    const parsed = JobSearchProfileInputSchema.parse({
      candidateName: "Maya",
      targetRoles: ["barista"],
    });

    expect(parsed.employmentType).toBe("any");
    expect(parsed.salaryMin).toBeNull();
    expect(parsed.jobFocus).toBe("both");
  });
});

