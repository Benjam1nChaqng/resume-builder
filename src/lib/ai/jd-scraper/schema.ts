import { z } from "zod";

export const JobDescriptionSchema = z.object({
  title: z.string().min(1),
  company: z.string().min(1),
  location: z.string().nullable().default(null),
  description: z.string().min(1),
  requirements: z.array(z.string().min(1)).default([]),
  niceToHaves: z.array(z.string().min(1)).nullable().default(null),
  seniority: z.string().nullable().default(null),
  salaryMin: z.number().int().nullable().default(null),
  salaryMax: z.number().int().nullable().default(null),
});

export type JobDescription = z.infer<typeof JobDescriptionSchema>;
