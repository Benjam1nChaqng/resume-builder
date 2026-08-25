import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createJobSourceForUser,
  refreshDisqualifiedListings,
  setJobSourceEnabledForUser,
  upsertDiscoveredListings,
  updateListingStatusForUser,
  updateJobSourceForUser,
} from "./discovery-repo";

const {
  mockLimit,
  mockWhere,
  mockFrom,
  mockInnerJoin,
  mockSelect,
  mockReturning,
  mockOnConflictDoNothing,
  mockValues,
  mockInsert,
  mockSet,
  mockUpdateWhere,
  mockUpdateReturning,
  mockUpdate,
  mockBatch,
  mockDelete,
  mockDeleteWhere,
  mockAssertPublicHttpUrl,
} = vi.hoisted(() => {
  const mockLimit = vi.fn();
  const mockWhere = vi.fn(() => ({ limit: mockLimit }));
  const mockInnerJoin = vi.fn(() => ({ where: mockWhere }));
  const mockFrom = vi.fn(() => ({ where: mockWhere, innerJoin: mockInnerJoin }));
  const mockSelect = vi.fn(() => ({ from: mockFrom }));
  const mockReturning = vi.fn();
  const mockOnConflictDoNothing = vi.fn(() => ({ returning: mockReturning }));
  const mockValues = vi.fn(() => ({ onConflictDoNothing: mockOnConflictDoNothing }));
  const mockInsert = vi.fn(() => ({ values: mockValues }));
  const mockUpdateReturning = vi.fn();
  const mockUpdateWhere = vi.fn(() => ({ returning: mockUpdateReturning }));
  const mockSet = vi.fn(() => ({ where: mockUpdateWhere }));
  const mockUpdate = vi.fn(() => ({ set: mockSet }));
  const mockBatch = vi.fn();
  const mockDeleteWhere = vi.fn();
  const mockDelete = vi.fn(() => ({ where: mockDeleteWhere }));
  const mockAssertPublicHttpUrl = vi.fn();
  return {
    mockLimit,
    mockWhere,
    mockFrom,
    mockInnerJoin,
    mockSelect,
    mockReturning,
    mockOnConflictDoNothing,
    mockValues,
    mockInsert,
    mockSet,
    mockUpdateWhere,
    mockUpdateReturning,
    mockUpdate,
    mockBatch,
    mockDelete,
    mockDeleteWhere,
    mockAssertPublicHttpUrl,
  };
});

vi.mock("@/lib/db", () => ({
  db: {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    batch: mockBatch,
  },
}));

vi.mock("./public-web", () => ({
  assertPublicHttpUrl: mockAssertPublicHttpUrl,
}));

function collectStrings(value: unknown, seen = new WeakSet<object>()): string[] {
  if (typeof value === "string") return [value];
  if (!value || typeof value !== "object" || seen.has(value)) return [];
  seen.add(value);
  return Object.values(value).flatMap((entry) => collectStrings(entry, seen));
}

beforeEach(() => {
  mockLimit.mockReset();
  mockWhere.mockClear();
  mockFrom.mockClear();
  mockInnerJoin.mockClear();
  mockSelect.mockClear();
  mockReturning.mockReset();
  mockOnConflictDoNothing.mockReset();
  mockValues.mockClear();
  mockInsert.mockClear();
  mockSet.mockClear();
  mockUpdateWhere.mockReset();
  mockUpdateWhere.mockImplementation(() => ({ returning: mockUpdateReturning }));
  mockUpdateReturning.mockReset();
  mockUpdate.mockClear();
  mockBatch.mockReset();
  mockDelete.mockClear();
  mockDeleteWhere.mockReset();
  mockDeleteWhere.mockImplementation(() => ({}));
  mockAssertPublicHttpUrl.mockReset();
});

describe("createJobSourceForUser", () => {
  const input = {
    profileId: "profile-1",
    label: "Acme careers",
    url: "https://acme.example/careers",
  };

  it("checks profile ownership before resolving or inserting the source", async () => {
    mockLimit.mockResolvedValueOnce([]);

    await expect(createJobSourceForUser("user-2", input)).rejects.toThrow(
      /profile not found/i,
    );

    expect(mockAssertPublicHttpUrl).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("validates the public URL after ownership and before inserting", async () => {
    mockLimit.mockResolvedValueOnce([{ id: "profile-1" }]);
    mockAssertPublicHttpUrl.mockResolvedValueOnce(new URL(input.url));
    mockReturning.mockResolvedValueOnce([{ id: "source-1" }]);

    await createJobSourceForUser("user-1", input);

    expect(mockAssertPublicHttpUrl).toHaveBeenCalledWith(input.url);
    expect(mockInsert).toHaveBeenCalledOnce();
  });

  it("reports a duplicate profile source instead of returning a phantom id", async () => {
    mockLimit.mockResolvedValueOnce([{ id: "profile-1" }]);
    mockAssertPublicHttpUrl.mockResolvedValueOnce(new URL(input.url));
    mockReturning.mockResolvedValueOnce([]);

    await expect(createJobSourceForUser("user-1", input)).rejects.toThrow(
      /already added/i,
    );
  });
});

describe("setJobSourceEnabledForUser", () => {
  it("rejects a source that is not owned by the current user", async () => {
    mockLimit.mockResolvedValueOnce([]);

    await expect(
      setJobSourceEnabledForUser("user-2", "source-1", false),
    ).rejects.toThrow(/source not found/i);

    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("updateJobSourceForUser", () => {
  const input = {
    label: "Acme jobs",
    url: "https://acme.example/jobs",
  };

  it("checks ownership before validating or updating the URL", async () => {
    mockLimit.mockResolvedValueOnce([]);

    await expect(
      updateJobSourceForUser("user-2", "source-1", input),
    ).rejects.toThrow(/source not found/i);

    expect(mockAssertPublicHttpUrl).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("updates an owned source after public URL validation", async () => {
    mockLimit.mockResolvedValueOnce([{ profileId: "profile-1" }]);
    mockAssertPublicHttpUrl.mockResolvedValueOnce(new URL(input.url));
    mockUpdateWhere.mockReturnValueOnce({ returning: mockUpdateReturning });

    await expect(
      updateJobSourceForUser("user-1", "source-1", input),
    ).resolves.toBe("profile-1");

    expect(mockAssertPublicHttpUrl).toHaveBeenCalledWith(input.url);
    expect(mockSet).toHaveBeenCalledWith(input);
  });

  it("returns a useful duplicate-source error", async () => {
    mockLimit.mockResolvedValueOnce([{ profileId: "profile-1" }]);
    mockAssertPublicHttpUrl.mockResolvedValueOnce(new URL(input.url));
    mockUpdateWhere.mockImplementationOnce(() => {
      throw { code: "23505" };
    });

    await expect(
      updateJobSourceForUser("user-1", "source-1", input),
    ).rejects.toThrow(/already added/i);
  });
});

describe("updateListingStatusForUser", () => {
  it.each([
    ["discovered", "rejected", undefined],
    ["rejected", "discovered", undefined],
    ["discovered", "saved", "job-1"],
  ] as const)(
    "allows the %s to %s transition",
    async (fromStatus, toStatus, jobId) => {
      mockLimit.mockResolvedValueOnce([
        { profileId: "profile-1", status: fromStatus },
      ]);
      mockUpdateReturning.mockResolvedValueOnce([{ id: "listing-1" }]);

      await expect(
        updateListingStatusForUser({
          userId: "user-1",
          listingId: "listing-1",
          status: toStatus,
          ...(jobId ? { jobId } : {}),
        }),
      ).resolves.toBe("profile-1");

      expect(mockSet).toHaveBeenCalledWith({
        status: toStatus,
        ...(jobId ? { jobId } : {}),
      });
    },
  );

  it.each([
    ["saved", "rejected"],
    ["tailored", "discovered"],
    ["applied", "rejected"],
  ] as const)(
    "rejects the %s to %s regression",
    async (fromStatus, toStatus) => {
      mockLimit.mockResolvedValueOnce([
        { profileId: "profile-1", status: fromStatus },
      ]);

      await expect(
        updateListingStatusForUser({
          userId: "user-1",
          listingId: "listing-1",
          status: toStatus,
        }),
      ).rejects.toThrow(`cannot move from ${fromStatus} to ${toStatus}`);
      expect(mockUpdate).not.toHaveBeenCalled();
    },
  );

  it("requires a structured job before moving a listing to saved", async () => {
    mockLimit.mockResolvedValueOnce([
      { profileId: "profile-1", status: "discovered" },
    ]);

    await expect(
      updateListingStatusForUser({
        userId: "user-1",
        listingId: "listing-1",
        status: "saved",
      }),
    ).rejects.toThrow(/must link to a job/i);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("detects a concurrent listing-state change", async () => {
    mockLimit.mockResolvedValueOnce([
      { profileId: "profile-1", status: "discovered" },
    ]);
    mockUpdateReturning.mockResolvedValueOnce([]);

    await expect(
      updateListingStatusForUser({
        userId: "user-1",
        listingId: "listing-1",
        status: "rejected",
      }),
    ).rejects.toThrow(/changed while/i);
  });
});

describe("upsertDiscoveredListings", () => {
  it("reports inserts once and treats a repeated discovery as a duplicate", async () => {
    const listing = {
      canonicalUrl: "https://acme.example/jobs/warehouse-1",
      title: "Warehouse Associate",
      company: "Acme",
      location: "Los Angeles, CA",
    };
    mockReturning
      .mockResolvedValueOnce([{ id: "listing-1" }])
      .mockResolvedValueOnce([]);

    await expect(
      upsertDiscoveredListings({
        profileId: "profile-1",
        sourceId: "source-1",
        listings: [listing],
      }),
    ).resolves.toBe(1);
    await expect(
      upsertDiscoveredListings({
        profileId: "profile-1",
        sourceId: "source-1",
        listings: [listing],
      }),
    ).resolves.toBe(0);

    expect(mockOnConflictDoNothing).toHaveBeenCalledTimes(2);
    expect(mockValues).toHaveBeenNthCalledWith(
      1,
      expect.arrayContaining([
        expect.objectContaining({
          profileId: "profile-1",
          sourceId: "source-1",
          canonicalUrl: listing.canonicalUrl,
          title: listing.title,
          fingerprint: expect.any(String),
        }),
      ]),
    );
  });

  it("refreshes ranking metadata when a known URL is discovered again", async () => {
    mockReturning.mockResolvedValueOnce([]);
    mockBatch.mockResolvedValueOnce([]);

    await expect(
      upsertDiscoveredListings({
        profileId: "profile-1",
        sourceId: null,
        listings: [
          {
            canonicalUrl: "https://remotive.com/jobs/support-1",
            title: "Technical Support Engineer",
            company: "Acme",
            location: "Remote | Full-time",
            employmentType: "full_time",
            compensationText: "$95,000 - $110,000",
            postedAt: new Date("2026-08-20T12:00:00Z"),
            matchScore: 88,
          },
        ],
      }),
    ).resolves.toBe(0);

    expect(mockBatch).toHaveBeenCalledOnce();
    expect(mockSet).toHaveBeenCalledWith({
      fingerprint: expect.anything(),
      title: "Technical Support Engineer",
      company: "Acme",
      location: "Remote | Full-time",
      employmentType: "full_time",
      compensationText: "$95,000 - $110,000",
      postedAt: new Date("2026-08-20T12:00:00Z"),
      matchScore: 88,
    });
  });

  it("clears stale nullable metadata when the current source omits it", async () => {
    mockReturning.mockResolvedValueOnce([]);
    mockBatch.mockResolvedValueOnce([]);

    await upsertDiscoveredListings({
      profileId: "profile-1",
      sourceId: "source-1",
      listings: [
        {
          canonicalUrl: "https://acme.example/jobs/support-1",
          title: "Technical Support Engineer",
          company: null,
          location: null,
          employmentType: null,
          compensationText: null,
          postedAt: null,
          matchScore: 25,
        },
      ],
    });

    expect(mockSet).toHaveBeenCalledWith({
      title: "Technical Support Engineer",
      company: null,
      location: null,
      employmentType: null,
      compensationText: null,
      postedAt: null,
      matchScore: 25,
    });
  });
});

describe("refreshDisqualifiedListings", () => {
  it("refreshes known rows without inserting a new disqualified listing", async () => {
    mockBatch.mockResolvedValueOnce([]);

    await refreshDisqualifiedListings({
      profileId: "profile-1",
      listings: [
        {
          canonicalUrl: "https://acme.example/jobs/under-floor",
          title: "Technical Support Engineer",
          company: "Acme",
          location: "Remote",
          compensationText: "$70,000 per year",
          matchScore: 0,
        },
      ],
    });

    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockDelete).toHaveBeenCalledOnce();
    expect(collectStrings(mockDeleteWhere.mock.calls[0]?.[0]).join(" ")).toContain(
      "not exists (select 1 from \"job_pipeline_event\"",
    );
    expect(mockBatch).toHaveBeenCalledOnce();
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        fingerprint: expect.anything(),
        compensationText: "$70,000 per year",
        matchScore: 0,
      }),
    );
    expect(mockSet).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: expect.anything() }),
    );
  });
});
