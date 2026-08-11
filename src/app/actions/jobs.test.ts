import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSession = vi.fn();
const mockCreateJobForUser = vi.fn();
const mockTailorResumeForJob = vi.fn();
const mockSaveDiscoveredListing = vi.fn();
const mockCreateTailoredResumeCopy = vi.fn();
const mockMarkJobApplied = vi.fn();
const mockUpdateJobSource = vi.fn();
const mockCreateJobSearchProfile = vi.fn();
const mockCreateJobSource = vi.fn();
const mockJobSearchProfileSafeParse = vi.fn();
const mockJobSourceSafeParse = vi.fn();
const mockJobSourceUpdateSafeParse = vi.fn();
const mockRunResumeJobFit = vi.fn();
const mockRequireProfileOwner = vi.fn();
const mockCookieSet = vi.fn();
const mockCookieGet = vi.fn();
const mockCookieDelete = vi.fn();
const mockRedirect = vi.fn((url: string) => {
  const err = new Error(`REDIRECT:${url}`);
  // Tag like Next.js redirect throws (the test only needs to verify the redirect path).
  throw err;
});

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({
    set: mockCookieSet,
    get: mockCookieGet,
    delete: mockCookieDelete,
  }),
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

vi.mock("@/lib/jobs/application-state", () => ({
  markJobApplied: mockMarkJobApplied,
}));

vi.mock("@/lib/jobs/discovery", () => ({
  JobSearchProfileInputSchema: {
    parse: vi.fn((value) => value),
    safeParse: mockJobSearchProfileSafeParse,
  },
  JobSourceInputSchema: { safeParse: mockJobSourceSafeParse },
  JobSourceUpdateSchema: { safeParse: mockJobSourceUpdateSafeParse },
}));

vi.mock("@/lib/jobs/discovery-repo", () => ({
  createJobSearchProfile: mockCreateJobSearchProfile,
  createJobSourceForUser: mockCreateJobSource,
  deleteJobSearchProfileForUser: vi.fn(),
  deleteJobSourceForUser: vi.fn(),
  setJobSourceEnabledForUser: vi.fn(),
  updateJobSearchProfileForUser: vi.fn(),
  updateJobSourceForUser: mockUpdateJobSource,
  updateListingStatusForUser: vi.fn(),
  requireProfileOwner: mockRequireProfileOwner,
}));

vi.mock("@/lib/jobs/fit", () => ({
  FIT_CHECK_FAILURE_MESSAGE: "Fit check failed safely.",
  runResumeJobFit: mockRunResumeJobFit,
}));

vi.mock("@/lib/jobs/run-discovery", () => ({
  runJobDiscovery: vi.fn(),
}));

vi.mock("@/lib/jobs/save-listing", () => ({
  saveDiscoveredListingForUser: mockSaveDiscoveredListing,
}));

vi.mock("@/lib/jobs/tailored-resume", () => ({
  createTailoredResumeCopy: mockCreateTailoredResumeCopy,
}));

beforeEach(() => {
  mockGetSession.mockReset();
  mockCreateJobForUser.mockReset();
  mockTailorResumeForJob.mockReset();
  mockSaveDiscoveredListing.mockReset();
  mockCreateTailoredResumeCopy.mockReset();
  mockMarkJobApplied.mockReset();
  mockUpdateJobSource.mockReset();
  mockCreateJobSearchProfile.mockReset();
  mockCreateJobSource.mockReset();
  mockJobSearchProfileSafeParse.mockReset();
  mockJobSourceSafeParse.mockReset();
  mockJobSourceUpdateSafeParse.mockReset();
  mockRunResumeJobFit.mockReset();
  mockRequireProfileOwner.mockReset();
  mockCookieSet.mockReset();
  mockCookieGet.mockReset();
  mockCookieDelete.mockReset();
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

const initialDiscoveryFormState = {
  fieldErrors: {},
  formError: null,
};

describe("createJobSearchProfileAction", () => {
  it("returns field errors without writing an invalid profile", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });
    mockJobSearchProfileSafeParse.mockReturnValueOnce({
      success: false,
      error: {
        flatten: () => ({ fieldErrors: { targetRoles: ["Choose a role"] } }),
      },
    });
    const formData = new FormData();
    formData.set("candidateName", "Maya");
    formData.set("targetRoles", "");
    formData.set("warehouse", "on");

    const { createJobSearchProfileAction } = await import("./jobs");
    await expect(
      createJobSearchProfileAction(initialDiscoveryFormState, formData),
    ).resolves.toMatchObject({
      fieldErrors: { targetRoles: ["Choose a role"] },
      formError: null,
      values: {
        candidateName: "Maya",
        targetRoles: "",
        warehouse: "on",
      },
    });
    expect(mockCreateJobSearchProfile).not.toHaveBeenCalled();
  });

  it("creates an owned profile and redirects to it", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });
    const input = {
      candidateName: "Maya",
      targetRoles: ["Barista"],
      remotePreference: "any",
    };
    mockJobSearchProfileSafeParse.mockReturnValueOnce({
      success: true,
      data: input,
    });
    mockCreateJobSearchProfile.mockResolvedValueOnce("profile-1");

    const { createJobSearchProfileAction } = await import("./jobs");
    await expect(
      createJobSearchProfileAction(initialDiscoveryFormState, new FormData()),
    ).rejects.toThrow(/REDIRECT:\/jobs\/discover\?profile=profile-1/);
    expect(mockCreateJobSearchProfile).toHaveBeenCalledWith("user-1", input);
    expect(mockCookieSet).toHaveBeenCalledWith(
      "selected-job-search-profile",
      "user-1:profile-1",
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" }),
    );
  });
});

describe("selectJobSearchProfileAction", () => {
  it("persists an owned selection before redirecting", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });
    mockRequireProfileOwner.mockResolvedValueOnce(undefined);

    const { selectJobSearchProfileAction } = await import("./jobs");
    await expect(
      selectJobSearchProfileAction("profile-2"),
    ).rejects.toThrow(/REDIRECT:\/jobs\/discover\?profile=profile-2/);

    expect(mockRequireProfileOwner).toHaveBeenCalledWith("profile-2", "user-1");
    expect(mockCookieSet).toHaveBeenCalledWith(
      "selected-job-search-profile",
      "user-1:profile-2",
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it("does not persist a profile the user does not own", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });
    mockRequireProfileOwner.mockRejectedValueOnce(
      new Error("Job search profile not found."),
    );

    const { selectJobSearchProfileAction } = await import("./jobs");
    await expect(
      selectJobSearchProfileAction("profile-foreign"),
    ).rejects.toThrow(/not found/);
    expect(mockCookieSet).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});

describe("createJobSourceAction", () => {
  it("returns URL validation errors without writing a source", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });
    mockJobSourceSafeParse.mockReturnValueOnce({
      success: false,
      error: {
        flatten: () => ({ fieldErrors: { url: ["Enter a valid URL"] } }),
      },
    });

    const formData = new FormData();
    formData.set("label", "Acme");
    formData.set("url", "not-a-url");
    const { createJobSourceAction } = await import("./jobs");
    await expect(
      createJobSourceAction(initialDiscoveryFormState, formData),
    ).resolves.toMatchObject({
      fieldErrors: { url: ["Enter a valid URL"] },
      formError: null,
      values: { label: "Acme", url: "not-a-url" },
    });
    expect(mockCreateJobSource).not.toHaveBeenCalled();
  });

  it("surfaces duplicate sources without leaking a database error", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });
    const input = {
      profileId: "profile-1",
      label: "Acme",
      url: "https://acme.example/jobs",
    };
    mockJobSourceSafeParse.mockReturnValueOnce({ success: true, data: input });
    mockCreateJobSource.mockRejectedValueOnce(
      new Error("This source is already added to the profile."),
    );

    const { createJobSourceAction } = await import("./jobs");
    await expect(
      createJobSourceAction(initialDiscoveryFormState, new FormData()),
    ).resolves.toMatchObject({
      fieldErrors: {},
      formError: "This source is already added to the profile.",
    });
  });

  it("puts blocked-network feedback on the URL field", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });
    mockJobSourceSafeParse.mockReturnValueOnce({
      success: true,
      data: {
        profileId: "profile-1",
        label: "Unsafe",
        url: "http://localhost/jobs",
      },
    });
    mockCreateJobSource.mockRejectedValueOnce(
      new Error("Private or local network URLs are not allowed."),
    );

    const { createJobSourceAction } = await import("./jobs");
    await expect(
      createJobSourceAction(initialDiscoveryFormState, new FormData()),
    ).resolves.toMatchObject({
      fieldErrors: {
        url: ["Private or local network URLs are not allowed."],
      },
      formError: null,
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

describe("createTailoredResumeCopyAction", () => {
  it("passes only the accepted bullet changes to copy creation", async () => {
    const acceptedChanges = [
      {
        experienceId: "exp-1",
        bulletId: "bullet-1",
        text: "Tailored evidence-backed bullet",
      },
    ];
    mockCreateTailoredResumeCopy.mockResolvedValueOnce("resume-tailored");

    const { createTailoredResumeCopyAction } = await import("./jobs");
    await expect(
      createTailoredResumeCopyAction("job-1", "resume-1", acceptedChanges),
    ).resolves.toBe("resume-tailored");
    expect(mockCreateTailoredResumeCopy).toHaveBeenCalledWith({
      jobId: "job-1",
      resumeId: "resume-1",
      acceptedChanges,
    });
  });
});

describe("markJobAppliedAction", () => {
  it("updates application state before returning to the job", async () => {
    mockMarkJobApplied.mockResolvedValueOnce(undefined);

    const { markJobAppliedAction } = await import("./jobs");
    await expect(markJobAppliedAction("job-1")).rejects.toThrow(
      /REDIRECT:\/job\/job-1/,
    );
    expect(mockMarkJobApplied).toHaveBeenCalledWith({ jobId: "job-1" });
  });
});

describe("updateJobSourceAction", () => {
  it("validates and updates an owned source without exposing FormData internals", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });
    mockJobSourceUpdateSafeParse.mockReturnValueOnce({
      success: true,
      data: { label: "Acme", url: "https://acme.example/jobs" },
    });
    mockUpdateJobSource.mockResolvedValueOnce("profile-1");

    const { updateJobSourceAction } = await import("./jobs");
    await expect(
      updateJobSourceAction(
        "source-1",
        "Acme",
        "https://acme.example/jobs",
      ),
    ).resolves.toEqual({ ok: true });
    expect(mockUpdateJobSource).toHaveBeenCalledWith("user-1", "source-1", {
      label: "Acme",
      url: "https://acme.example/jobs",
    });
  });

  it("returns validation feedback without reaching the repository", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });
    mockJobSourceUpdateSafeParse.mockReturnValueOnce({
      success: false,
      error: { issues: [{ message: "Invalid URL" }] },
    });

    const { updateJobSourceAction } = await import("./jobs");
    await expect(
      updateJobSourceAction("source-1", "Acme", "not-a-url"),
    ).resolves.toEqual({ ok: false, error: "Invalid URL" });
    expect(mockUpdateJobSource).not.toHaveBeenCalled();
  });
});

describe("runResumeJobFitAction", () => {
  it("redirects back to the selected resume after a persisted model failure", async () => {
    mockRunResumeJobFit.mockRejectedValueOnce(
      new Error("Fit check failed safely."),
    );

    const { runResumeJobFitAction } = await import("./jobs");
    await expect(
      runResumeJobFitAction("job-1", "resume-1"),
    ).rejects.toThrow(/REDIRECT:\/job\/job-1\?resume=resume-1/);
  });

  it("does not hide unexpected persistence failures", async () => {
    mockRunResumeJobFit.mockRejectedValueOnce(new Error("database unavailable"));

    const { runResumeJobFitAction } = await import("./jobs");
    await expect(
      runResumeJobFitAction("job-1", "resume-1"),
    ).rejects.toThrow(/database unavailable/);
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
