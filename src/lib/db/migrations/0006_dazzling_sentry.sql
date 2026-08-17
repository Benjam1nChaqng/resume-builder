ALTER TABLE "job_listing" ADD COLUMN IF NOT EXISTS "employment_type" text;--> statement-breakpoint
ALTER TABLE "job_listing" ADD COLUMN IF NOT EXISTS "compensation_text" text;--> statement-breakpoint
ALTER TABLE "job_listing" ADD COLUMN IF NOT EXISTS "posted_at" timestamp with time zone;
