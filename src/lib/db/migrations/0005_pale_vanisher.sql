ALTER TABLE "job_discovery_run" ADD COLUMN IF NOT EXISTS "inserted_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "job_discovery_run" ADD COLUMN IF NOT EXISTS "source_results" jsonb DEFAULT '[]'::jsonb NOT NULL;
