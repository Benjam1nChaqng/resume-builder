CREATE TABLE "job_search_profile" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"candidate_name" text NOT NULL,
	"target_roles" jsonb NOT NULL,
	"location_preference" text,
	"remote_preference" text DEFAULT 'any' NOT NULL,
	"experience_level" text,
	"keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"exclusions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"basic_job_filters" jsonb DEFAULT '{"partTime":false,"hourly":false,"entryLevel":false,"retail":false,"admin":false,"service":false,"warehouse":false,"internship":false}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_source" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"label" text NOT NULL,
	"url" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_discovery_run" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"error_summary" text
);
--> statement-breakpoint
CREATE TABLE "job_listing" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"source_id" text,
	"job_id" text,
	"canonical_url" text NOT NULL,
	"title" text NOT NULL,
	"company" text,
	"location" text,
	"status" text DEFAULT 'discovered' NOT NULL,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resume_job_fit" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"job_id" text NOT NULL,
	"resume_id" text NOT NULL,
	"score" integer NOT NULL,
	"matching_evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"missing_requirements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"concerns" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"recommendations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model_metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_search_profile" ADD CONSTRAINT "job_search_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_source" ADD CONSTRAINT "job_source_profile_id_job_search_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."job_search_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_discovery_run" ADD CONSTRAINT "job_discovery_run_profile_id_job_search_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."job_search_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_listing" ADD CONSTRAINT "job_listing_profile_id_job_search_profile_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."job_search_profile"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_listing" ADD CONSTRAINT "job_listing_source_id_job_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."job_source"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_listing" ADD CONSTRAINT "job_listing_job_id_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."job"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_job_fit" ADD CONSTRAINT "resume_job_fit_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_job_fit" ADD CONSTRAINT "resume_job_fit_job_id_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."job"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume_job_fit" ADD CONSTRAINT "resume_job_fit_resume_id_resume_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resume"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "job_search_profile_user_id_idx" ON "job_search_profile" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "job_source_profile_id_idx" ON "job_source" USING btree ("profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "job_source_profile_url_unique" ON "job_source" USING btree ("profile_id","url");--> statement-breakpoint
CREATE INDEX "job_discovery_run_profile_id_idx" ON "job_discovery_run" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "job_listing_profile_id_idx" ON "job_listing" USING btree ("profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "job_listing_profile_url_unique" ON "job_listing" USING btree ("profile_id","canonical_url");--> statement-breakpoint
CREATE INDEX "resume_job_fit_user_id_idx" ON "resume_job_fit" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "resume_job_fit_job_resume_idx" ON "resume_job_fit" USING btree ("job_id","resume_id");
