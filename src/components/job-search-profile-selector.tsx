"use client";

import { useTransition } from "react";
import { selectJobSearchProfileAction } from "@/app/actions/jobs";

export function JobSearchProfileSelector({
  profiles,
  selectedId,
}: {
  profiles: Array<{ id: string; candidateName: string }>;
  selectedId: string;
}) {
  const [isPending, startTransition] = useTransition();
  return (
    <select
      aria-label="Search profile"
      value={selectedId}
      disabled={isPending}
      onChange={(event) => {
        const profileId = event.target.value;
        startTransition(() => selectJobSearchProfileAction(profileId));
      }}
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
