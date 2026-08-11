import { describe, expect, it, vi } from "vitest";
import {
  buildTailoredBulletCopies,
  buildTailoredBulletReplacements,
  buildTailoredResumeTitle,
  linkTailoredResumeWithCompensation,
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

describe("linkTailoredResumeWithCompensation", () => {
  function operations() {
    return {
      updateApplication: vi.fn(
        async (id: string, resumeId: string | null, status: string) => {
          void id;
          void resumeId;
          void status;
        },
      ),
      insertApplication: vi.fn(
        async (input: {
          id: string;
          userId: string;
          jobId: string;
          resumeId: string;
          status: string;
        }) => {
          void input;
        },
      ),
      deleteApplication: vi.fn(async (id: string) => {
        void id;
      }),
      updateListingStatus: vi.fn(
        async (id: string, status: string) => {
          void id;
          void status;
        },
      ),
    };
  }

  it("preserves an applied application and applied listings", async () => {
    const ops = operations();
    await linkTailoredResumeWithCompensation({
      existingApplication: {
        id: "app-1",
        resumeId: "resume-old",
        status: "applied",
      },
      listings: [
        { id: "listing-applied", status: "applied" },
        { id: "listing-saved", status: "saved" },
      ],
      applicationId: "unused",
      userId: "user-1",
      jobId: "job-1",
      resumeId: "resume-new",
      operations: ops,
    });

    expect(ops.updateApplication).toHaveBeenCalledWith(
      "app-1",
      "resume-new",
      "applied",
    );
    expect(ops.updateListingStatus).toHaveBeenCalledOnce();
    expect(ops.updateListingStatus).toHaveBeenCalledWith(
      "listing-saved",
      "tailored",
    );
  });

  it("restores existing links when a later listing update fails", async () => {
    const ops = operations();
    ops.updateListingStatus.mockImplementation(async (id, status) => {
      if (id === "listing-2" && status === "tailored") {
        throw new Error("listing update failed");
      }
    });

    await expect(
      linkTailoredResumeWithCompensation({
        existingApplication: {
          id: "app-1",
          resumeId: "resume-old",
          status: "draft",
        },
        listings: [
          { id: "listing-1", status: "discovered" },
          { id: "listing-2", status: "saved" },
        ],
        applicationId: "unused",
        userId: "user-1",
        jobId: "job-1",
        resumeId: "resume-new",
        operations: ops,
      }),
    ).rejects.toThrow(/listing update failed/);

    expect(ops.updateApplication).toHaveBeenNthCalledWith(
      2,
      "app-1",
      "resume-old",
      "draft",
    );
    expect(ops.updateListingStatus).toHaveBeenCalledWith(
      "listing-1",
      "discovered",
    );
  });

  it("deletes a newly created application when linking fails", async () => {
    const ops = operations();
    ops.updateListingStatus.mockRejectedValueOnce(new Error("listing failed"));

    await expect(
      linkTailoredResumeWithCompensation({
        existingApplication: null,
        listings: [{ id: "listing-1", status: "saved" }],
        applicationId: "app-new",
        userId: "user-1",
        jobId: "job-1",
        resumeId: "resume-new",
        operations: ops,
      }),
    ).rejects.toThrow(/listing failed/);

    expect(ops.deleteApplication).toHaveBeenCalledWith("app-new");
  });
});
