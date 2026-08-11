import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { analyzeResumeFit } from "@/lib/ai/resume-fit";
import { MODELS } from "@/lib/ai/models";
import { db } from "@/lib/db";
import { job, resumeJobFit } from "@/lib/db/jobs-schema";
import { requireJobAccess } from "@/lib/jobs/access";
import { requireResumeAccess } from "@/lib/resumes/access";
import { loadRenderableResume, resumeToPlainText } from "@/lib/resumes/render";

export async function runResumeJobFit({
  jobId,
  resumeId,
}: {
  jobId: string;
  resumeId: string;
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
  const resumeData = await loadRenderableResume(resumeId);
  if (!jobRow) throw new Error("Job not found.");
  if (!resumeData) throw new Error("Resume not found.");

  const fit = await analyzeResumeFit({
    job: {
      title: jobRow.title,
      company: jobRow.company,
      description: jobRow.description,
      requirements: jobRow.requirements,
      niceToHaves: jobRow.niceToHaves,
    },
    resumeText: resumeToPlainText(resumeData),
  });

  const id = randomUUID();
  await db.insert(resumeJobFit).values({
    id,
    userId,
    jobId,
    resumeId,
    score: fit.score,
    matchingEvidence: fit.matchingEvidence,
    missingRequirements: fit.missingRequirements,
    concerns: fit.concerns,
    recommendations: fit.recommendations,
    modelMetadata: {
      model: MODELS.REVIEWER,
      checkedAt: new Date().toISOString(),
    },
  });
  return id;
}
