"use client";

import { Pencil, Power, PowerOff, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import {
  deleteJobSourceAction,
  setJobSourceEnabledAction,
  updateJobSourceAction,
} from "@/app/actions/jobs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function JobSourceActions({
  sourceId,
  enabled,
  sourceLabel,
  sourceUrl,
}: {
  sourceId: string;
  enabled: boolean;
  sourceLabel: string;
  sourceUrl: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editorOpen, setEditorOpen] = useState(false);
  const [label, setLabel] = useState(sourceLabel);
  const [url, setUrl] = useState(sourceUrl);
  const [error, setError] = useState<string | null>(null);
  const ToggleIcon = enabled ? PowerOff : Power;

  function handleEditorOpen(open: boolean) {
    setEditorOpen(open);
    setError(null);
    if (open) {
      setLabel(sourceLabel);
      setUrl(sourceUrl);
    }
  }

  function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateJobSourceAction(sourceId, label, url);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEditorOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex shrink-0 gap-1">
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          disabled={isPending}
          title="Edit source"
          onClick={() => handleEditorOpen(true)}
        >
          <Pencil />
          <span className="sr-only">Edit source</span>
        </Button>
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
          <span className="sr-only">
            {enabled ? "Pause source" : "Enable source"}
          </span>
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
      <Dialog open={editorOpen} onOpenChange={handleEditorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit job source</DialogTitle>
            <DialogDescription>
              Update the label or public career-page URL for this profile.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`source-label-${sourceId}`}>Label</Label>
              <Input
                id={`source-label-${sourceId}`}
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`source-url-${sourceId}`}>Source URL</Label>
              <Input
                id={`source-url-${sourceId}`}
                type="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                required
              />
            </div>
            {error && (
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            )}
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save source"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
