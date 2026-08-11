"use client";

import { useTransition } from "react";
import {
  rejectDiscoveredListingAction,
  restoreDiscoveredListingAction,
  saveDiscoveredListingAction,
} from "@/app/actions/jobs";
import { Button } from "@/components/ui/button";

export function DiscoveredListingActions({
  listingId,
  status = "discovered",
}: {
  listingId: string;
  status?: "discovered" | "rejected";
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex gap-2">
      {status === "rejected" ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() =>
            startTransition(() => restoreDiscoveredListingAction(listingId))
          }
        >
          {isPending ? "Restoring..." : "Restore"}
        </Button>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
