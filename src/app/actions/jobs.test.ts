import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSession = vi.fn();
const mockCreateJobForUser = vi.fn();
const mockTailorResumeForJob = vi.fn();
const mockSaveDiscoveredListing = vi.fn();
const mockRedirect = vi.fn((url: string) => {
  const err = new Error(`REDIRECT:${url}`);
  // Tag like Next.js redirect throws (the test only needs to verify the redirect path).
  throw err;
});

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mockGetSession } },
}));

vi.mock("@/lib/jobs/create", () => ({
  createJobForUser: mockCreateJobForUser,
}));

vi.mock("@/lib/jobs/tailor", () => ({
  tailorResumeForJob: mockTailorResumeForJob,
}));

vi.mock("@/lib/jobs/discovery", () => ({
  JobSearchProfileInputSchema: { parse: vi.fn((value) => value) },
  JobSourceInputSchema: { parse: vi.fn((value) => value) },
}));

vi.mock("@/lib/jobs/discovery-repo", () => ({
  createJobSearchProfile: vi.fn(),
  createJobSourceForUser: vi.fn(),
  updateListingStatusForUser: vi.fn(),
}));

vi.mock("@/lib/jobs/fit", () => ({
  runResumeJobFit: vi.fn(),
}));

vi.mock("@/lib/jobs/run-discovery", () => ({
  runJobDiscovery: vi.fn(),
}));

vi.mock("@/lib/jobs/save-listing", () => ({
  saveDiscoveredListingForUser: mockSaveDiscoveredListing,
}));

vi.mock("@/lib/jobs/tailored-resume", () => ({
  createTailoredResumeCopy: vi.fn(),
}));

beforeEach(() => {
  mockGetSession.mockReset();
  mockCreateJobForUser.mockReset();
  mockTailorResumeForJob.mockReset();
  mockSaveDiscoveredListing.mockReset();
  mockRedirect.mockClear();
});

describe("createJobFromUrlAction", () => {
  it("redirects to /sign-in when there is no session", async () => {
    mockGetSession.mockResolvedValueOnce(null);

    const { createJobFromUrlAction } = await import("./jobs");
    const fd = new FormData();
    fd.set("url", "https://example.com/jobs/1");

    await expect(createJobFromUrlAction(fd)).rejects.toThrow(
      /REDIRECT:\/sign-in/,
    );
    expect(mockCreateJobForUser).not.toHaveBeenCalled();
  });

  it("throws when url is missing from FormData", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });

    const { createJobFromUrlAction } = await import("./jobs");
    const fd = new FormData();

    await expect(createJobFromUrlAction(fd)).rejects.toThrow(/url/i);
    expect(mockCreateJobForUser).not.toHaveBeenCalled();
  });

  it("scrapes + persists + redirects to /job/[id] on the happy path", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });
    mockCreateJobForUser.mockResolvedValueOnce("job-abc");

    const { createJobFromUrlAction } = await import("./jobs");
    const fd = new FormData();
    fd.set("url", "https://example.com/jobs/1");

    await expect(createJobFromUrlAction(fd)).rejects.toThrow(
      /REDIRECT:\/job\/job-abc/,
    );
    expect(mockCreateJobForUser).toHaveBeenCalledWith({
      userId: "user-1",
      url: "https://example.com/jobs/1",
    });
  });
});

describe("tailorResumeForJobAction", () => {
  it("delegates to tailorResumeForJob and returns its result", async () => {
    const fakeResult = { job: {}, experiences: [] } as unknown;
    mockTailorResumeForJob.mockResolvedValueOnce(fakeResult);

    const { tailorResumeForJobAction } = await import("./jobs");
    const result = await tailorResumeForJobAction("job-1", "resume-1");

    expect(result).toBe(fakeResult);
    expect(mockTailorResumeForJob).toHaveBeenCalledWith({
      jobId: "job-1",
      resumeId: "resume-1",
    });
  });
});

describe("saveDiscoveredListingAction", () => {
  it("saves by owned listing id without accepting a browser-supplied URL", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });
    mockSaveDiscoveredListing.mockResolvedValueOnce("job-1");

    const { saveDiscoveredListingAction } = await import("./jobs");
    await expect(saveDiscoveredListingAction("listing-1")).rejects.toThrow(
      /REDIRECT:\/job\/job-1/,
    );

    expect(mockSaveDiscoveredListing).toHaveBeenCalledWith({
      userId: "user-1",
      listingId: "listing-1",
    });
  });
});
