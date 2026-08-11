import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

describe("buildResumePdfFilename", () => {
  it("uses candidate, company, and role for a tailored resume", async () => {
    const { buildResumePdfFilename } = await import("./export");

    expect(
      buildResumePdfFilename({
        candidateName: "Jordan Lee",
        resumeTitle: "Base Resume",
        jobContext: { company: "Acme & Co.", role: "Product Engineer" },
      }),
    ).toBe("Jordan-Lee-Acme-Co-Product-Engineer.pdf");
  });

  it("falls back to a safe generic filename", async () => {
    const { buildResumePdfFilename } = await import("./export");

    expect(
      buildResumePdfFilename({
        candidateName: null,
        resumeTitle: "!!!",
        jobContext: null,
      }),
    ).toBe("resume.pdf");
  });
});
