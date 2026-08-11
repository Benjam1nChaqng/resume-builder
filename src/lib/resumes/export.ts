import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { application, job } from "@/lib/db/jobs-schema";

export type ResumeExportJob = {
  company: string;
  role: string;
};

export async function loadResumeExportJob(
  resumeId: string,
  userId: string,
): Promise<ResumeExportJob | null> {
  const rows = await db
    .select({ company: job.company, role: job.title })
    .from(application)
    .innerJoin(job, eq(application.jobId, job.id))
    .where(and(eq(application.resumeId, resumeId), eq(application.userId, userId)))
    .orderBy(desc(application.appliedAt))
    .limit(1);
  return rows[0] ?? null;
}

function filenamePart(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function buildResumePdfFilename({
  candidateName,
  resumeTitle,
  jobContext,
}: {
  candidateName: string | null;
  resumeTitle: string;
  jobContext: ResumeExportJob | null;
}): string {
  const parts = jobContext
    ? [candidateName, jobContext.company, jobContext.role]
    : [candidateName, resumeTitle];
  const stem = parts
    .filter((part): part is string => Boolean(part?.trim()))
    .map(filenamePart)
    .filter(Boolean)
    .join("-");
  return `${stem || "resume"}.pdf`;
}
