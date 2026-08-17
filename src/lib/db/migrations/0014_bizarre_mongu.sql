CREATE TABLE "agent_access_token" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"token_prefix" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "agent_access_token" ADD CONSTRAINT "agent_access_token_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_access_token_user_id_idx" ON "agent_access_token" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_access_token_hash_unique" ON "agent_access_token" USING btree ("token_hash");