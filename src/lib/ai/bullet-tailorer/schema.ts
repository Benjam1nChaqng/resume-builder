import { z } from "zod";

export const TailorExperienceSchema = z.object({
  company: z.string().min(1),
  role: z.string().min(1),
  bullets: z.array(z.string().min(1)),
});

export const TailorJobDescriptionSchema = z.object({
  title: z.string().min(1),
  requirements: z.array(z.string().min(1)).default([]),
  niceToHaves: z.array(z.string().min(1)).nullable().default(null),
});

export const TailoredBulletSchema = z.object({
  originalText: z.string().nullable(),
  text: z.string().min(1),
  rationale: z.string().min(1),
});

export const TailoredBulletsSchema = z.object({
  bullets: z.array(TailoredBulletSchema),
});

export type TailorExperience = z.infer<typeof TailorExperienceSchema>;
export type TailorJobDescription = z.infer<typeof TailorJobDescriptionSchema>;
export type TailoredBullet = z.infer<typeof TailoredBulletSchema>;
export type TailoredBullets = z.infer<typeof TailoredBulletsSchema>;
