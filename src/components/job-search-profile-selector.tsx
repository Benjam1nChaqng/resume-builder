"use client";

import { useRouter } from "next/navigation";

export function JobSearchProfileSelector({
  profiles,
  selectedId,
}: {
  profiles: Array<{ id: string; candidateName: string }>;
  selectedId: string;
}) {
  const router = useRouter();
  return (
    <select
      aria-label="Search profile"
      value={selectedId}
      onChange={(event) =>
        router.push(`/jobs/discover?profile=${encodeURIComponent(event.target.value)}`)
      }
      className="h-9 min-w-48 rounded-md border border-neutral-200 bg-white px-3 text-sm dark:border-neutral-800 dark:bg-neutral-950"
    >
      {profiles.map((profile) => (
        <option key={profile.id} value={profile.id}>
          {profile.candidateName}
        </option>
      ))}
    </select>
  );
}
