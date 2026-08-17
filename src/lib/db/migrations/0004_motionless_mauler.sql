ALTER TABLE "job_listing" ADD COLUMN IF NOT EXISTS "match_score" integer DEFAULT 0 NOT NULL;
