import { z } from "zod";

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
  .nullable();

// OpenAI strict structured outputs reject JSON Schema's `format: uri`.
const absoluteHttpUrl = z
  .string()
  .regex(/^https?:\/\/\S+$/, "Link must be an absolute HTTP(S) URL");
const emailAddress = z
  .string()
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Email must be valid");

export const ContactLinkSchema = z.object({
  label: z.string().min(1),
  url: absoluteHttpUrl,
});

export const ParsedBulletSchema = z.object({
  text: z.string().min(1),
});

export const ParsedExperienceSchema = z.object({
  company: z.string().min(1),
  role: z.string().min(1),
  location: z.string().nullable().default(null),
  startDate: dateString.default(null),
  endDate: dateString.default(null),
  current: z.boolean().default(false),
  bullets: z.array(ParsedBulletSchema).default([]),
});

export const ParsedEducationSchema = z.object({
  school: z.string().min(1),
  degree: z.string().nullable().default(null),
  field: z.string().nullable().default(null),
  startDate: dateString.default(null),
  endDate: dateString.default(null),
  gpa: z.number().nullable().default(null),
});

export const ParsedSkillSchema = z.object({
  category: z.string().nullable().default(null),
  name: z.string().min(1),
});

export const ParsedProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().default(null),
  link: absoluteHttpUrl.nullable().default(null),
});

export const ParsedContactInfoSchema = z.object({
  fullName: z.string().min(1),
  email: emailAddress.nullable().default(null),
  phone: z.string().nullable().default(null),
  location: z.string().nullable().default(null),
  links: z.array(ContactLinkSchema).default([]),
});

export const ParsedResumeSchema = z.object({
  title: z.string().min(1),
  contactInfo: ParsedContactInfoSchema,
  experiences: z.array(ParsedExperienceSchema).default([]),
  educations: z.array(ParsedEducationSchema).default([]),
  skills: z.array(ParsedSkillSchema).default([]),
  projects: z.array(ParsedProjectSchema).default([]),
});

export type ParsedResume = z.infer<typeof ParsedResumeSchema>;
export type ParsedContactInfo = z.infer<typeof ParsedContactInfoSchema>;
export type ParsedExperience = z.infer<typeof ParsedExperienceSchema>;
export type ParsedEducation = z.infer<typeof ParsedEducationSchema>;
export type ParsedSkill = z.infer<typeof ParsedSkillSchema>;
export type ParsedProject = z.infer<typeof ParsedProjectSchema>;
export type ContactLink = z.infer<typeof ContactLinkSchema>;
