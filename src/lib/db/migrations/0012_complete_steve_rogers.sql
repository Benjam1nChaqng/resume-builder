CREATE TABLE IF NOT EXISTS "job_pipeline_event" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"job_id" text,
	"listing_id" text,
	"status" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_pipeline_event_subject_check" CHECK ("job_pipeline_event"."job_id" is not null or "job_pipeline_event"."listing_id" is not null),
	CONSTRAINT "job_pipeline_event_status_check" CHECK ("job_pipeline_event"."status" in ('discovered', 'saved', 'rejected', 'tailored', 'applied'))
);
--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN IF NOT EXISTS "notes" text;--> statement-breakpoint
ALTER TABLE "job_pipeline_event" DROP CONSTRAINT IF EXISTS "job_pipeline_event_user_id_user_id_fk";--> statement-breakpoint
ALTER TABLE "job_pipeline_event" ADD CONSTRAINT "job_pipeline_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_pipeline_event" DROP CONSTRAINT IF EXISTS "job_pipeline_event_job_id_job_id_fk";--> statement-breakpoint
ALTER TABLE "job_pipeline_event" ADD CONSTRAINT "job_pipeline_event_job_id_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."job"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_pipeline_event" DROP CONSTRAINT IF EXISTS "job_pipeline_event_listing_id_job_listing_id_fk";--> statement-breakpoint
ALTER TABLE "job_pipeline_event" ADD CONSTRAINT "job_pipeline_event_listing_id_job_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."job_listing"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_pipeline_event_user_job_idx" ON "job_pipeline_event" USING btree ("user_id","job_id","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_pipeline_event_listing_idx" ON "job_pipeline_event" USING btree ("listing_id","occurred_at");--> statement-breakpoint
CREATE OR REPLACE FUNCTION "record_job_listing_pipeline_event"() RETURNS trigger AS $$
DECLARE
	"owner_user_id" text;
BEGIN
	SELECT "user_id" INTO "owner_user_id"
	FROM "job_search_profile"
	WHERE "id" = NEW."profile_id";

	INSERT INTO "job_pipeline_event" (
		"id", "user_id", "job_id", "listing_id", "status", "occurred_at"
	) VALUES (
		md5(random()::text || clock_timestamp()::text || NEW."id"),
		"owner_user_id",
		NEW."job_id",
		NEW."id",
		NEW."status",
		clock_timestamp()
	);
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER IF EXISTS "job_listing_pipeline_event_trigger" ON "job_listing";--> statement-breakpoint
CREATE TRIGGER "job_listing_pipeline_event_trigger"
AFTER UPDATE OF "status" ON "job_listing"
FOR EACH ROW
WHEN (OLD."status" IS DISTINCT FROM NEW."status")
EXECUTE FUNCTION "record_job_listing_pipeline_event"();--> statement-breakpoint
CREATE OR REPLACE FUNCTION "record_direct_application_pipeline_event"() RETURNS trigger AS $$
BEGIN
	IF NEW."status" NOT IN ('tailored', 'applied') THEN
		RETURN NEW;
	END IF;
	IF TG_OP = 'UPDATE' AND OLD."status" IS NOT DISTINCT FROM NEW."status" THEN
		RETURN NEW;
	END IF;
	IF EXISTS (
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
$$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER IF EXISTS "direct_application_pipeline_insert_event_trigger" ON "application";--> statement-breakpoint
CREATE TRIGGER "direct_application_pipeline_insert_event_trigger"
AFTER INSERT ON "application"
FOR EACH ROW
EXECUTE FUNCTION "record_direct_application_pipeline_event"();--> statement-breakpoint
DROP TRIGGER IF EXISTS "direct_application_pipeline_update_event_trigger" ON "application";--> statement-breakpoint
CREATE TRIGGER "direct_application_pipeline_update_event_trigger"
AFTER UPDATE OF "status" ON "application"
FOR EACH ROW
EXECUTE FUNCTION "record_direct_application_pipeline_event"();
