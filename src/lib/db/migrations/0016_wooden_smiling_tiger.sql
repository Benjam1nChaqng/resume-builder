ALTER TABLE "application_action_request" ADD COLUMN "claimed_by_token_id" text;--> statement-breakpoint
ALTER TABLE "application_action_request" ADD CONSTRAINT "application_action_request_claimed_by_token_id_agent_access_token_id_fk" FOREIGN KEY ("claimed_by_token_id") REFERENCES "public"."agent_access_token"("id") ON DELETE set null ON UPDATE no action;
