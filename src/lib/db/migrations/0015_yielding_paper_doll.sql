CREATE TABLE "application_action_request" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"job_id" text NOT NULL,
	"artifact_id" text,
	"action" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"summary" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"claimed_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"error_summary" text,
	CONSTRAINT "application_action_request_action_check" CHECK ("application_action_request"."action" in ('send_email', 'submit_application')),
	CONSTRAINT "application_action_request_status_check" CHECK ("application_action_request"."status" in ('pending', 'approved', 'rejected', 'expired', 'executing', 'completed', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "application_artifact" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"job_id" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"used_at" timestamp with time zone,
	CONSTRAINT "application_artifact_kind_check" CHECK ("application_artifact"."kind" in ('research', 'outreach_email', 'cover_letter', 'application_answers', 'interview_prep'))
);
--> statement-breakpoint
ALTER TABLE "application" DROP CONSTRAINT "application_status_check";--> statement-breakpoint
ALTER TABLE "job_pipeline_event" DROP CONSTRAINT "job_pipeline_event_status_check";--> statement-breakpoint
ALTER TABLE "application" ALTER COLUMN "applied_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "application" ALTER COLUMN "applied_at" DROP NOT NULL;--> statement-breakpoint
UPDATE "application" SET "applied_at" = NULL WHERE "status" <> 'applied';--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "contact_name" text;--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "contact_email" text;--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "source_label" text;--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "follow_up_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "application_action_request" ADD CONSTRAINT "application_action_request_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_action_request" ADD CONSTRAINT "application_action_request_job_id_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."job"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_action_request" ADD CONSTRAINT "application_action_request_artifact_id_application_artifact_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."application_artifact"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_artifact" ADD CONSTRAINT "application_artifact_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_artifact" ADD CONSTRAINT "application_artifact_job_id_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."job"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "application_action_request_user_status_idx" ON "application_action_request" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "application_action_request_job_idx" ON "application_action_request" USING btree ("job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "application_action_request_user_idempotency_unique" ON "application_action_request" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "application_artifact_user_job_idx" ON "application_artifact" USING btree ("user_id","job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "application_artifact_user_idempotency_unique" ON "application_artifact" USING btree ("user_id","idempotency_key");--> statement-breakpoint
ALTER TABLE "application" ADD CONSTRAINT "application_status_check" CHECK ("application"."status" in ('draft', 'researched', 'needs_answers', 'tailored', 'ready_to_apply', 'approved', 'applied', 'interviewing', 'offered', 'rejected', 'withdrawn', 'closed'));--> statement-breakpoint
ALTER TABLE "job_pipeline_event" ADD CONSTRAINT "job_pipeline_event_status_check" CHECK ("job_pipeline_event"."status" in ('discovered', 'saved', 'rejected', 'researched', 'needs_answers', 'tailored', 'ready_to_apply', 'approved', 'applied', 'interviewing', 'offered', 'withdrawn', 'closed'));
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "record_direct_application_pipeline_event"() RETURNS trigger AS $$
BEGIN
	IF NEW."status" = 'draft' THEN
		RETURN NEW;
	END IF;
	IF TG_OP = 'UPDATE' AND OLD."status" IS NOT DISTINCT FROM NEW."status" THEN
		RETURN NEW;
	END IF;
	IF NEW."status" IN ('tailored', 'applied') AND EXISTS (
		SELECT 1 FROM "job_listing" WHERE "job_id" = NEW."job_id"
	) THEN
		RETURN NEW;
	END IF;

	INSERT INTO "job_pipeline_event" (
		"id", "user_id", "job_id", "status", "occurred_at"
	) VALUES (
		md5(random()::text || clock_timestamp()::text || NEW."id"),
		NEW."user_id",
		NEW."job_id",
		NEW."status",
		clock_timestamp()
	);
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
