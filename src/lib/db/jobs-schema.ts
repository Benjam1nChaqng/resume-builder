import { randomUUID } from "node:crypto";
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  uniqueIndex,
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

export type JobSearchFilters = {
  partTime: boolean;
  hourly: boolean;
  entryLevel: boolean;
  retail: boolean;
  admin: boolean;
  service: boolean;
  warehouse: boolean;
  internship: boolean;
};

export type ResumeJobFitFinding = {
  label: string;
  evidence: string;
};

export type ResumeJobFitModelMetadata = {
  model: string;
  checkedAt: string;
};

export const jobSearchProfile = pgTable(
  "job_search_profile",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    candidateName: text("candidate_name").notNull(),
    targetRoles: jsonb("target_roles").$type<string[]>().notNull(),
    locationPreference: text("location_preference"),
    remotePreference: text("remote_preference").default("any").notNull(),
    experienceLevel: text("experience_level"),
    keywords: jsonb("keywords")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    exclusions: jsonb("exclusions")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    basicJobFilters: jsonb("basic_job_filters")
      .$type<JobSearchFilters>()
      .default(
        sql`'{"partTime":false,"hourly":false,"entryLevel":false,"retail":false,"admin":false,"service":false,"warehouse":false,"internship":false}'::jsonb`,
      )
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("job_search_profile_user_id_idx").on(table.userId)],
);

export const jobSource = pgTable(
  "job_source",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    profileId: text("profile_id")
      .notNull()
      .references(() => jobSearchProfile.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    url: text("url").notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("job_source_profile_id_idx").on(table.profileId),
    uniqueIndex("job_source_profile_url_unique").on(table.profileId, table.url),
  ],
);

export const jobDiscoveryRun = pgTable(
  "job_discovery_run",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    profileId: text("profile_id")
      .notNull()
      .references(() => jobSearchProfile.id, { onDelete: "cascade" }),
    status: text("status").default("running").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    errorSummary: text("error_summary"),
  },
  (table) => [index("job_discovery_run_profile_id_idx").on(table.profileId)],
);

export const jobListing = pgTable(
  "job_listing",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    profileId: text("profile_id")
      .notNull()
      .references(() => jobSearchProfile.id, { onDelete: "cascade" }),
    sourceId: text("source_id").references(() => jobSource.id, {
      onDelete: "set null",
    }),
    jobId: text("job_id").references(() => job.id, { onDelete: "set null" }),
    canonicalUrl: text("canonical_url").notNull(),
    title: text("title").notNull(),
    company: text("company"),
    location: text("location"),
    status: text("status").default("discovered").notNull(),
    discoveredAt: timestamp("discovered_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("job_listing_profile_id_idx").on(table.profileId),
    uniqueIndex("job_listing_profile_url_unique").on(
      table.profileId,
      table.canonicalUrl,
    ),
  ],
);

export const resumeJobFit = pgTable(
  "resume_job_fit",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    jobId: text("job_id")
      .notNull()
      .references(() => job.id, { onDelete: "cascade" }),
    resumeId: text("resume_id")
      .notNull()
      .references(() => resume.id, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    matchingEvidence: jsonb("matching_evidence")
      .$type<ResumeJobFitFinding[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    missingRequirements: jsonb("missing_requirements")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    concerns: jsonb("concerns")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    recommendations: jsonb("recommendations")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    modelMetadata: jsonb("model_metadata").$type<ResumeJobFitModelMetadata>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("resume_job_fit_user_id_idx").on(table.userId),
    index("resume_job_fit_job_resume_idx").on(table.jobId, table.resumeId),
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

export const jobSearchProfileRelations = relations(
  jobSearchProfile,
  ({ one, many }) => ({
    user: one(user, { fields: [jobSearchProfile.userId], references: [user.id] }),
    sources: many(jobSource),
    runs: many(jobDiscoveryRun),
    listings: many(jobListing),
  }),
);

export const jobSourceRelations = relations(jobSource, ({ one }) => ({
  profile: one(jobSearchProfile, {
    fields: [jobSource.profileId],
    references: [jobSearchProfile.id],
  }),
}));

export const jobDiscoveryRunRelations = relations(
  jobDiscoveryRun,
  ({ one }) => ({
    profile: one(jobSearchProfile, {
      fields: [jobDiscoveryRun.profileId],
      references: [jobSearchProfile.id],
    }),
  }),
);

export const jobListingRelations = relations(jobListing, ({ one }) => ({
  profile: one(jobSearchProfile, {
    fields: [jobListing.profileId],
    references: [jobSearchProfile.id],
  }),
  source: one(jobSource, {
    fields: [jobListing.sourceId],
    references: [jobSource.id],
  }),
  job: one(job, { fields: [jobListing.jobId], references: [job.id] }),
}));

export const resumeJobFitRelations = relations(resumeJobFit, ({ one }) => ({
  user: one(user, { fields: [resumeJobFit.userId], references: [user.id] }),
  job: one(job, { fields: [resumeJobFit.jobId], references: [job.id] }),
  resume: one(resume, {
    fields: [resumeJobFit.resumeId],
    references: [resume.id],
  }),
}));
