"use client";

import { useActionState } from "react";
import {
  createJobSearchProfileAction,
  type JobDiscoveryFormState,
} from "@/app/actions/jobs";
import { BASIC_JOB_FILTERS } from "@/lib/jobs/discovery-constants";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

export function JobSearchProfileCreateForm() {
  const [state, action] = useActionState(
    createJobSearchProfileAction,
    INITIAL_STATE,
  );

  return (
    <form action={action} className="space-y-4">
      <Field
        name="candidateName"
        label="Search name"
        placeholder="Bay Area help desk"
        error={state.fieldErrors.candidateName?.[0]}
        defaultValue={state.values?.candidateName}
        required
      />
      <Field
        name="targetRoles"
        label="Target roles"
        placeholder="barista, office assistant"
        error={state.fieldErrors.targetRoles?.[0]}
        defaultValue={state.values?.targetRoles}
        required
      />
      <Field
        name="locationPreference"
        label="Location"
        placeholder="Los Angeles or remote"
        error={state.fieldErrors.locationPreference?.[0]}
        defaultValue={state.values?.locationPreference}
      />
      <div className="grid gap-3 min-[380px]:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="new-remotePreference">Remote</Label>
          <select
            id="new-remotePreference"
            name="remotePreference"
            defaultValue={state.values?.remotePreference ?? "any"}
            className="h-9 w-full rounded-md border border-neutral-200 bg-transparent px-3 text-sm dark:border-neutral-800"
          >
            <option value="any">Any</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="onsite">Onsite</option>
          </select>
        </div>
        <Field
          name="experienceLevel"
          label="Level"
          placeholder="entry"
          error={state.fieldErrors.experienceLevel?.[0]}
          defaultValue={state.values?.experienceLevel}
        />
      </div>
      <div className="grid gap-3 min-[380px]:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="new-employmentType">Schedule</Label>
          <select
            id="new-employmentType"
            name="employmentType"
            defaultValue={state.values?.employmentType ?? "any"}
            className="h-9 w-full rounded-md border border-neutral-200 bg-transparent px-3 text-sm dark:border-neutral-800"
          >
            <option value="any">Any</option>
            <option value="full_time">Full-time</option>
            <option value="part_time">Part-time</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-jobFocus">Job type</Label>
          <select
            id="new-jobFocus"
            name="jobFocus"
            defaultValue={state.values?.jobFocus ?? "both"}
            className="h-9 w-full rounded-md border border-neutral-200 bg-transparent px-3 text-sm dark:border-neutral-800"
          >
            <option value="both">All jobs</option>
            <option value="local">Local and hourly</option>
            <option value="professional">Professional</option>
          </select>
        </div>
      </div>
      <Field
        name="salaryMin"
        label="Minimum salary"
        placeholder="60000"
        error={state.fieldErrors.salaryMin?.[0]}
        defaultValue={state.values?.salaryMin}
        type="number"
      />
      <Field
        name="keywords"
        label="Keywords"
        placeholder="cashier, mornings"
        error={state.fieldErrors.keywords?.[0]}
        defaultValue={state.values?.keywords}
      />
      <Field
        name="exclusions"
        label="Exclusions"
        placeholder="night shift"
        error={state.fieldErrors.exclusions?.[0]}
        defaultValue={state.values?.exclusions}
      />
      <div className="grid gap-2 text-sm min-[340px]:grid-cols-2">
        {BASIC_JOB_FILTERS.map((filter) => (
          <label key={filter} className="flex items-center gap-2">
            <input
              type="checkbox"
              name={filter}
              defaultChecked={state.values?.[filter] === "on"}
            />
            {FILTER_LABELS[filter]}
          </label>
        ))}
      </div>
      {state.formError && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {state.formError}
        </p>
      )}
      <PendingSubmitButton
        type="submit"
        className="w-full"
        pendingLabel="Creating"
      >
        Save search
      </PendingSubmitButton>
    </form>
  );
}

function Field({
  name,
  label,
  placeholder,
  error,
  defaultValue,
  required = false,
  type = "text",
}: {
  name: string;
  label: string;
  placeholder: string;
  error?: string;
  defaultValue?: string;
  required?: boolean;
  type?: "text" | "number";
}) {
  const id = `new-${name}`;
  const errorId = `${id}-error`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type={type}
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
