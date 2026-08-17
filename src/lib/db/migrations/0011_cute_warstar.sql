ALTER TABLE "resume_job_fit" ADD COLUMN IF NOT EXISTS "missing_preferred_requirements" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "resume_job_fit" ADD COLUMN IF NOT EXISTS "unsupported_claims" jsonb DEFAULT '[]'::jsonb NOT NULL;
