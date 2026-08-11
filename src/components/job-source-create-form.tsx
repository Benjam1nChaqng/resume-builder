"use client";

import { useActionState } from "react";
import {
  createJobSourceAction,
  type JobDiscoveryFormState,
} from "@/app/actions/jobs";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const INITIAL_STATE: JobDiscoveryFormState = {
  fieldErrors: {},
  formError: null,
};

export function JobSourceCreateForm({ profileId }: { profileId: string }) {
  const [state, action] = useActionState(createJobSourceAction, INITIAL_STATE);
  const labelError = state.fieldErrors.label?.[0];
  const urlError = state.fieldErrors.url?.[0];

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="profileId" value={profileId} />
      <div className="space-y-2">
        <Label htmlFor="source-label">Label</Label>
        <Input
          id="source-label"
          name="label"
          placeholder="Local coffee shops"
          defaultValue={state.values?.label}
          required
          aria-invalid={Boolean(labelError)}
          aria-describedby={labelError ? "source-label-error" : undefined}
        />
        {labelError && (
          <p
            id="source-label-error"
            role="alert"
            className="text-xs text-red-700 dark:text-red-300"
          >
            {labelError}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="source-url">Source URL</Label>
        <Input
          id="source-url"
          name="url"
          type="url"
          placeholder="https://example.com/careers"
          defaultValue={state.values?.url}
          required
          aria-invalid={Boolean(urlError)}
          aria-describedby={urlError ? "source-url-error" : undefined}
        />
        {urlError && (
          <p
            id="source-url-error"
            role="alert"
            className="text-xs text-red-700 dark:text-red-300"
          >
            {urlError}
          </p>
        )}
      </div>
      {state.formError && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {state.formError}
        </p>
      )}
      <PendingSubmitButton
        type="submit"
        variant="outline"
        className="w-full"
        pendingLabel="Adding"
      >
        Add source
      </PendingSubmitButton>
    </form>
  );
}
