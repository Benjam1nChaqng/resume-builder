import { describe, expect, it, vi } from "vitest";
import { buildResumePdfFilename } from "./export";

vi.mock("@/lib/db", () => ({ db: {} }));

describe("buildResumePdfFilename", () => {
  it("uses candidate, company, and role for a tailored resume", () => {
    expect(
      buildResumePdfFilename({
        candidateName: "Jordan Lee",
        resumeTitle: "Base Resume",
        jobContext: { company: "Acme & Co.", role: "Product Engineer" },
      }),
    ).toBe("Jordan-Lee-Acme-Co-Product-Engineer.pdf");
  });

  it("falls back to a safe generic filename", () => {
    expect(
      buildResumePdfFilename({
        candidateName: null,
        resumeTitle: "!!!",
        jobContext: null,
      }),
    ).toBe("resume.pdf");
  });
});
