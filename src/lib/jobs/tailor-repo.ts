import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { job } from "@/lib/db/jobs-schema";
import { resume } from "@/lib/db/resume-schema";

export type TailoringJob = {
  title: string;
  requirements: string[];
  niceToHaves: string[] | null;
};

export type TailoringBullet = { id: string; text: string };

export type TailoringExperience = {
  id: string;
  company: string;
  role: string;
  bullets: TailoringBullet[];
};

export type TailoringResume = {
  experiences: TailoringExperience[];
};

export async function loadJobForTailoring(
  jobId: string,
): Promise<TailoringJob | null> {
  const rows = await db
    .select({
      title: job.title,
      requirements: job.requirements,
      niceToHaves: job.niceToHaves,
    })
    .from(job)
    .where(eq(job.id, jobId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    title: row.title,
    requirements: row.requirements ?? [],
    niceToHaves: row.niceToHaves,
  };
}

export async function loadResumeForTailoring(
  resumeId: string,
): Promise<TailoringResume | null> {
  const found = await db.query.resume.findFirst({
    where: eq(resume.id, resumeId),
    with: {
      experiences: {
        orderBy: (cols, { asc }) => [asc(cols.sortOrder)],
        with: {
          bullets: {
            orderBy: (cols, { asc }) => [asc(cols.sortOrder)],
          },
        },
      },
    },
  });

  if (!found) return null;
  return {
    experiences: found.experiences.map((e) => ({
      id: e.id,
      company: e.company,
      role: e.role,
      bullets: e.bullets.map((b) => ({ id: b.id, text: b.text })),
    })),
  };
}
