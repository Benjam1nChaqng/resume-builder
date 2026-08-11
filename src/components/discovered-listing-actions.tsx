"use client";

import { useTransition } from "react";
import {
  rejectDiscoveredListingAction,
  saveDiscoveredListingAction,
} from "@/app/actions/jobs";
import { Button } from "@/components/ui/button";

export function DiscoveredListingActions({
  listingId,
}: {
  listingId: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex gap-2">
      <Button
        type="button"
        size="sm"
        disabled={isPending}
        onClick={() =>
          startTransition(() => saveDiscoveredListingAction(listingId))
        }
      >
        Save
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() =>
          startTransition(() => rejectDiscoveredListingAction(listingId))
        }
      >
        Reject
      </Button>
    </div>
  );
}
