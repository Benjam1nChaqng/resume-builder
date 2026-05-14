CREATE TABLE "bullet" (
	"id" text PRIMARY KEY NOT NULL,
	"experience_id" text NOT NULL,
	"text" text NOT NULL,
	"original_text" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_info" (
	"resume_id" text PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"email" text,
	"phone" text,
	"location" text,
	"links" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "education" (
	"id" text PRIMARY KEY NOT NULL,
	"resume_id" text NOT NULL,
	"school" text NOT NULL,
	"degree" text,
	"field" text,
	"start_date" date,
	"end_date" date,
	"gpa" numeric(3, 2),
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "experience" (
	"id" text PRIMARY KEY NOT NULL,
	"resume_id" text NOT NULL,
	"company" text NOT NULL,
	"role" text NOT NULL,
	"location" text,
	"start_date" date,
	"end_date" date,
	"current" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project" (
	"id" text PRIMARY KEY NOT NULL,
	"resume_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"link" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resume" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"source_pdf_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill" (
	"id" text PRIMARY KEY NOT NULL,
	"resume_id" text NOT NULL,
	"category" text,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bullet" ADD CONSTRAINT "bullet_experience_id_experience_id_fk" FOREIGN KEY ("experience_id") REFERENCES "public"."experience"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_info" ADD CONSTRAINT "contact_info_resume_id_resume_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resume"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "education" ADD CONSTRAINT "education_resume_id_resume_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resume"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experience" ADD CONSTRAINT "experience_resume_id_resume_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resume"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_resume_id_resume_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resume"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resume" ADD CONSTRAINT "resume_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill" ADD CONSTRAINT "skill_resume_id_resume_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resume"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bullet_experience_id_idx" ON "bullet" USING btree ("experience_id");--> statement-breakpoint
CREATE INDEX "education_resume_id_idx" ON "education" USING btree ("resume_id");--> statement-breakpoint
CREATE INDEX "experience_resume_id_idx" ON "experience" USING btree ("resume_id");--> statement-breakpoint
CREATE INDEX "project_resume_id_idx" ON "project" USING btree ("resume_id");--> statement-breakpoint
CREATE INDEX "resume_user_id_idx" ON "resume" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "skill_resume_id_idx" ON "skill" USING btree ("resume_id");