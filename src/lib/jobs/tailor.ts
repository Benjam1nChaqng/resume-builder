import { tailorBullets } from "@/lib/ai/bullet-tailorer";
import type { TailoredBullet } from "@/lib/ai/bullet-tailorer/schema";
import { requireResumeAccess } from "@/lib/resumes/access";
import { requireJobAccess } from "./access";
import {
  loadJobForTailoring,
  loadResumeForTailoring,
  type TailoringBullet,
  type TailoringJob,
} from "./tailor-repo";

export type TailoredExperienceResult = {
  experienceId: string;
  company: string;
  role: string;
  before: TailoringBullet[];
  tailored: TailoredBullet[];
};

export type TailorResumeResult = {
  job: TailoringJob;
  experiences: TailoredExperienceResult[];
};

export async function tailorResumeForJob({
  jobId,
  resumeId,
}: {
  jobId: string;
  resumeId: string;
}): Promise<TailorResumeResult> {
  const [jobAccess, resumeAccess] = await Promise.all([
    requireJobAccess(jobId),
    requireResumeAccess(resumeId),
  ]);
  if (jobAccess.userId !== resumeAccess.userId) {
    throw new Error("Job and resume owners do not match.");
  }

  const [jobData, resumeData] = await Promise.all([
    loadJobForTailoring(jobId),
    loadResumeForTailoring(resumeId),
  ]);

  if (!jobData) throw new Error(`Job ${jobId} not found`);
  if (!resumeData) throw new Error(`Resume ${resumeId} not found`);

  const eligibleExperiences = resumeData.experiences.filter(
    (e) => e.bullets.length > 0,
  );

  const tailoredResponses = await Promise.all(
    eligibleExperiences.map((exp) =>
      tailorBullets({
        experience: {
          company: exp.company,
          role: exp.role,
          bullets: exp.bullets.map((b) => b.text),
        },
        jobDescription: jobData,
      }),
    ),
  );

  return {
    job: jobData,
    experiences: eligibleExperiences.map((exp, i) => ({
      experienceId: exp.id,
      company: exp.company,
      role: exp.role,
      before: exp.bullets,
      tailored: tailoredResponses[i].bullets,
    })),
  };
}
