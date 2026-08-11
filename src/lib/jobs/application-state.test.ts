import { describe, expect, it, vi } from "vitest";

const mockRequireJobAccess = vi.fn();

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("./access", () => ({ requireJobAccess: mockRequireJobAccess }));

describe("markJobApplied", () => {
  it("does not read or mutate application data before authorization", async () => {
    mockRequireJobAccess.mockRejectedValueOnce(new Error("Forbidden"));

    const { markJobApplied } = await import("./application-state");
    await expect(markJobApplied({ jobId: "job-foreign" })).rejects.toThrow(
      /Forbidden/,
    );
  });
});
