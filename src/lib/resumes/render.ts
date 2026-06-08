import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { resume } from "@/lib/db/resume-schema";

export type RenderableResume = NonNullable<
  Awaited<ReturnType<typeof loadRenderableResume>>
>;

export async function loadRenderableResume(resumeId: string) {
  return db.query.resume.findFirst({
    where: eq(resume.id, resumeId),
    with: {
      contactInfo: true,
      experiences: {
        orderBy: (cols, { asc }) => [asc(cols.sortOrder)],
        with: {
          bullets: {
            orderBy: (cols, { asc }) => [asc(cols.sortOrder)],
          },
        },
      },
      educations: {
        orderBy: (cols, { asc }) => [asc(cols.sortOrder)],
      },
      skills: {
        orderBy: (cols, { asc }) => [asc(cols.sortOrder)],
      },
      projects: {
        orderBy: (cols, { asc }) => [asc(cols.sortOrder)],
      },
    },
  });
}

export function resumeToPlainText(data: RenderableResume): string {
  const lines: string[] = [];
  if (data.contactInfo) {
    lines.push(data.contactInfo.fullName);
    lines.push(
      [
        data.contactInfo.email,
        data.contactInfo.phone,
        data.contactInfo.location,
        ...data.contactInfo.links.map((l) => l.url),
      ]
        .filter(Boolean)
        .join(" | "),
    );
  }
  lines.push("");
  lines.push("Experience");
  for (const exp of data.experiences) {
    lines.push(`${exp.role}, ${exp.company}`);
    for (const b of exp.bullets) lines.push(`- ${b.text}`);
  }
  lines.push("");
  lines.push("Education");
  for (const ed of data.educations) {
    lines.push([ed.school, ed.degree, ed.field].filter(Boolean).join(" | "));
  }
  lines.push("");
  lines.push("Skills");
  lines.push(data.skills.map((s) => [s.category, s.name].filter(Boolean).join(": ")).join(", "));
  lines.push("");
  lines.push("Projects");
  for (const p of data.projects) {
    lines.push([p.name, p.description, p.link].filter(Boolean).join(" | "));
  }
  return lines.join("\n").trim();
}

