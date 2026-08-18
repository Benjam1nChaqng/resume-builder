export type JobNotice = {
  message: string;
  tone: "success" | "warning";
};

function safeCount(value: string | undefined): number {
  const count = Number.parseInt(value ?? "", 10);
  return Number.isInteger(count) && count >= 0 ? Math.min(count, 10_000) : 0;
}

export function getJobNotice(
  code: string | undefined,
  countValue?: string,
): JobNotice | null {
  const count = safeCount(countValue);
  const notices: Record<string, JobNotice> = {
    "profile-created": {
      message: "Saved search created.",
      tone: "success",
    },
    "profile-updated": {
      message: "Search criteria saved.",
      tone: "success",
    },
    "profile-deleted": {
      message: "Saved search deleted.",
      tone: "success",
    },
    "source-added": { message: "Job source added.", tone: "success" },
    "source-enabled": { message: "Job source enabled.", tone: "success" },
    "source-paused": { message: "Job source paused.", tone: "success" },
    "source-deleted": { message: "Job source deleted.", tone: "success" },
    "discovery-complete": {
      message: `Discovery finished with ${count} new listing${count === 1 ? "" : "s"}.`,
      tone: "success",
    },
    "discovery-partial": {
      message: `Discovery added ${count} new listing${count === 1 ? "" : "s"}, but at least one source failed.`,
      tone: "warning",
    },
    "listing-saved": {
      message: "Listing saved and job details imported.",
      tone: "success",
    },
    "listing-rejected": { message: "Listing rejected.", tone: "success" },
    "listing-restored": { message: "Listing restored.", tone: "success" },
    "fit-complete": { message: "Resume fit check completed.", tone: "success" },
    "fit-failed": {
      message: "The fit check could not complete. Its safe failure details are shown below.",
      tone: "warning",
    },
    "tailored-created": {
      message: "Tailored resume created. Review it or download the PDF below.",
      tone: "success",
    },
    "action-approved": {
      message: "Action approved for 30 minutes.",
      tone: "success",
    },
    "action-rejected": {
      message: "Action rejected. No external action was taken.",
      tone: "success",
    },
    applied: { message: "Application marked as applied.", tone: "success" },
  };

  return code ? (notices[code] ?? null) : null;
}
