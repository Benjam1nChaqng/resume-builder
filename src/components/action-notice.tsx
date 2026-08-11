import { getJobNotice } from "@/lib/jobs/notices";

export function ActionNotice({
  code,
  count,
}: {
  code?: string;
  count?: string;
}) {
  const notice = getJobNotice(code, count);
  if (!notice) return null;

  return (
    <div
      role="status"
      className={`mt-4 border-l-4 px-4 py-3 text-sm ${
        notice.tone === "warning"
          ? "border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
          : "border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
      }`}
    >
      {notice.message}
    </div>
  );
}
