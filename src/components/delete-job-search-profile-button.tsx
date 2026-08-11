"use client";

import { Trash2 } from "lucide-react";
import { useTransition } from "react";
import { deleteJobSearchProfileAction } from "@/app/actions/jobs";
import { Button } from "@/components/ui/button";

export function DeleteJobSearchProfileButton({
  profileId,
}: {
  profileId: string;
}) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="destructive"
      disabled={isPending}
      onClick={() => {
        if (!window.confirm("Delete this search profile and its discovered listings?")) {
          return;
        }
        startTransition(() => deleteJobSearchProfileAction(profileId));
      }}
    >
      <Trash2 />
      {isPending ? "Deleting" : "Delete profile"}
    </Button>
  );
}
