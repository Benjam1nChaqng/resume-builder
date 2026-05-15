import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ParsedResume } from "@/lib/ai/resume-importer/schema";

const mockImportResume = vi.fn();
const mockBlobPut = vi.fn();
const mockInsertResumeWithRelations = vi.fn();

vi.mock("@/lib/ai/resume-importer", () => ({
  importResume: mockImportResume,
}));

vi.mock("@vercel/blob", () => ({
  put: mockBlobPut,
}));

vi.mock("@/lib/resumes/repo", () => ({
  insertResumeWithRelations: mockInsertResumeWithRelations,
}));

const fixture: ParsedResume = {
  title: "Test Resume",
  contactInfo: {
    fullName: "Jane Doe",
    email: null,
    phone: null,
    location: null,
    links: [],
  },
  experiences: [],
  educations: [],
  skills: [],
  projects: [],
};

beforeEach(() => {
  mockImportResume.mockReset();
  mockBlobPut.mockReset();
  mockInsertResumeWithRelations.mockReset();
});

describe("createResumeForUser", () => {
  it("text input: agent gets text, repo gets null sourcePdfUrl, blob untouched", async () => {
    mockImportResume.mockResolvedValueOnce(fixture);
    mockInsertResumeWithRelations.mockResolvedValueOnce("resume-123");

    const { createResumeForUser } = await import("./create");
    const id = await createResumeForUser({
      userId: "user-1",
      input: { kind: "text", content: "John Doe\nSenior Engineer..." },
    });

    expect(id).toBe("resume-123");
    expect(mockBlobPut).not.toHaveBeenCalled();
    expect(mockImportResume).toHaveBeenCalledWith({
      kind: "text",
      content: "John Doe\nSenior Engineer...",
    });
    expect(mockInsertResumeWithRelations).toHaveBeenCalledWith({
      userId: "user-1",
      parsed: fixture,
      sourcePdfUrl: null,
    });
  });

  it("pdf input: uploads to blob, agent gets blob URL, repo persists sourcePdfUrl", async () => {
    const file = new File(["%PDF-1.4 fake"], "resume.pdf", { type: "application/pdf" });
    mockBlobPut.mockResolvedValueOnce({ url: "https://blob.example.com/x.pdf" });
    mockImportResume.mockResolvedValueOnce(fixture);
    mockInsertResumeWithRelations.mockResolvedValueOnce("resume-456");

    const { createResumeForUser } = await import("./create");
    const id = await createResumeForUser({
      userId: "user-1",
      input: { kind: "pdf", file },
    });

    expect(id).toBe("resume-456");
    expect(mockBlobPut).toHaveBeenCalledOnce();
    const [key, payload, opts] = mockBlobPut.mock.calls[0];
    expect(key).toMatch(/^pdfs\/user-1\/.+\.pdf$/);
    expect(payload).toBe(file);
    expect(opts).toMatchObject({ access: "private" });

    expect(mockImportResume).toHaveBeenCalledWith({
      kind: "pdf",
      pdfUrl: "https://blob.example.com/x.pdf",
    });
    expect(mockInsertResumeWithRelations).toHaveBeenCalledWith({
      userId: "user-1",
      parsed: fixture,
      sourcePdfUrl: "https://blob.example.com/x.pdf",
    });
  });

  it("propagates importer errors without inserting", async () => {
    mockImportResume.mockRejectedValueOnce(new Error("Claude is unavailable"));

    const { createResumeForUser } = await import("./create");
    await expect(
      createResumeForUser({
        userId: "user-1",
        input: { kind: "text", content: "x" },
      }),
    ).rejects.toThrow(/Claude is unavailable/);

    expect(mockInsertResumeWithRelations).not.toHaveBeenCalled();
  });
});
