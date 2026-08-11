import { headers } from "next/headers";
import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { BASIC_JOB_FILTERS } from "@/lib/jobs/discovery";
import { listDiscoveryData } from "@/lib/jobs/discovery-repo";
import {
  createJobSearchProfileAction,
  createJobSourceAction,
  runJobDiscoveryAction,
  updateJobSearchProfileAction,
} from "@/app/actions/jobs";
import { DeleteJobSearchProfileButton } from "@/components/delete-job-search-profile-button";
import { DiscoveredListingActions } from "@/components/discovered-listing-actions";
import { JobSearchProfileSelector } from "@/components/job-search-profile-selector";
import { JobSourceActions } from "@/components/job-source-actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { selectActiveProfile } from "@/lib/jobs/profile-selection";

export default async function JobDiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ profile?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const profiles = await listDiscoveryData(session.user.id);
  const { profile: requestedProfileId } = await searchParams;
  const activeProfile = selectActiveProfile(profiles, requestedProfileId);

  return (
    <main className="min-h-screen bg-white px-6 py-12 dark:bg-neutral-950">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/dashboard"
          className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
        >
          Back to dashboard
        </Link>

        <header className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
              Job discovery
            </h1>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              Manage searches for yourself or friends, then save the listings worth tailoring.
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            {activeProfile && (
              <JobSearchProfileSelector
                profiles={profiles}
                selectedId={activeProfile.id}
              />
            )}
            <Link href="/job/new" className="text-sm underline underline-offset-4">
              Add one job URL
            </Link>
          </div>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-[360px_1fr]">
          <aside className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>New search profile</CardTitle>
              </CardHeader>
              <CardContent>
                <form action={createJobSearchProfileAction} className="space-y-4">
                  <Field name="candidateName" label="Candidate" placeholder="Maya" prefix="new" />
                  <Field
                    name="targetRoles"
                    label="Target roles"
                    placeholder="barista, office assistant"
                    prefix="new"
                  />
                  <Field
                    name="locationPreference"
                    label="Location"
                    placeholder="Los Angeles or remote"
                    prefix="new"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Select name="remotePreference" label="Remote" prefix="new">
                      <option value="any">Any</option>
                      <option value="remote">Remote</option>
                      <option value="hybrid">Hybrid</option>
                      <option value="onsite">Onsite</option>
                    </Select>
                    <Field name="experienceLevel" label="Level" placeholder="entry" prefix="new" />
                  </div>
                  <Field name="keywords" label="Keywords" placeholder="cashier, mornings" prefix="new" />
                  <Field name="exclusions" label="Exclusions" placeholder="night shift" prefix="new" />
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {BASIC_JOB_FILTERS.map((filter) => (
                      <label key={filter} className="flex items-center gap-2">
                        <input type="checkbox" name={filter} />
                        {filter}
                      </label>
                    ))}
                  </div>
                  <PendingSubmitButton type="submit" className="w-full" pendingLabel="Creating">
                    Create profile
                  </PendingSubmitButton>
                </form>
              </CardContent>
            </Card>

            {activeProfile && (
              <Card>
                <CardHeader>
                  <CardTitle>Add source</CardTitle>
                </CardHeader>
                <CardContent>
                  <form action={createJobSourceAction} className="space-y-4">
                    <input type="hidden" name="profileId" value={activeProfile.id} />
                    <Field name="label" label="Label" placeholder="Local coffee shops" prefix="source" />
                    <Field
                      name="url"
                      label="Source URL"
                      placeholder="https://example.com/careers"
                      type="url"
                      prefix="source"
                    />
                    <PendingSubmitButton
                      type="submit"
                      variant="outline"
                      className="w-full"
                      pendingLabel="Adding"
                    >
                      Add source
                    </PendingSubmitButton>
                  </form>
                  {activeProfile.sources.length > 0 && (
                    <ul className="mt-4 divide-y divide-neutral-200 border-t border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
                      {activeProfile.sources.map((source) => (
                        <li key={source.id} className="flex items-center gap-2 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{source.label}</p>
                            <p className="truncate text-xs text-neutral-500">{source.url}</p>
                          </div>
                          {!source.enabled && (
                            <span className="text-xs text-neutral-400">Paused</span>
                          )}
                          <JobSourceActions
                            sourceId={source.id}
                            enabled={source.enabled}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )}
          </aside>

          <section className="space-y-6">
            {profiles.length === 0 ? (
              <div className="rounded-lg border border-dashed border-neutral-300 px-6 py-16 text-center text-sm text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
                Create a search profile to start collecting job links.
              </div>
            ) : activeProfile ? (
                <Card key={activeProfile.id}>
                  <CardHeader>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <CardTitle>{activeProfile.candidateName}</CardTitle>
                        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                          {activeProfile.targetRoles.join(", ")}
                        </p>
                      </div>
                      <form action={runJobDiscoveryAction}>
                        <input type="hidden" name="profileId" value={activeProfile.id} />
                        <PendingSubmitButton
                          type="submit"
                          disabled={activeProfile.sources.filter((source) => source.enabled).length === 0}
                          pendingLabel="Discovering"
                        >
                          Run discovery
                        </PendingSubmitButton>
                      </form>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <details className="border-y border-neutral-200 py-3 dark:border-neutral-800">
                      <summary className="cursor-pointer text-sm font-medium">Edit search criteria</summary>
                      <form action={updateJobSearchProfileAction} className="mt-4 grid gap-4 sm:grid-cols-2">
                        <input type="hidden" name="profileId" value={activeProfile.id} />
                        <Field name="candidateName" label="Candidate" placeholder="Maya" prefix="edit" defaultValue={activeProfile.candidateName} />
                        <Field name="targetRoles" label="Target roles" placeholder="barista, office assistant" prefix="edit" defaultValue={activeProfile.targetRoles.join(", ")} />
                        <Field name="locationPreference" label="Location" placeholder="Los Angeles or remote" prefix="edit" defaultValue={activeProfile.locationPreference ?? ""} />
                        <Select name="remotePreference" label="Remote" prefix="edit" defaultValue={activeProfile.remotePreference}>
                          <option value="any">Any</option>
                          <option value="remote">Remote</option>
                          <option value="hybrid">Hybrid</option>
                          <option value="onsite">Onsite</option>
                        </Select>
                        <Field name="experienceLevel" label="Level" placeholder="entry" prefix="edit" defaultValue={activeProfile.experienceLevel ?? ""} />
                        <Field name="keywords" label="Keywords" placeholder="cashier, mornings" prefix="edit" defaultValue={activeProfile.keywords.join(", ")} />
                        <Field name="exclusions" label="Exclusions" placeholder="night shift" prefix="edit" defaultValue={activeProfile.exclusions.join(", ")} />
                        <div className="grid grid-cols-2 gap-2 text-sm sm:col-span-2">
                          {BASIC_JOB_FILTERS.map((filter) => (
                            <label key={filter} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                name={filter}
                                defaultChecked={activeProfile.basicJobFilters[filter]}
                              />
                              {filter}
                            </label>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-2 sm:col-span-2">
                          <PendingSubmitButton type="submit" pendingLabel="Saving">
                            Save criteria
                          </PendingSubmitButton>
                          <DeleteJobSearchProfileButton profileId={activeProfile.id} />
                        </div>
                      </form>
                    </details>
                    <ul className="mt-4 divide-y divide-neutral-200 border-y border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
                      {activeProfile.listings.length === 0 && (
                        <li className="py-10 text-center text-sm text-neutral-500">
                          No listings yet. Add a source and run discovery.
                        </li>
                      )}
                      {activeProfile.listings.map((listing) => (
                        <li
                          key={listing.id}
                          className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <a
                              href={listing.canonicalUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="font-medium text-neutral-900 underline-offset-4 hover:underline dark:text-neutral-50"
                            >
                              {listing.title}
                            </a>
                            <p className="mt-1 text-xs text-neutral-500">
                              {[listing.company, listing.location, listing.status]
                                .filter(Boolean)
                                .join(" | ")}
                            </p>
                          </div>
                          {listing.status === "discovered" ? (
                            <DiscoveredListingActions
                              listingId={listing.id}
                            />
                          ) : (
                            <span className="text-xs uppercase tracking-wide text-neutral-400">
                              {listing.status}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}

function Field({
  name,
  label,
  placeholder,
  type = "text",
  prefix,
  defaultValue,
}: {
  name: string;
  label: string;
  placeholder: string;
  type?: string;
  prefix: string;
  defaultValue?: string;
}) {
  const id = `${prefix}-${name}`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
      />
    </div>
  );
}

function Select({
  name,
  label,
  children,
  prefix,
  defaultValue,
}: {
  name: string;
  label: string;
  children: ReactNode;
  prefix: string;
  defaultValue?: string;
}) {
  const id = `${prefix}-${name}`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue}
        className="h-9 w-full rounded-md border border-neutral-200 bg-transparent px-3 text-sm dark:border-neutral-800"
      >
        {children}
      </select>
    </div>
  );
}
