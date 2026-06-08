import { describe, expect, it } from "vitest";
import type { SearchCriteria } from "./discovery";
import { buildAllSearchLinks, buildSearchLinks } from "./search-links";

const base: SearchCriteria = {
  roles: ["barista", "cashier"],
  location: "Oakland, CA",
  employmentType: "any",
  salaryMin: null,
  jobFocus: "both",
};

describe("buildAllSearchLinks", () => {
  it("creates a valid, location-aware URL for every site", () => {
    const links = buildAllSearchLinks(base);
    expect(links.map((l) => l.id).sort()).toEqual([
      "google",
      "indeed",
      "linkedin",
      "snagajob",
      "ziprecruiter",
    ]);
    for (const link of links) {
      const url = new URL(link.url); // throws if malformed
      expect(url.protocol).toBe("https:");
      expect(decodeURIComponent(url.search)).toContain("barista");
    }
  });

  it("encodes the location into each search", () => {
    const indeed = buildAllSearchLinks(base).find((l) => l.id === "indeed")!;
    expect(new URL(indeed.url).searchParams.get("l")).toBe("Oakland, CA");
  });

  it("maps full-time to the right per-site param", () => {
    const links = buildAllSearchLinks({ ...base, employmentType: "full_time" });
    const indeed = new URL(links.find((l) => l.id === "indeed")!.url);
    const linkedin = new URL(links.find((l) => l.id === "linkedin")!.url);
    expect(indeed.searchParams.get("sc")).toContain("fulltime");
    expect(linkedin.searchParams.get("f_JT")).toBe("F");
  });

  it("folds a salary floor into the query text", () => {
    const indeed = buildAllSearchLinks({ ...base, salaryMin: 60000 }).find(
      (l) => l.id === "indeed",
    )!;
    expect(new URL(indeed.url).searchParams.get("q")).toContain("$60,000");
  });

  it("does not break when location is missing", () => {
    const links = buildAllSearchLinks({ ...base, location: null });
    for (const link of links) {
      expect(() => new URL(link.url)).not.toThrow();
    }
    const indeed = buildAllSearchLinks({ ...base, location: null }).find(
      (l) => l.id === "indeed",
    )!;
    expect(new URL(indeed.url).searchParams.get("l")).toBeNull();
  });
});

describe("buildSearchLinks (focus filtering)", () => {
  it("local focus drops professional-only sites but keeps Snagajob", () => {
    const ids = buildSearchLinks({ ...base, jobFocus: "local" }).map((l) => l.id);
    expect(ids).toContain("snagajob");
    expect(ids).not.toContain("linkedin");
  });

  it("professional focus drops local-only sites but keeps LinkedIn", () => {
    const ids = buildSearchLinks({ ...base, jobFocus: "professional" }).map(
      (l) => l.id,
    );
    expect(ids).toContain("linkedin");
    expect(ids).not.toContain("snagajob");
  });

  it("both focus keeps every site", () => {
    expect(buildSearchLinks({ ...base, jobFocus: "both" })).toHaveLength(5);
  });
});
