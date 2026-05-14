import { z } from "zod";

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
  .nullable();

const ContactLink = z.object({
  label: z.string().min(1),
  url: z.string().url(),
});

export const ResumePatchSchema = z
  .object({
    title: z.string().min(1).optional(),
    isDefault: z.boolean().optional(),
  })
  .strict();

export const ContactInfoPatchSchema = z
  .object({
    fullName: z.string().min(1).optional(),
    email: z.string().email().nullable().optional(),
    phone: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    links: z.array(ContactLink).optional(),
  })
  .strict();

export const ExperiencePatchSchema = z
  .object({
    company: z.string().min(1).optional(),
    role: z.string().min(1).optional(),
    location: z.string().nullable().optional(),
    startDate: dateString.optional(),
    endDate: dateString.optional(),
    current: z.boolean().optional(),
  })
  .strict();

export const BulletPatchSchema = z
  .object({
    text: z.string().min(1).optional(),
  })
  .strict();

export const EducationPatchSchema = z
  .object({
    school: z.string().min(1).optional(),
    degree: z.string().nullable().optional(),
    field: z.string().nullable().optional(),
    startDate: dateString.optional(),
    endDate: dateString.optional(),
    gpa: z.number().min(0).max(5).nullable().optional(),
  })
  .strict();

export const SkillPatchSchema = z
  .object({
    category: z.string().nullable().optional(),
    name: z.string().min(1).optional(),
  })
  .strict();

export const ProjectPatchSchema = z
  .object({
    name: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    link: z.string().url().nullable().optional(),
  })
  .strict();

export type ResumePatch = z.infer<typeof ResumePatchSchema>;
export type ContactInfoPatch = z.infer<typeof ContactInfoPatchSchema>;
export type ExperiencePatch = z.infer<typeof ExperiencePatchSchema>;
export type BulletPatch = z.infer<typeof BulletPatchSchema>;
export type EducationPatch = z.infer<typeof EducationPatchSchema>;
export type SkillPatch = z.infer<typeof SkillPatchSchema>;
export type ProjectPatch = z.infer<typeof ProjectPatchSchema>;
