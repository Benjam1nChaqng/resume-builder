import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { application, job, jobListing } from "@/lib/db/jobs-schema";
import {
  bullet,
  contactInfo,
  education,
  experience,
  project,
  resume,
  skill,
} from "@/lib/db/resume-schema";
import { loadRenderableResume } from "@/lib/resumes/render";
import { requireResumeAccess } from "@/lib/resumes/access";
import { requireJobAccess } from "./access";

export const TailoredBulletChangeSchema = z.object({
  experienceId: z.string().min(1),
  bulletId: z.string().min(1),
  text: z.string().trim().min(1).max(2_000),
});

export const TailoredBulletChangesSchema = z
  .array(TailoredBulletChangeSchema)
  .max(500);

export type TailoredBulletChange = z.infer<typeof TailoredBulletChangeSchema>;

type SourceExperience = {
  id: string;
  bullets: Array<{ id: string }>;
};

export function buildTailoredBulletReplacements(
  experiences: SourceExperience[],
  changes: TailoredBulletChange[],
): Map<string, string> {
  const parsed = TailoredBulletChangesSchema.parse(changes);
  const validPairs = new Set(
    experiences.flatMap((experienceRow) =>
      experienceRow.bullets.map(
        (bulletRow) => `${experienceRow.id}:${bulletRow.id}`,
      ),
    ),
  );
  const replacements = new Map<string, string>();

  for (const change of parsed) {
    if (!validPairs.has(`${change.experienceId}:${change.bulletId}`)) {
      throw new Error("A tailored bullet does not belong to the source resume.");
    }
    if (replacements.has(change.bulletId)) {
      throw new Error("A tailored bullet was submitted more than once.");
    }
    replacements.set(change.bulletId, change.text);
  }
  return replacements;
}

export function buildTailoredResumeTitle({
  baseTitle,
  company,
  role,
}: {
  baseTitle: string;
  company: string;
  role: string;
}): string {
  return `${baseTitle} - ${company} ${role}`;
}

export async function createTailoredResumeCopy({
  jobId,
  resumeId,
  acceptedChanges,
}: {
  jobId: string;
  resumeId: string;
  acceptedChanges: TailoredBulletChange[];
}): Promise<string> {
  const [jobAccess, resumeAccess] = await Promise.all([
    requireJobAccess(jobId),
    requireResumeAccess(resumeId),
  ]);
  if (jobAccess.userId !== resumeAccess.userId) {
    throw new Error("Job and resume owners do not match.");
  }
  const { userId } = jobAccess;
  const [jobRow] = await db.select().from(job).where(eq(job.id, jobId)).limit(1);
  const source = await loadRenderableResume(resumeId);
  if (!jobRow) throw new Error("Job not found.");
  if (!source || source.userId !== userId) throw new Error("Resume not found.");
  const replacements = buildTailoredBulletReplacements(
    source.experiences,
    acceptedChanges,
  );

  const [newResume] = await db
    .insert(resume)
    .values({
      id: randomUUID(),
      userId,
      title: buildTailoredResumeTitle({
        baseTitle: source.title,
        company: jobRow.company,
        role: jobRow.title,
      }),
      isDefault: false,
      sourcePdfUrl: source.sourcePdfUrl,
    })
    .returning({ id: resume.id });

  if (!newResume) throw new Error("Unable to create tailored resume.");

  try {
    if (source.contactInfo) {
      await db.insert(contactInfo).values({
        resumeId: newResume.id,
        fullName: source.contactInfo.fullName,
        email: source.contactInfo.email,
        phone: source.contactInfo.phone,
        location: source.contactInfo.location,
        links: source.contactInfo.links,
      });
    }

    for (const [i, exp] of source.experiences.entries()) {
      const [newExp] = await db
        .insert(experience)
        .values({
          id: randomUUID(),
          resumeId: newResume.id,
          company: exp.company,
          role: exp.role,
          location: exp.location,
          startDate: exp.startDate,
          endDate: exp.endDate,
          current: exp.current,
          sortOrder: i,
        })
        .returning({ id: experience.id });
      if (!newExp) continue;

      if (exp.bullets.length > 0) {
        await db.insert(bullet).values(
          exp.bullets.map((b, j) => ({
            id: randomUUID(),
            experienceId: newExp.id,
            text: replacements.get(b.id) ?? b.text,
            originalText: b.originalText ?? b.text,
            sortOrder: j,
          })),
        );
      }
    }

    if (source.educations.length > 0) {
      await db.insert(education).values(
        source.educations.map((e, i) => ({
          id: randomUUID(),
          resumeId: newResume.id,
          school: e.school,
          degree: e.degree,
          field: e.field,
          startDate: e.startDate,
          endDate: e.endDate,
          gpa: e.gpa,
          sortOrder: i,
        })),
      );
    }

    if (source.skills.length > 0) {
      await db.insert(skill).values(
        source.skills.map((s, i) => ({
          id: randomUUID(),
          resumeId: newResume.id,
          category: s.category,
          name: s.name,
          sortOrder: i,
        })),
      );
    }

    if (source.projects.length > 0) {
      await db.insert(project).values(
        source.projects.map((p, i) => ({
          id: randomUUID(),
          resumeId: newResume.id,
          name: p.name,
          description: p.description,
          link: p.link,
          sortOrder: i,
        })),
      );
    }

    const existing = await db
      .select({ id: application.id })
      .from(application)
      .where(and(eq(application.jobId, jobId), eq(application.userId, userId)))
      .limit(1);

    if (existing[0]) {
      await db
        .update(application)
        .set({ resumeId: newResume.id, status: "tailored" })
        .where(eq(application.id, existing[0].id));
    } else {
      await db.insert(application).values({
        id: randomUUID(),
        userId,
        jobId,
        resumeId: newResume.id,
        status: "tailored",
      });
    }

    await db
      .update(jobListing)
      .set({ status: "tailored" })
      .where(eq(jobListing.jobId, jobId));

    return newResume.id;
  } catch (err) {
    await db.delete(resume).where(eq(resume.id, newResume.id)).catch(() => {});
    throw err;
  }
}
