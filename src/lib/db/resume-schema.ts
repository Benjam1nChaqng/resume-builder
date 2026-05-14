import { randomUUID } from "node:crypto";
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export type ContactLink = { label: string; url: string };

export const resume = pgTable(
  "resume",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    sourcePdfUrl: text("source_pdf_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("resume_user_id_idx").on(table.userId)],
);

export const contactInfo = pgTable("contact_info", {
  resumeId: text("resume_id")
    .primaryKey()
    .references(() => resume.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  location: text("location"),
  links: jsonb("links").$type<ContactLink[]>().default(sql`'[]'::jsonb`).notNull(),
});

export const experience = pgTable(
  "experience",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    resumeId: text("resume_id")
      .notNull()
      .references(() => resume.id, { onDelete: "cascade" }),
    company: text("company").notNull(),
    role: text("role").notNull(),
    location: text("location"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    current: boolean("current").default(false).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
  },
  (table) => [index("experience_resume_id_idx").on(table.resumeId)],
);

export const bullet = pgTable(
  "bullet",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    experienceId: text("experience_id")
      .notNull()
      .references(() => experience.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    originalText: text("original_text"),
    sortOrder: integer("sort_order").default(0).notNull(),
  },
  (table) => [index("bullet_experience_id_idx").on(table.experienceId)],
);

export const education = pgTable(
  "education",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    resumeId: text("resume_id")
      .notNull()
      .references(() => resume.id, { onDelete: "cascade" }),
    school: text("school").notNull(),
    degree: text("degree"),
    field: text("field"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    gpa: numeric("gpa", { precision: 3, scale: 2 }),
    sortOrder: integer("sort_order").default(0).notNull(),
  },
  (table) => [index("education_resume_id_idx").on(table.resumeId)],
);

export const skill = pgTable(
  "skill",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    resumeId: text("resume_id")
      .notNull()
      .references(() => resume.id, { onDelete: "cascade" }),
    category: text("category"),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
  },
  (table) => [index("skill_resume_id_idx").on(table.resumeId)],
);

export const project = pgTable(
  "project",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    resumeId: text("resume_id")
      .notNull()
      .references(() => resume.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    link: text("link"),
    sortOrder: integer("sort_order").default(0).notNull(),
  },
  (table) => [index("project_resume_id_idx").on(table.resumeId)],
);

export const resumeRelations = relations(resume, ({ one, many }) => ({
  user: one(user, { fields: [resume.userId], references: [user.id] }),
  contactInfo: one(contactInfo, {
    fields: [resume.id],
    references: [contactInfo.resumeId],
  }),
  experiences: many(experience),
  educations: many(education),
  skills: many(skill),
  projects: many(project),
}));

export const contactInfoRelations = relations(contactInfo, ({ one }) => ({
  resume: one(resume, {
    fields: [contactInfo.resumeId],
    references: [resume.id],
  }),
}));

export const experienceRelations = relations(experience, ({ one, many }) => ({
  resume: one(resume, {
    fields: [experience.resumeId],
    references: [resume.id],
  }),
  bullets: many(bullet),
}));

export const bulletRelations = relations(bullet, ({ one }) => ({
  experience: one(experience, {
    fields: [bullet.experienceId],
    references: [experience.id],
  }),
}));

export const educationRelations = relations(education, ({ one }) => ({
  resume: one(resume, {
    fields: [education.resumeId],
    references: [resume.id],
  }),
}));

export const skillRelations = relations(skill, ({ one }) => ({
  resume: one(resume, {
    fields: [skill.resumeId],
    references: [resume.id],
  }),
}));

export const projectRelations = relations(project, ({ one }) => ({
  resume: one(resume, {
    fields: [project.resumeId],
    references: [resume.id],
  }),
}));
