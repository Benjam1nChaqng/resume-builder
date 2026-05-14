import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSession = vi.fn();
const mockLoadOwner = vi.fn();

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: { getSession: mockGetSession },
  },
}));

vi.mock("./owner", () => ({
  loadResumeOwner: mockLoadOwner,
}));

beforeEach(() => {
  mockGetSession.mockReset();
  mockLoadOwner.mockReset();
});

describe("requireResumeAccess", () => {
  it("throws UnauthorizedError when there is no session", async () => {
    mockGetSession.mockResolvedValueOnce(null);

    const { requireResumeAccess, UnauthorizedError } = await import("./access");
    await expect(requireResumeAccess("resume-1")).rejects.toBeInstanceOf(UnauthorizedError);
    expect(mockLoadOwner).not.toHaveBeenCalled();
  });

  it("throws ForbiddenError when the resume doesn't exist", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });
    mockLoadOwner.mockResolvedValueOnce(null);

    const { requireResumeAccess, ForbiddenError } = await import("./access");
    await expect(requireResumeAccess("resume-1")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("throws ForbiddenError when the resume belongs to another user", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });
    mockLoadOwner.mockResolvedValueOnce("user-2");

    const { requireResumeAccess, ForbiddenError } = await import("./access");
    await expect(requireResumeAccess("resume-1")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("returns the userId when session owns the resume", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });
    mockLoadOwner.mockResolvedValueOnce("user-1");

    const { requireResumeAccess } = await import("./access");
    const result = await requireResumeAccess("resume-1");
    expect(result).toEqual({ userId: "user-1" });
  });
});
