import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
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
import {
  loadRenderableResume,
  type RenderableResume,
} from "@/lib/resumes/render";
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

type SourceBullet = {
  id: string;
  text: string;
  originalText: string | null;
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

export function buildTailoredBulletCopies({
  sourceBullets,
  replacements,
  experienceId,
  idFactory = randomUUID,
}: {
  sourceBullets: SourceBullet[];
  replacements: Map<string, string>;
  experienceId: string;
  idFactory?: () => string;
}) {
  return sourceBullets.map((sourceBullet, sortOrder) => ({
    id: idFactory(),
    experienceId,
    text: replacements.get(sourceBullet.id) ?? sourceBullet.text,
    originalText: sourceBullet.originalText ?? sourceBullet.text,
    sortOrder,
  }));
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

export function buildTailoredResumeRows({
  source,
  userId,
  company,
  role,
  replacements,
  idFactory = randomUUID,
}: {
  source: RenderableResume;
  userId: string;
  company: string;
  role: string;
  replacements: Map<string, string>;
  idFactory?: () => string;
}) {
  const resumeId = idFactory();
  const experienceRows: Array<typeof experience.$inferInsert> = [];
  const bulletRows: Array<typeof bullet.$inferInsert> = [];

  for (const [sortOrder, sourceExperience] of source.experiences.entries()) {
    const experienceId = idFactory();
    experienceRows.push({
      id: experienceId,
      resumeId,
      company: sourceExperience.company,
      role: sourceExperience.role,
      location: sourceExperience.location,
      startDate: sourceExperience.startDate,
      endDate: sourceExperience.endDate,
      current: sourceExperience.current,
      sortOrder,
    });
    bulletRows.push(
      ...buildTailoredBulletCopies({
        sourceBullets: sourceExperience.bullets,
        replacements,
        experienceId,
        idFactory,
      }),
    );
  }

  return {
    resumeId,
    resumeRow: {
      id: resumeId,
      userId,
      title: buildTailoredResumeTitle({
        baseTitle: source.title,
        company,
        role,
      }),
      isDefault: false,
      sourcePdfUrl: source.sourcePdfUrl,
    } satisfies typeof resume.$inferInsert,
    contactInfoRow: source.contactInfo
      ? ({
          resumeId,
          fullName: source.contactInfo.fullName,
          email: source.contactInfo.email,
          phone: source.contactInfo.phone,
          location: source.contactInfo.location,
          links: source.contactInfo.links,
        } satisfies typeof contactInfo.$inferInsert)
      : null,
    experienceRows,
    bulletRows,
    educationRows: source.educations.map(
      (sourceEducation, sortOrder) =>
        ({
          id: idFactory(),
          resumeId,
          school: sourceEducation.school,
          degree: sourceEducation.degree,
          field: sourceEducation.field,
          startDate: sourceEducation.startDate,
          endDate: sourceEducation.endDate,
          gpa: sourceEducation.gpa,
          sortOrder,
        }) satisfies typeof education.$inferInsert,
    ),
    skillRows: source.skills.map(
      (sourceSkill, sortOrder) =>
        ({
          id: idFactory(),
          resumeId,
          category: sourceSkill.category,
          name: sourceSkill.name,
          sortOrder,
        }) satisfies typeof skill.$inferInsert,
    ),
    projectRows: source.projects.map(
      (sourceProject, sortOrder) =>
        ({
          id: idFactory(),
          resumeId,
          name: sourceProject.name,
          description: sourceProject.description,
          link: sourceProject.link,
          sortOrder,
        }) satisfies typeof project.$inferInsert,
    ),
  };
}

export async function executeTailoredWriteBatch<T>(
  writes: [T, ...T[]],
  execute: (batch: [T, ...T[]]) => Promise<unknown>,
): Promise<void> {
  await execute(writes);
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

  const copyRows = buildTailoredResumeRows({
    source,
    userId,
    company: jobRow.company,
    role: jobRow.title,
    replacements,
  });
  const { resumeId: newResumeId } = copyRows;
  const writes: BatchItem<"pg">[] = [
    db.insert(resume).values(copyRows.resumeRow),
  ];

  if (copyRows.contactInfoRow) {
    writes.push(db.insert(contactInfo).values(copyRows.contactInfoRow));
  }
  if (copyRows.experienceRows.length > 0) {
    writes.push(db.insert(experience).values(copyRows.experienceRows));
  }
  if (copyRows.bulletRows.length > 0) {
    writes.push(db.insert(bullet).values(copyRows.bulletRows));
  }
  if (copyRows.educationRows.length > 0) {
    writes.push(db.insert(education).values(copyRows.educationRows));
  }
  if (copyRows.skillRows.length > 0) {
    writes.push(db.insert(skill).values(copyRows.skillRows));
  }
  if (copyRows.projectRows.length > 0) {
    writes.push(db.insert(project).values(copyRows.projectRows));
  }

  const existing = await db
    .select({ id: application.id })
    .from(application)
    .where(and(eq(application.jobId, jobId), eq(application.userId, userId)))
    .limit(1);
  if (existing[0]) {
    writes.push(
      db
        .update(application)
        .set({
          resumeId: newResumeId,
          status: sql`case when ${application.status} = 'applied' then 'applied' else 'tailored' end`,
        })
        .where(eq(application.id, existing[0].id)),
    );
  } else {
    writes.push(
      db.insert(application).values({
        id: randomUUID(),
        userId,
        jobId,
        resumeId: newResumeId,
        status: "tailored",
      }),
    );
  }

  writes.push(
    db
      .update(jobListing)
      .set({
        status: sql`case when ${jobListing.status} = 'applied' then 'applied' else 'tailored' end`,
      })
      .where(eq(jobListing.jobId, jobId)),
  );

  await executeTailoredWriteBatch(
    writes as [BatchItem<"pg">, ...BatchItem<"pg">[]],
    (batch) => db.batch(batch),
  );
  return newResumeId;
}
