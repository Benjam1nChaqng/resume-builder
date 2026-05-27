import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("./access", () => ({ requireJobAccess: vi.fn() }));
vi.mock("./tailor", () => ({ tailorResumeForJob: vi.fn() }));
vi.mock("@/lib/resumes/render", () => ({ loadRenderableResume: vi.fn() }));

describe("buildTailoredResumeTitle", () => {
  it("uses the base resume plus company and role for job-specific copies", async () => {
    const { buildTailoredResumeTitle } = await import("./tailored-resume");
    expect(
      buildTailoredResumeTitle({
        baseTitle: "Maya Resume",
        company: "Acme",
        role: "Office Assistant",
      }),
    ).toBe("Maya Resume - Acme Office Assistant");
  });
});
