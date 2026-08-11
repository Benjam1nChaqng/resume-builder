import { describe, expect, it } from "vitest";
import {
  createJobListingView,
  parseJobListingSort,
} from "./listing-view";

const listings = [
  {
    id: "3",
    status: "saved",
    matchScore: 70,
    discoveredAt: new Date("2026-08-03T00:00:00Z"),
    company: "Zenith",
    title: "Barista",
  },
  {
    id: "1",
    status: "discovered",
    matchScore: 90,
    discoveredAt: new Date("2026-08-01T00:00:00Z"),
    company: "Beta",
    title: "Warehouse Associate",
  },
  {
    id: "2",
    status: "discovered",
    matchScore: 90,
    discoveredAt: new Date("2026-08-02T00:00:00Z"),
    company: "Acme",
    title: "Office Assistant",
  },
] as const;

describe("parseJobListingSort", () => {
  it("accepts supported sorts and defaults unknown values", () => {
    expect(parseJobListingSort("newest")).toBe("newest");
    expect(parseJobListingSort("company")).toBe("company");
    expect(parseJobListingSort("score-desc")).toBe("relevance");
    expect(parseJobListingSort(undefined)).toBe("relevance");
  });
});

describe("createJobListingView", () => {
  it("filters status and breaks relevance ties by newest", () => {
    const view = createJobListingView(listings, {
      status: "discovered",
      sort: "relevance",
      page: 1,
    });

    expect(view.items.map((listing) => listing.id)).toEqual(["2", "1"]);
    expect(view.total).toBe(2);
  });

  it("supports newest and company ordering without mutating input", () => {
    const originalIds = listings.map((listing) => listing.id);
    const newest = createJobListingView(listings, {
      status: "all",
      sort: "newest",
      page: 1,
    });
    const company = createJobListingView(listings, {
      status: "all",
      sort: "company",
      page: 1,
    });

    expect(newest.items.map((listing) => listing.id)).toEqual(["3", "2", "1"]);
    expect(company.items.map((listing) => listing.id)).toEqual(["2", "1", "3"]);
    expect(listings.map((listing) => listing.id)).toEqual(originalIds);
  });

  it("paginates, clamps out-of-range pages, and reports display bounds", () => {
    const manyListings = Array.from({ length: 45 }, (_, index) => ({
      id: String(index),
      status: "discovered",
      matchScore: 100 - index,
      discoveredAt: new Date(2026, 0, index + 1),
      company: "Acme",
      title: `Role ${index}`,
    }));

    const middle = createJobListingView(manyListings, {
      status: "all",
      sort: "relevance",
      page: 2,
      pageSize: 20,
    });
    const clamped = createJobListingView(manyListings, {
      status: "all",
      sort: "relevance",
      page: 99,
      pageSize: 20,
    });

    expect(middle).toMatchObject({
      total: 45,
      page: 2,
      pageCount: 3,
      rangeStart: 21,
      rangeEnd: 40,
      hasPrevious: true,
      hasNext: true,
    });
    expect(middle.items).toHaveLength(20);
    expect(clamped).toMatchObject({
      page: 3,
      rangeStart: 41,
      rangeEnd: 45,
      hasPrevious: true,
      hasNext: false,
    });
  });

  it("returns a stable empty view", () => {
    expect(
      createJobListingView([], {
        status: "all",
        sort: "relevance",
        page: Number.NaN,
      }),
    ).toMatchObject({
      items: [],
      total: 0,
      page: 1,
      pageCount: 1,
      rangeStart: 0,
      rangeEnd: 0,
      hasPrevious: false,
      hasNext: false,
    });
  });
});
