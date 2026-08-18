export const APPLICATION_STATUSES = [
  "draft",
  "researched",
  "needs_answers",
  "tailored",
  "ready_to_apply",
  "approved",
  "applied",
  "interviewing",
  "offered",
  "rejected",
  "withdrawn",
  "closed",
] as const;

export const APPLICATION_ARTIFACT_KINDS = [
  "research",
  "outreach_email",
  "cover_letter",
  "application_answers",
  "interview_prep",
] as const;

export const APPLICATION_ACTIONS = ["send_email", "submit_application"] as const;
