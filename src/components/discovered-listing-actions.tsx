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
    <div className="flex w-full gap-2 sm:w-auto">
      {status === "rejected" ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-full sm:w-auto"
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
        className="flex-1 sm:flex-none"
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
        className="flex-1 sm:flex-none"
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
