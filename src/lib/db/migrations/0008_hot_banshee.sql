ALTER TABLE "job_listing" ADD COLUMN IF NOT EXISTS "fingerprint" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "job_listing_profile_fingerprint_unique" ON "job_listing" USING btree ("profile_id","fingerprint");
