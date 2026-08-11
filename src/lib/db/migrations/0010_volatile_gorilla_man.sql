WITH preferred_resume AS (
	SELECT DISTINCT ON ("user_id", "job_id")
		"user_id",
		"job_id",
		"resume_id"
	FROM "application"
	WHERE "resume_id" IS NOT NULL
	ORDER BY "user_id", "job_id", "applied_at" DESC, "id" DESC
)
UPDATE "application" AS target
SET "resume_id" = preferred_resume."resume_id"
FROM preferred_resume
WHERE target."user_id" = preferred_resume."user_id"
	AND target."job_id" = preferred_resume."job_id"
	AND target."resume_id" IS NULL;
--> statement-breakpoint
WITH ranked_applications AS (
	SELECT
		"id",
		row_number() OVER (
			PARTITION BY "user_id", "job_id"
			ORDER BY
				CASE "status"
					WHEN 'applied' THEN 3
					WHEN 'tailored' THEN 2
					ELSE 1
				END DESC,
				("resume_id" IS NOT NULL) DESC,
				"applied_at" DESC,
				"id" DESC
		) AS rank
	FROM "application"
)
DELETE FROM "application"
USING ranked_applications
WHERE "application"."id" = ranked_applications."id"
	AND ranked_applications.rank > 1;
--> statement-breakpoint
CREATE UNIQUE INDEX "application_user_job_unique" ON "application" USING btree ("user_id","job_id");
