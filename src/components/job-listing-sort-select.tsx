"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ChangeEvent } from "react";
import type { JobListingSort } from "@/lib/jobs/listing-view";

export function JobListingSortSelect({ value }: { value: JobListingSort }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", event.target.value);
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <label className="flex items-center gap-2 text-xs text-neutral-500">
      Sort
      <select
        value={value}
        onChange={handleChange}
        className="h-8 w-32 rounded-md border border-neutral-200 bg-white px-2 text-xs text-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"
      >
        <option value="relevance">Best match</option>
        <option value="newest">Newest</option>
        <option value="company">Company</option>
      </select>
    </label>
  );
}
