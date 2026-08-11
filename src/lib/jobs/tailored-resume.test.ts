import { describe, expect, it, vi } from "vitest";
import {
  buildTailoredBulletCopies,
  buildTailoredBulletReplacements,
  buildTailoredResumeRows,
  buildTailoredResumeTitle,
  executeTailoredWriteBatch,
} from "./tailored-resume";
import type { RenderableResume } from "@/lib/resumes/render";

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

describe("buildTailoredBulletCopies", () => {
  it("copies every source bullet, changes only accepted text, and preserves provenance", () => {
    const sourceBullets = [
      { id: "b-1", text: "Original one", originalText: null },
      { id: "b-2", text: "Current two", originalText: "Original two" },
    ];
    const before = structuredClone(sourceBullets);
    let id = 0;

    const copies = buildTailoredBulletCopies({
      sourceBullets,
      replacements: new Map([["b-2", "Accepted rewrite"]]),
      experienceId: "new-exp",
      idFactory: () => `new-b-${++id}`,
    });

    expect(copies).toEqual([
      {
        id: "new-b-1",
        experienceId: "new-exp",
        text: "Original one",
        originalText: "Original one",
        sortOrder: 0,
      },
      {
        id: "new-b-2",
        experienceId: "new-exp",
        text: "Accepted rewrite",
        originalText: "Original two",
        sortOrder: 1,
      },
    ]);
    expect(sourceBullets).toEqual(before);
  });
});

describe("buildTailoredResumeRows", () => {
  it("copies every section, changes only accepted text, and leaves the source untouched", () => {
    const source = {
      id: "resume-source",
      userId: "user-1",
      title: "Maya Resume",
      isDefault: true,
      sourcePdfUrl: "https://files.example/resume.pdf",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-02T00:00:00Z"),
      contactInfo: {
        resumeId: "resume-source",
        fullName: "Maya Rivera",
        email: "maya@example.com",
        phone: "555-0100",
        location: "Los Angeles, CA",
        links: [{ label: "Portfolio", url: "https://maya.example" }],
      },
      experiences: [
        {
          id: "experience-source",
          resumeId: "resume-source",
          company: "Corner Cafe",
          role: "Barista",
          location: "Los Angeles, CA",
          startDate: "2025-01-01",
          endDate: null,
          current: true,
          sortOrder: 0,
          bullets: [
            {
              id: "bullet-1",
              experienceId: "experience-source",
              text: "Served customers",
              originalText: null,
              sortOrder: 0,
            },
            {
              id: "bullet-2",
              experienceId: "experience-source",
              text: "Trained new hires",
              originalText: "Helped new hires",
              sortOrder: 1,
            },
          ],
        },
      ],
      educations: [
        {
          id: "education-source",
          resumeId: "resume-source",
          school: "City College",
          degree: "AA",
          field: "Business",
          startDate: "2022-01-01",
          endDate: "2024-01-01",
          gpa: "3.80",
          sortOrder: 0,
        },
      ],
      skills: [
        {
          id: "skill-source",
          resumeId: "resume-source",
          category: "Service",
          name: "POS systems",
          sortOrder: 0,
        },
      ],
      projects: [
        {
          id: "project-source",
          resumeId: "resume-source",
          name: "Community pantry",
          description: "Coordinated weekly inventory",
          link: null,
          sortOrder: 0,
        },
      ],
    } satisfies RenderableResume;
    const before = structuredClone(source);
    let nextId = 0;

    const rows = buildTailoredResumeRows({
      source,
      userId: "user-1",
      company: "Acme",
      role: "Office Assistant",
      replacements: new Map([["bullet-2", "Onboarded five new hires"]]),
      idFactory: () => `new-${++nextId}`,
    });

    expect(rows.resumeRow).toMatchObject({
      id: "new-1",
      userId: "user-1",
      title: "Maya Resume - Acme Office Assistant",
      isDefault: false,
      sourcePdfUrl: "https://files.example/resume.pdf",
    });
    expect(rows.contactInfoRow).toMatchObject({
      resumeId: "new-1",
      fullName: "Maya Rivera",
    });
    expect(rows.experienceRows).toEqual([
      expect.objectContaining({
        id: "new-2",
        resumeId: "new-1",
        company: "Corner Cafe",
      }),
    ]);
    expect(rows.bulletRows).toEqual([
      expect.objectContaining({
        id: "new-3",
        text: "Served customers",
        originalText: "Served customers",
      }),
      expect.objectContaining({
        id: "new-4",
        text: "Onboarded five new hires",
        originalText: "Helped new hires",
      }),
    ]);
    expect(rows.educationRows[0]).toMatchObject({ id: "new-5", resumeId: "new-1" });
    expect(rows.skillRows[0]).toMatchObject({ id: "new-6", resumeId: "new-1" });
    expect(rows.projectRows[0]).toMatchObject({ id: "new-7", resumeId: "new-1" });
    expect(source).toEqual(before);
  });
});

describe("executeTailoredWriteBatch", () => {
  it("submits all writes once and propagates transaction failure without fallback writes", async () => {
    const writes = [{ table: "resume" }, { table: "application" }] as [
      { table: string },
      ...Array<{ table: string }>,
    ];
    const execute = vi.fn().mockRejectedValue(new Error("batch rolled back"));

    await expect(executeTailoredWriteBatch(writes, execute)).rejects.toThrow(
      /batch rolled back/,
    );
    expect(execute).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledWith(writes);
  });
});
