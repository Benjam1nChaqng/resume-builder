import { describe, expect, it, vi } from "vitest";
import {
  buildTailoredBulletReplacements,
  buildTailoredResumeTitle,
} from "./tailored-resume";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("./access", () => ({ requireJobAccess: vi.fn() }));
vi.mock("@/lib/resumes/access", () => ({ requireResumeAccess: vi.fn() }));
vi.mock("@/lib/resumes/render", () => ({ loadRenderableResume: vi.fn() }));

describe("buildTailoredResumeTitle", () => {
  it("uses the base resume plus company and role for job-specific copies", () => {
    expect(
      buildTailoredResumeTitle({
        baseTitle: "Maya Resume",
        company: "Acme",
        role: "Office Assistant",
      }),
    ).toBe("Maya Resume - Acme Office Assistant");
  });
});

describe("buildTailoredBulletReplacements", () => {
  const experiences = [
    {
      id: "exp-1",
      bullets: [{ id: "bullet-1" }, { id: "bullet-2" }],
    },
  ];

  it("maps only accepted changes without mutating the source structure", () => {
    const before = structuredClone(experiences);
    const replacements = buildTailoredBulletReplacements(experiences, [
      {
        experienceId: "exp-1",
        bulletId: "bullet-2",
        text: "Tailored second bullet",
      },
    ]);

    expect([...replacements]).toEqual([
      ["bullet-2", "Tailored second bullet"],
    ]);
    expect(experiences).toEqual(before);
    expect(replacements.has("bullet-1")).toBe(false);
  });

  it("rejects bullets outside the selected source resume", () => {
    expect(() =>
      buildTailoredBulletReplacements(experiences, [
        {
          experienceId: "exp-other",
          bulletId: "bullet-1",
          text: "Tampered replacement",
        },
      ]),
    ).toThrow(/does not belong/);
  });

  it("rejects duplicate bullet changes", () => {
    expect(() =>
      buildTailoredBulletReplacements(experiences, [
        {
          experienceId: "exp-1",
          bulletId: "bullet-1",
          text: "First replacement",
        },
        {
          experienceId: "exp-1",
          bulletId: "bullet-1",
          text: "Second replacement",
        },
      ]),
    ).toThrow(/more than once/);
  });
});
