"use client";

import { Power, PowerOff, Trash2 } from "lucide-react";
import { useTransition } from "react";
import {
  deleteJobSourceAction,
  setJobSourceEnabledAction,
} from "@/app/actions/jobs";
import { Button } from "@/components/ui/button";

export function JobSourceActions({
  sourceId,
  enabled,
}: {
  sourceId: string;
  enabled: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const ToggleIcon = enabled ? PowerOff : Power;

  return (
    <div className="flex shrink-0 gap-1">
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        disabled={isPending}
        title={enabled ? "Pause source" : "Enable source"}
        onClick={() =>
          startTransition(() => setJobSourceEnabledAction(sourceId, !enabled))
        }
      >
        <ToggleIcon />
        <span className="sr-only">{enabled ? "Pause source" : "Enable source"}</span>
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        disabled={isPending}
        title="Delete source"
        onClick={() => {
          if (!window.confirm("Delete this job source?")) return;
          startTransition(() => deleteJobSourceAction(sourceId));
        }}
      >
        <Trash2 />
        <span className="sr-only">Delete source</span>
      </Button>
    </div>
  );
}
