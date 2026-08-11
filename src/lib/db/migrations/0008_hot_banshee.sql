ALTER TABLE "job_listing" ADD COLUMN "fingerprint" text;--> statement-breakpoint
CREATE UNIQUE INDEX "job_listing_profile_fingerprint_unique" ON "job_listing" USING btree ("profile_id","fingerprint");