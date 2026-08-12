"use client";

import { useActionState } from "react";
import {
  updateApplicationNotesAction,
  type ApplicationNotesFormState,
} from "@/app/actions/jobs";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { Textarea } from "@/components/ui/textarea";

const INITIAL_STATE: ApplicationNotesFormState = {
  error: null,
  saved: false,
};

export function ApplicationNotesForm({
  jobId,
  notes,
}: {
  jobId: string;
  notes: string | null;
}) {
  const [state, action] = useActionState(
    updateApplicationNotesAction.bind(null, jobId),
    INITIAL_STATE,
  );

  return (
    <form action={action} className="mt-3">
      <label
        htmlFor="application-notes"
        className="text-sm font-medium text-neutral-900 dark:text-neutral-100"
      >
        Private notes
      </label>
      <Textarea
        id="application-notes"
        name="notes"
        defaultValue={notes ?? ""}
        maxLength={4_000}
        rows={4}
        aria-describedby={state.error ? "application-notes-error" : undefined}
        aria-invalid={Boolean(state.error)}
        placeholder="Contacts, follow-up details, interview preparation, or reminders"
        className="mt-2 resize-y"
      />
      <div className="mt-2 flex min-h-8 items-center gap-3">
        <PendingSubmitButton
          type="submit"
          variant="outline"
          size="sm"
          pendingLabel="Saving..."
        >
          Save notes
        </PendingSubmitButton>
        {state.error ? (
          <p id="application-notes-error" className="text-xs text-red-600">
            {state.error}
          </p>
        ) : state.saved ? (
          <p role="status" className="text-xs text-emerald-700 dark:text-emerald-400">
            Notes saved.
          </p>
        ) : null}
      </div>
    </form>
  );
}
