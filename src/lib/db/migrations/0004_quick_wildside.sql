ALTER TABLE "job_search_profile" ADD COLUMN "employment_type" text DEFAULT 'any' NOT NULL;--> statement-breakpoint
ALTER TABLE "job_search_profile" ADD COLUMN "salary_min" integer;--> statement-breakpoint
ALTER TABLE "job_search_profile" ADD COLUMN "job_focus" text DEFAULT 'both' NOT NULL;
