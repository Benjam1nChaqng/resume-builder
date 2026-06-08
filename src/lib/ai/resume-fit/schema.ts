import { z } from "zod";

export const ResumeJobFitSchema = z.object({
  score: z.number().int().min(0).max(100),
  matchingEvidence: z
    .array(
      z.object({
        label: z.string().min(1),
        evidence: z.string().min(1),
      }),
    )
    .default([]),
  missingRequirements: z.array(z.string().min(1)).default([]),
  concerns: z.array(z.string().min(1)).default([]),
  recommendations: z.array(z.string().min(1)).default([]),
});

export type ResumeJobFit = z.infer<typeof ResumeJobFitSchema>;

