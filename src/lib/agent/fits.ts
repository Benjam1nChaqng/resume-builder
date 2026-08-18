import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
  RESUME_FIT_RUBRIC_VERSION,
  ResumeJobFitSchema,
} from "@/lib/ai/resume-fit/schema";
import { db } from "@/lib/db";
import { job, resumeJobFit } from "@/lib/db/jobs-schema";
import { resume } from "@/lib/db/resume-schema";

export const AgentResumeJobFitSchema = ResumeJobFitSchema.extend({
  jobId: z.string().min(1),
  resumeId: z.string().min(1),
});

export type AgentResumeJobFit = z.infer<typeof AgentResumeJobFitSchema>;

export async function saveAgentResumeJobFit({
  userId,
  input,
}: {
  userId: string;
  input: AgentResumeJobFit;
}) {
  const [ownedJobs, ownedResumes] = await Promise.all([
    db
      .select({ id: job.id })
      .from(job)
      .where(and(eq(job.id, input.jobId), eq(job.userId, userId)))
      .limit(1),
    db
      .select({ id: resume.id })
      .from(resume)
      .where(and(eq(resume.id, input.resumeId), eq(resume.userId, userId)))
      .limit(1),
  ]);
  if (!ownedJobs[0] || !ownedResumes[0]) {
    throw new Error("Job or resume not found.");
  }

  const id = randomUUID();
  await db.insert(resumeJobFit).values({
    id,
    userId,
    jobId: input.jobId,
    resumeId: input.resumeId,
    status: "completed",
    errorSummary: null,
    score: input.score,
    matchingEvidence: input.matchingEvidence,
    missingRequirements: input.missingRequirements,
    missingPreferredRequirements: input.missingPreferredRequirements,
    concerns: input.concerns,
    unsupportedClaims: input.unsupportedClaims,
    recommendations: input.recommendations,
    modelMetadata: {
      model: "codex-agent",
      checkedAt: new Date().toISOString(),
      rubricVersion: RESUME_FIT_RUBRIC_VERSION,
    },
  });

  return { fitId: id };
}
