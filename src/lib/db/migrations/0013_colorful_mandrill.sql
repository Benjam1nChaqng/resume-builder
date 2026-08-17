ALTER TABLE "job_search_profile" ADD COLUMN IF NOT EXISTS "employment_type" text DEFAULT 'any' NOT NULL;--> statement-breakpoint
ALTER TABLE "job_search_profile" ADD COLUMN IF NOT EXISTS "salary_min" integer;--> statement-breakpoint
ALTER TABLE "job_search_profile" ADD COLUMN IF NOT EXISTS "job_focus" text DEFAULT 'both' NOT NULL;
