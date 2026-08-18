import { z } from "zod";

export const RESUME_FIT_RUBRIC_VERSION = "resume-fit-v2";

export const ResumeJobFitSchema = z.object({
  score: z.number().int().min(0).max(100),
  matchingEvidence: z
    .array(
      z.object({
        label: z.string().min(1),
        evidence: z.string().min(1),
        sourceSection: z
          .enum(["experience", "skills", "education", "projects"])
          .nullable()
          .default(null),
        confidence: z.enum(["high", "medium", "low"]).default("medium"),
      }),
    )
    .default([]),
  missingRequirements: z.array(z.string().min(1)).default([]),
  missingPreferredRequirements: z.array(z.string().min(1)).default([]),
  concerns: z.array(z.string().min(1)).default([]),
  unsupportedClaims: z.array(z.string().min(1)).default([]),
  recommendations: z.array(z.string().min(1)).default([]),
});

export type ResumeJobFit = z.infer<typeof ResumeJobFitSchema>;
