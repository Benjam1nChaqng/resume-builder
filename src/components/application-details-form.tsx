"use client";

import { useActionState } from "react";
import {
  updateApplicationDetailsAction,
  type ApplicationDetailsFormState,
} from "@/app/actions/jobs";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { APPLICATION_STATUSES } from "@/lib/jobs/application-constants";

const INITIAL_STATE: ApplicationDetailsFormState = {
  error: null,
  saved: false,
};

const STATUS_LABELS: Record<(typeof APPLICATION_STATUSES)[number], string> = {
  draft: "Draft",
  researched: "Researched",
  needs_answers: "Needs answers",
  tailored: "Tailored",
  ready_to_apply: "Ready to apply",
  approved: "Approved",
  applied: "Applied",
  interviewing: "Interviewing",
  offered: "Offered",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  closed: "Closed",
};

type ApplicationDetails = {
  status: string;
  notes: string | null;
  contactName: string | null;
  contactEmail: string | null;
  sourceLabel: string | null;
  followUpAt: Date | null;
};

export function ApplicationDetailsForm({
  jobId,
  application,
}: {
  jobId: string;
  application: ApplicationDetails | null;
}) {
  const [state, action] = useActionState(
    updateApplicationDetailsAction.bind(null, jobId),
    INITIAL_STATE,
  );
  const selectedStatus = APPLICATION_STATUSES.includes(
    application?.status as (typeof APPLICATION_STATUSES)[number],
  )
    ? application!.status
    : "draft";

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="application-status">Status</Label>
          <select
            id="application-status"
            name="status"
            defaultValue={selectedStatus}
            className="h-9 w-full rounded-md border border-neutral-200 bg-transparent px-3 text-sm dark:border-neutral-800"
          >
            {APPLICATION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="application-follow-up">Follow-up date</Label>
          <Input
            id="application-follow-up"
            name="followUpAt"
            type="date"
            defaultValue={application?.followUpAt?.toISOString().slice(0, 10) ?? ""}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="application-contact-name">Contact</Label>
          <Input
            id="application-contact-name"
            name="contactName"
            maxLength={200}
            defaultValue={application?.contactName ?? ""}
            placeholder="Recruiter or hiring manager"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="application-contact-email">Contact email</Label>
          <Input
            id="application-contact-email"
            name="contactEmail"
            type="email"
            maxLength={320}
            defaultValue={application?.contactEmail ?? ""}
            placeholder="name@company.com"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="application-source">Application source</Label>
          <Input
            id="application-source"
            name="sourceLabel"
            maxLength={200}
            defaultValue={application?.sourceLabel ?? ""}
            placeholder="Employer site, referral, recruiter, or job board"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="application-notes">Private notes</Label>
        <Textarea
          id="application-notes"
          name="notes"
          defaultValue={application?.notes ?? ""}
          maxLength={4_000}
          rows={5}
          placeholder="Contacts, application details, interview preparation, and reminders"
          className="resize-y"
        />
      </div>

      <div className="flex min-h-8 items-center gap-3">
        <PendingSubmitButton
          type="submit"
          variant="outline"
          size="sm"
          pendingLabel="Saving..."
        >
          Save application
        </PendingSubmitButton>
        {state.error ? (
          <p className="text-xs text-red-600 dark:text-red-400">{state.error}</p>
        ) : state.saved ? (
          <p role="status" className="text-xs text-emerald-700 dark:text-emerald-400">
            Application saved.
          </p>
        ) : null}
      </div>
    </form>
  );
}
