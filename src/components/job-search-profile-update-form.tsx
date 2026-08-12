"use client";

import { useActionState } from "react";
import {
  type JobDiscoveryFormState,
  updateJobSearchProfileAction,
} from "@/app/actions/jobs";
import { DeleteJobSearchProfileButton } from "@/components/delete-job-search-profile-button";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BASIC_JOB_FILTERS } from "@/lib/jobs/discovery-constants";

const INITIAL_STATE: JobDiscoveryFormState = {
  fieldErrors: {},
  formError: null,
};

const FILTER_LABELS: Record<(typeof BASIC_JOB_FILTERS)[number], string> = {
  partTime: "Part-time",
  hourly: "Hourly",
  entryLevel: "Entry-level",
  retail: "Retail",
  admin: "Admin",
  service: "Service",
  warehouse: "Warehouse",
  internship: "Internship",
};

type Profile = {
  id: string;
  candidateName: string;
  targetRoles: string[];
  locationPreference: string | null;
  remotePreference: string;
  experienceLevel: string | null;
  keywords: string[];
  exclusions: string[];
  basicJobFilters: Record<(typeof BASIC_JOB_FILTERS)[number], boolean>;
};

export function JobSearchProfileUpdateForm({ profile }: { profile: Profile }) {
  const [state, action] = useActionState(
    updateJobSearchProfileAction,
    INITIAL_STATE,
  );
  const value = (name: string, initial: string) =>
    state.submitted ? (state.values?.[name] ?? "") : initial;

  return (
    <form action={action} className="mt-4 grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="profileId" value={profile.id} />
      <Field
        profileId={profile.id}
        name="candidateName"
        label="Candidate"
        placeholder="Maya"
        defaultValue={value("candidateName", profile.candidateName)}
        error={state.fieldErrors.candidateName?.[0]}
        required
      />
      <Field
        profileId={profile.id}
        name="targetRoles"
        label="Target roles"
        placeholder="barista, office assistant"
        defaultValue={value("targetRoles", profile.targetRoles.join(", "))}
        error={state.fieldErrors.targetRoles?.[0]}
        required
      />
      <Field
        profileId={profile.id}
        name="locationPreference"
        label="Location"
        placeholder="Los Angeles or remote"
        defaultValue={value(
          "locationPreference",
          profile.locationPreference ?? "",
        )}
        error={state.fieldErrors.locationPreference?.[0]}
      />
      <div className="space-y-2">
        <Label htmlFor={`edit-${profile.id}-remotePreference`}>Remote</Label>
        <select
          id={`edit-${profile.id}-remotePreference`}
          name="remotePreference"
          defaultValue={value("remotePreference", profile.remotePreference)}
          className="h-9 w-full rounded-md border border-neutral-200 bg-transparent px-3 text-sm dark:border-neutral-800"
        >
          <option value="any">Any</option>
          <option value="remote">Remote</option>
          <option value="hybrid">Hybrid</option>
          <option value="onsite">Onsite</option>
        </select>
      </div>
      <Field
        profileId={profile.id}
        name="experienceLevel"
        label="Level"
        placeholder="entry"
        defaultValue={value("experienceLevel", profile.experienceLevel ?? "")}
        error={state.fieldErrors.experienceLevel?.[0]}
      />
      <Field
        profileId={profile.id}
        name="keywords"
        label="Keywords"
        placeholder="cashier, mornings"
        defaultValue={value("keywords", profile.keywords.join(", "))}
        error={state.fieldErrors.keywords?.[0]}
      />
      <Field
        profileId={profile.id}
        name="exclusions"
        label="Exclusions"
        placeholder="night shift"
        defaultValue={value("exclusions", profile.exclusions.join(", "))}
        error={state.fieldErrors.exclusions?.[0]}
      />
      <div className="grid gap-2 text-sm min-[340px]:grid-cols-2 sm:col-span-2">
        {BASIC_JOB_FILTERS.map((filter) => (
          <label key={filter} className="flex items-center gap-2">
            <input
              type="checkbox"
              name={filter}
              defaultChecked={
                state.submitted
                  ? state.values?.[filter] === "on"
                  : profile.basicJobFilters[filter]
              }
            />
            {FILTER_LABELS[filter]}
          </label>
        ))}
      </div>
      {state.formError && (
        <p
          role="alert"
          className="text-sm text-red-700 dark:text-red-300 sm:col-span-2"
        >
          {state.formError}
        </p>
      )}
      <div className="flex flex-col gap-2 min-[380px]:flex-row min-[380px]:flex-wrap sm:col-span-2">
        <PendingSubmitButton type="submit" pendingLabel="Saving" className="w-full min-[380px]:w-auto">
          Save criteria
        </PendingSubmitButton>
        <DeleteJobSearchProfileButton profileId={profile.id} />
      </div>
    </form>
  );
}

function Field({
  profileId,
  name,
  label,
  placeholder,
  defaultValue,
  error,
  required = false,
}: {
  profileId: string;
  name: string;
  label: string;
  placeholder: string;
  defaultValue: string;
  error?: string;
  required?: boolean;
}) {
  const id = `edit-${profileId}-${name}`;
  const errorId = `${id}-error`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        placeholder={placeholder}
        defaultValue={defaultValue}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      />
      {error && (
        <p
          id={errorId}
          role="alert"
          className="text-xs text-red-700 dark:text-red-300"
        >
          {error}
        </p>
      )}
    </div>
  );
}
