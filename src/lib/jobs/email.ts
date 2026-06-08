import { eq } from "drizzle-orm";
import { draftJobEmail } from "@/lib/ai/email-writer";
import type { JobEmail } from "@/lib/ai/email-writer/schema";
import { db } from "@/lib/db";
import { job } from "@/lib/db/jobs-schema";
import { requireResumeAccess } from "@/lib/resumes/access";
import { loadRenderableResume, resumeToPlainText } from "@/lib/resumes/render";
import { requireJobAccess } from "./access";

export type JobEmailDraft = JobEmail & {
  candidateName: string;
  suggestedTo: string | null;
};

/**
 * Drafts a tailored application email for a job + resume the caller owns.
 * Auth is enforced at the data layer (job and resume ownership), matching the
 * rest of the jobs module.
 */
export async function draftEmailForJob({
  jobId,
  resumeId,
}: {
  jobId: string;
  resumeId: string;
}): Promise<JobEmailDraft> {
  const [{ userId }] = await Promise.all([
    requireJobAccess(jobId),
    requireResumeAccess(resumeId),
  ]);

  const [jobRow] = await db.select().from(job).where(eq(job.id, jobId)).limit(1);
  const resumeData = await loadRenderableResume(resumeId);
  if (!jobRow) throw new Error("Job not found.");
  if (!resumeData || resumeData.userId !== userId) {
    throw new Error("Resume not found.");
  }

  const candidateName = resumeData.contactInfo?.fullName ?? "";

  const email = await draftJobEmail({
    job: {
      title: jobRow.title,
      company: jobRow.company,
      description: jobRow.description,
      requirements: jobRow.requirements,
    },
    resumeText: resumeToPlainText(resumeData),
    candidateName,
  });

  return { ...email, candidateName, suggestedTo: null };
}
