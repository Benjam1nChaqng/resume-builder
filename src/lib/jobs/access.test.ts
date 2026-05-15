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
  loadJobOwner: mockLoadOwner,
}));

beforeEach(() => {
  mockGetSession.mockReset();
  mockLoadOwner.mockReset();
});

describe("requireJobAccess", () => {
  it("throws UnauthorizedError when there is no session", async () => {
    mockGetSession.mockResolvedValueOnce(null);

    const { requireJobAccess, UnauthorizedError } = await import("./access");
    await expect(requireJobAccess("job-1")).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    expect(mockLoadOwner).not.toHaveBeenCalled();
  });

  it("throws ForbiddenError when the job doesn't exist", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });
    mockLoadOwner.mockResolvedValueOnce(null);

    const { requireJobAccess, ForbiddenError } = await import("./access");
    await expect(requireJobAccess("job-1")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("throws ForbiddenError when the job belongs to another user", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });
    mockLoadOwner.mockResolvedValueOnce("user-2");

    const { requireJobAccess, ForbiddenError } = await import("./access");
    await expect(requireJobAccess("job-1")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("returns the userId when session owns the job", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });
    mockLoadOwner.mockResolvedValueOnce("user-1");

    const { requireJobAccess } = await import("./access");
    const result = await requireJobAccess("job-1");
    expect(result).toEqual({ userId: "user-1" });
  });
});
