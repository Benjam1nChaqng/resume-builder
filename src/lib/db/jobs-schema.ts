import { randomUUID } from "node:crypto";
import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { resume } from "./resume-schema";

export const job = pgTable(
  "job",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sourceUrl: text("source_url").notNull(),
    title: text("title").notNull(),
    company: text("company").notNull(),
    location: text("location"),
    description: text("description").notNull(),
    requirements: jsonb("requirements")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    niceToHaves: jsonb("nice_to_haves").$type<string[]>(),
    seniority: text("seniority"),
    salaryMin: integer("salary_min"),
    salaryMax: integer("salary_max"),
    scrapedAt: timestamp("scraped_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("job_user_id_idx").on(table.userId)],
);

export const application = pgTable(
  "application",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    jobId: text("job_id")
      .notNull()
      .references(() => job.id, { onDelete: "cascade" }),
    resumeId: text("resume_id").references(() => resume.id, {
      onDelete: "set null",
    }),
    status: text("status").default("draft").notNull(),
    appliedAt: timestamp("applied_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("application_user_id_idx").on(table.userId),
    index("application_job_id_idx").on(table.jobId),
  ],
);

export const jobRelations = relations(job, ({ one, many }) => ({
  user: one(user, { fields: [job.userId], references: [user.id] }),
  applications: many(application),
}));

export const applicationRelations = relations(application, ({ one }) => ({
  user: one(user, { fields: [application.userId], references: [user.id] }),
  job: one(job, { fields: [application.jobId], references: [job.id] }),
  resume: one(resume, {
    fields: [application.resumeId],
    references: [resume.id],
  }),
}));
