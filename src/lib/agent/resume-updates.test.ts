import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockLoadResumeOwner,
  mockAddEducationRow,
  mockUpdateEducationRow,
  mockUpdateProjectRow,
  mockReorderProjectsRow,
} = vi.hoisted(() => ({
  mockLoadResumeOwner: vi.fn(),
  mockAddEducationRow: vi.fn(),
  mockUpdateEducationRow: vi.fn(),
  mockUpdateProjectRow: vi.fn(),
  mockReorderProjectsRow: vi.fn(),
}));

vi.mock("@/lib/resumes/owner", () => ({
  loadResumeOwner: mockLoadResumeOwner,
}));

vi.mock("@/lib/resumes/repo", () => ({
  addEducationRow: mockAddEducationRow,
  updateEducationRow: mockUpdateEducationRow,
  updateProjectRow: mockUpdateProjectRow,
  reorderProjectsRow: mockReorderProjectsRow,
}));

beforeEach(() => {
  mockLoadResumeOwner.mockReset();
  mockAddEducationRow.mockReset();
  mockUpdateEducationRow.mockReset();
  mockUpdateProjectRow.mockReset();
  mockReorderProjectsRow.mockReset();
});

describe("updateResumeContentForUser", () => {
  it("rejects a resume owned by another user before writing", async () => {
    mockLoadResumeOwner.mockResolvedValueOnce("user-2");
    const { updateResumeContentForUser } = await import("./resume-updates");

    await expect(
      updateResumeContentForUser({
        userId: "user-1",
        resumeId: "resume-1",
        input: {
          educationUpdates: [
            { educationId: "education-1", patch: { field: "Computer Science" } },
          ],
          educationAdds: [],
          projectUpdates: [],
        },
      }),
    ).rejects.toThrow(/not found/i);

    expect(mockUpdateEducationRow).not.toHaveBeenCalled();
  });

  it("applies validated education and project updates to the owned resume", async () => {
    mockLoadResumeOwner.mockResolvedValueOnce("user-1");
    mockAddEducationRow.mockResolvedValueOnce("education-new");
    const { updateResumeContentForUser } = await import("./resume-updates");

    const result = await updateResumeContentForUser({
      userId: "user-1",
      resumeId: "resume-1",
      input: {
        educationUpdates: [
          { educationId: "education-1", patch: { field: "Computer Science" } },
        ],
        educationAdds: [
          {
            school: "California State University, Sacramento",
            degree: null,
            field: "Dean's Honors List (2021)",
            startDate: "2021-01-01",
            endDate: "2022-12-01",
            gpa: null,
          },
        ],
        projectUpdates: [
          {
            projectId: "project-1",
            patch: { name: "Axora Medical Office Relocation & IT Cutover" },
          },
        ],
        projectOrder: ["project-1", "project-2"],
      },
    });

    expect(mockUpdateEducationRow).toHaveBeenNthCalledWith(
      1,
      "resume-1",
      "education-1",
      { field: "Computer Science" },
    );
    expect(mockUpdateEducationRow).toHaveBeenNthCalledWith(
      2,
      "resume-1",
      "education-new",
      {
        school: "California State University, Sacramento",
        degree: null,
        field: "Dean's Honors List (2021)",
        startDate: "2021-01-01",
        endDate: "2022-12-01",
        gpa: null,
      },
    );
    expect(mockUpdateProjectRow).toHaveBeenCalledWith(
      "resume-1",
      "project-1",
      { name: "Axora Medical Office Relocation & IT Cutover" },
    );
    expect(mockReorderProjectsRow).toHaveBeenCalledWith("resume-1", [
      "project-1",
      "project-2",
    ]);
    expect(result).toEqual({ addedEducationIds: ["education-new"] });
  });
});
