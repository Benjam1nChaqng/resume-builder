import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { parseJobListingsFromHtml } from "./discovery";
import { discoverListingsFromSource } from "./source-adapters";

async function jsonFixture(name: string): Promise<unknown> {
  const text = await readFile(
    new URL(`./fixtures/${name}`, import.meta.url),
    "utf8",
  );
  return JSON.parse(text);
}

async function htmlFixture(name: string): Promise<string> {
  return readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
}

describe("fixture-backed job discovery", () => {
  it("parses representative Greenhouse data", async () => {
    const data = await jsonFixture("greenhouse-jobs.json");
    const listings = await discoverListingsFromSource(
      "https://boards.greenhouse.io/acme",
      { fetchJson: vi.fn().mockResolvedValue({ data, finalUrl: "fixture" }) },
    );

    expect(listings).toHaveLength(2);
    expect(listings[0]).toMatchObject({
      canonicalUrl: "https://job-boards.greenhouse.io/acme/jobs/123",
      title: "Customer Support Associate",
      location: "Remote - US",
      postedAt: new Date("2026-08-01T12:00:00.000Z"),
    });
  });

  it("parses representative Lever data", async () => {
    const data = await jsonFixture("lever-jobs.json");
    const listings = await discoverListingsFromSource(
      "https://jobs.lever.co/acme",
      { fetchJson: vi.fn().mockResolvedValue({ data, finalUrl: "fixture" }) },
    );

    expect(listings).toHaveLength(2);
    expect(listings[0]).toMatchObject({
      canonicalUrl: "https://jobs.lever.co/acme/abc",
      location: "Remote - United States",
      employmentType: "Full-time",
    });
  });

  it("parses listed Ashby data and excludes hidden roles", async () => {
    const data = await jsonFixture("ashby-jobs.json");
    const listings = await discoverListingsFromSource(
      "https://jobs.ashbyhq.com/Acme",
      { fetchJson: vi.fn().mockResolvedValue({ data, finalUrl: "fixture" }) },
    );

    expect(listings).toHaveLength(1);
    expect(listings[0]).toMatchObject({
      canonicalUrl: "https://jobs.ashbyhq.com/Acme/abc",
      title: "Customer Experience Associate",
      compensationText: "$50K - $60K",
    });
  });

  it("parses representative Workday search data", async () => {
    const data = await jsonFixture("workday-jobs.json");
    const listings = await discoverListingsFromSource(
      "https://workday.wd5.myworkdayjobs.com/en-US/Workday",
      { postJson: vi.fn().mockResolvedValue({ data, finalUrl: "fixture" }) },
    );

    expect(listings).toHaveLength(2);
    expect(listings[0]).toMatchObject({
      canonicalUrl:
        "https://workday.wd5.myworkdayjobs.com/en-US/Workday/job/USAVAReston/Customer-Support-Analyst_JR-0100001",
      title: "Customer Support Analyst",
      location: "Remote - Reston, VA",
      postedAt: new Date("2026-08-01T12:00:00.000Z"),
    });
    expect(listings[1]?.postedAt).toBeNull();
  });

  it("prefers JSON-LD metadata and deduplicates HTML fallback links", async () => {
    const html = await htmlFixture("career-page.html");
    const listings = parseJobListingsFromHtml(
      html,
      "https://careers.example.com/jobs",
    );

    expect(listings).toHaveLength(2);
    expect(listings[0]).toMatchObject({
      title: "Office Assistant",
      company: "Acme Services",
      location: "Los Angeles, CA, US",
      canonicalUrl: "https://careers.example.com/careers/office-assistant",
    });
  });

  it("returns safely when HTML metadata and anchors are malformed", async () => {
    const html = await htmlFixture("malformed-career-page.html");

    expect(() =>
      parseJobListingsFromHtml(html, "https://careers.example.com/jobs"),
    ).not.toThrow();
    expect(
      parseJobListingsFromHtml(html, "https://careers.example.com/jobs"),
    ).toEqual([]);
  });
});
