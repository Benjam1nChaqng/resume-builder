ALTER TABLE "resume_job_fit" DROP CONSTRAINT "resume_job_fit_score_check";--> statement-breakpoint
ALTER TABLE "resume_job_fit" ALTER COLUMN "score" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "resume_job_fit" ADD COLUMN "status" text DEFAULT 'completed' NOT NULL;--> statement-breakpoint
ALTER TABLE "resume_job_fit" ADD COLUMN "error_summary" text;--> statement-breakpoint
ALTER TABLE "resume_job_fit" ADD CONSTRAINT "resume_job_fit_status_check" CHECK (("resume_job_fit"."status" = 'completed' and "resume_job_fit"."score" is not null and "resume_job_fit"."error_summary" is null) or ("resume_job_fit"."status" = 'failed' and "resume_job_fit"."score" is null and "resume_job_fit"."error_summary" is not null));--> statement-breakpoint
ALTER TABLE "resume_job_fit" ADD CONSTRAINT "resume_job_fit_score_check" CHECK ("resume_job_fit"."score" is null or "resume_job_fit"."score" between 0 and 100);