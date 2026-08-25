import { writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import type { RenderableResume } from "./render";
import { keepPdfWordUnbroken, renderResumePdf } from "./resume-pdf";

const fixture = {
  id: "resume-1",
  userId: "user-1",
  title: "Product Engineer Resume",
  isDefault: false,
  sourcePdfUrl: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  contactInfo: {
    resumeId: "resume-1",
    fullName: "Jordan Lee",
    email: "jordan@example.com",
    phone: "555-0100",
    location: "Portland, OR",
    links: [{ label: "Portfolio", url: "https://jordan.example" }],
  },
  experiences: [
    {
      id: "exp-1",
      resumeId: "resume-1",
      company: "Acme",
      role: "Product Engineer",
      location: "Remote",
      startDate: "2023-01-01",
      endDate: null,
      current: true,
      sortOrder: 0,
      bullets: [
        {
          id: "bullet-1",
          experienceId: "exp-1",
          text: "Built accessible workflows used by 2,000 customers.",
          originalText: null,
          sortOrder: 0,
        },
      ],
    },
  ],
  educations: [],
  skills: [
    {
      id: "skill-1",
      resumeId: "resume-1",
      category: "Languages",
      name: "TypeScript",
      sortOrder: 0,
    },
  ],
  projects: [],
} as unknown as RenderableResume;

const longFixture = {
  ...fixture,
  title: "Senior Product Engineer Resume",
  experiences: Array.from({ length: 5 }, (_, experienceIndex) => ({
    id: `exp-${experienceIndex + 1}`,
    resumeId: "resume-1",
    company: `Company ${experienceIndex + 1}`,
    role: experienceIndex === 0 ? "Senior Product Engineer" : "Software Engineer",
    location: experienceIndex % 2 === 0 ? "Remote" : "Portland, OR",
    startDate: `${2025 - experienceIndex}-01-01`,
    endDate: experienceIndex === 0 ? null : `${2026 - experienceIndex}-01-01`,
    current: experienceIndex === 0,
    sortOrder: experienceIndex,
    bullets: Array.from({ length: 5 }, (_, bulletIndex) => ({
      id: `bullet-${experienceIndex}-${bulletIndex}`,
      experienceId: `exp-${experienceIndex + 1}`,
      text: `Led cross-functional delivery of workflow ${bulletIndex + 1}, improving measurable customer outcomes while maintaining accessibility, reliability, and clear operational ownership.`,
      originalText: null,
      sortOrder: bulletIndex,
    })),
  })),
  educations: [
    {
      id: "education-1",
      resumeId: "resume-1",
      school: "State University",
      degree: "Bachelor of Science",
      field: "Computer Science",
      startDate: "2014-09-01",
      endDate: "2018-06-01",
      gpa: null,
      sortOrder: 0,
    },
  ],
  projects: [
    {
      id: "project-1",
      resumeId: "resume-1",
      name: "Career Workflow Lab",
      description:
        "Built an evidence-backed job discovery and resume tailoring system with source-aware scoring and auditable edits.",
      link: "https://jordan.example/career-lab",
      sortOrder: 0,
    },
  ],
} as unknown as RenderableResume;

describe("renderResumePdf", () => {
  it("keeps ATS keywords intact instead of inserting hyphenation", () => {
    expect(keepPdfWordUnbroken("remediation")).toEqual(["remediation"]);
  });

  it("renders structured resume data into non-empty PDF bytes", async () => {
    const pdf = await renderResumePdf(fixture);

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.byteLength).toBeGreaterThan(1_000);
    if (process.env.RESUME_PDF_OUTPUT) {
      await writeFile(process.env.RESUME_PDF_OUTPUT, pdf);
    }
  });

  it("wraps a dense resume across multiple PDF pages", async () => {
    const pdf = await renderResumePdf(longFixture);

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.byteLength).toBeGreaterThan(3_000);
    if (process.env.RESUME_PDF_LONG_OUTPUT) {
      await writeFile(process.env.RESUME_PDF_LONG_OUTPUT, pdf);
    }
  });
});
