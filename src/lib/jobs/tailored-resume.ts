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

type SourceBullet = {
  id: string;
  text: string;
  originalText: string | null;
};

type ApplicationSnapshot = {
  id: string;
  resumeId: string | null;
  status: string;
} | null;

type ListingSnapshot = {
  id: string;
  status: string;
};

type TailoredLinkOperations = {
  updateApplication: (
    applicationId: string,
    resumeId: string | null,
    status: string,
  ) => Promise<void>;
  insertApplication: (input: {
    id: string;
    userId: string;
    jobId: string;
    resumeId: string;
    status: string;
  }) => Promise<void>;
  deleteApplication: (applicationId: string) => Promise<void>;
  updateListingStatus: (listingId: string, status: string) => Promise<void>;
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

export async function linkTailoredResumeWithCompensation({
  existingApplication,
  listings,
  applicationId,
  userId,
  jobId,
  resumeId,
  operations,
}: {
  existingApplication: ApplicationSnapshot;
  listings: ListingSnapshot[];
  applicationId: string;
  userId: string;
  jobId: string;
  resumeId: string;
  operations: TailoredLinkOperations;
}): Promise<void> {
  let applicationMutation: "created" | "updated" | null = null;
  const mutatedListings: ListingSnapshot[] = [];

  try {
    const nextApplicationStatus =
      existingApplication?.status === "applied" ? "applied" : "tailored";
    if (existingApplication) {
      await operations.updateApplication(
        existingApplication.id,
        resumeId,
        nextApplicationStatus,
      );
      applicationMutation = "updated";
    } else {
      await operations.insertApplication({
        id: applicationId,
        userId,
        jobId,
        resumeId,
        status: "tailored",
      });
      applicationMutation = "created";
    }

    for (const listing of listings) {
      if (listing.status === "applied") continue;
      await operations.updateListingStatus(listing.id, "tailored");
      mutatedListings.push(listing);
    }
  } catch (error) {
    const rollbacks: Promise<void>[] = mutatedListings.map((listing) =>
      operations.updateListingStatus(listing.id, listing.status),
    );
    if (applicationMutation === "created") {
      rollbacks.push(operations.deleteApplication(applicationId));
    } else if (applicationMutation === "updated" && existingApplication) {
      rollbacks.push(
        operations.updateApplication(
          existingApplication.id,
          existingApplication.resumeId,
          existingApplication.status,
        ),
      );
    }
    await Promise.allSettled(rollbacks);
    throw error;
  }
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
      if (!newExp) throw new Error("Unable to copy resume experience.");

      if (exp.bullets.length > 0) {
        await db.insert(bullet).values(
          buildTailoredBulletCopies({
            sourceBullets: exp.bullets,
            replacements,
            experienceId: newExp.id,
          }),
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
      .select({
        id: application.id,
        resumeId: application.resumeId,
        status: application.status,
      })
      .from(application)
      .where(and(eq(application.jobId, jobId), eq(application.userId, userId)))
      .limit(1);
    const listings = await db
      .select({ id: jobListing.id, status: jobListing.status })
      .from(jobListing)
      .where(eq(jobListing.jobId, jobId));
    const applicationId = randomUUID();

    await linkTailoredResumeWithCompensation({
      existingApplication: existing[0] ?? null,
      listings,
      applicationId,
      userId,
      jobId,
      resumeId: newResume.id,
      operations: {
        updateApplication: async (id, linkedResumeId, status) => {
          await db
            .update(application)
            .set({ resumeId: linkedResumeId, status })
            .where(eq(application.id, id));
        },
        insertApplication: async (values) => {
          await db.insert(application).values(values);
        },
        deleteApplication: async (id) => {
          await db.delete(application).where(eq(application.id, id));
        },
        updateListingStatus: async (id, status) => {
          await db
            .update(jobListing)
            .set({ status })
            .where(eq(jobListing.id, id));
        },
      },
    });

    return newResume.id;
  } catch (err) {
    await db.delete(resume).where(eq(resume.id, newResume.id)).catch(() => {});
    throw err;
  }
}
