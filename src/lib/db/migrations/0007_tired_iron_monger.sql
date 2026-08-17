ALTER TABLE "application" DROP CONSTRAINT IF EXISTS "application_status_check";--> statement-breakpoint
ALTER TABLE "application" ADD CONSTRAINT "application_status_check" CHECK ("application"."status" in ('draft', 'tailored', 'applied'));--> statement-breakpoint
ALTER TABLE "job_discovery_run" DROP CONSTRAINT IF EXISTS "job_discovery_run_status_check";--> statement-breakpoint
ALTER TABLE "job_discovery_run" ADD CONSTRAINT "job_discovery_run_status_check" CHECK ("job_discovery_run"."status" in ('running', 'completed', 'partial', 'failed'));--> statement-breakpoint
ALTER TABLE "job_discovery_run" DROP CONSTRAINT IF EXISTS "job_discovery_run_inserted_count_check";--> statement-breakpoint
ALTER TABLE "job_discovery_run" ADD CONSTRAINT "job_discovery_run_inserted_count_check" CHECK ("job_discovery_run"."inserted_count" >= 0);--> statement-breakpoint
ALTER TABLE "job_listing" DROP CONSTRAINT IF EXISTS "job_listing_status_check";--> statement-breakpoint
ALTER TABLE "job_listing" ADD CONSTRAINT "job_listing_status_check" CHECK ("job_listing"."status" in ('discovered', 'saved', 'rejected', 'tailored', 'applied'));--> statement-breakpoint
ALTER TABLE "job_listing" DROP CONSTRAINT IF EXISTS "job_listing_match_score_check";--> statement-breakpoint
ALTER TABLE "job_listing" ADD CONSTRAINT "job_listing_match_score_check" CHECK ("job_listing"."match_score" between 0 and 100);--> statement-breakpoint
ALTER TABLE "job_search_profile" DROP CONSTRAINT IF EXISTS "job_search_profile_remote_preference_check";--> statement-breakpoint
ALTER TABLE "job_search_profile" ADD CONSTRAINT "job_search_profile_remote_preference_check" CHECK ("job_search_profile"."remote_preference" in ('any', 'remote', 'hybrid', 'onsite'));--> statement-breakpoint
ALTER TABLE "resume_job_fit" DROP CONSTRAINT IF EXISTS "resume_job_fit_score_check";--> statement-breakpoint
ALTER TABLE "resume_job_fit" ADD CONSTRAINT "resume_job_fit_score_check" CHECK ("resume_job_fit"."score" between 0 and 100);
