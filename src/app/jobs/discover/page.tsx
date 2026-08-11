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
} from "@/app/actions/jobs";
import { DiscoveredListingActions } from "@/components/discovered-listing-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function JobDiscoverPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const profiles = await listDiscoveryData(session.user.id);
  const activeProfile = profiles[0] ?? null;

  return (
    <main className="min-h-screen bg-white px-6 py-12 dark:bg-neutral-950">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/dashboard"
          className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
        >
          Back to dashboard
        </Link>

        <header className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
              Job discovery
            </h1>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              Manage searches for yourself or friends, then save the listings worth tailoring.
            </p>
          </div>
          <Link href="/job/new" className="text-sm underline underline-offset-4">
            Add one job URL
          </Link>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-[360px_1fr]">
          <aside className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>New search profile</CardTitle>
              </CardHeader>
              <CardContent>
                <form action={createJobSearchProfileAction} className="space-y-4">
                  <Field name="candidateName" label="Candidate" placeholder="Maya" />
                  <Field
                    name="targetRoles"
                    label="Target roles"
                    placeholder="barista, office assistant"
                  />
                  <Field
                    name="locationPreference"
                    label="Location"
                    placeholder="Los Angeles or remote"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Select name="remotePreference" label="Remote">
                      <option value="any">Any</option>
                      <option value="remote">Remote</option>
                      <option value="hybrid">Hybrid</option>
                      <option value="onsite">Onsite</option>
                    </Select>
                    <Field name="experienceLevel" label="Level" placeholder="entry" />
                  </div>
                  <Field name="keywords" label="Keywords" placeholder="cashier, mornings" />
                  <Field name="exclusions" label="Exclusions" placeholder="night shift" />
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {BASIC_JOB_FILTERS.map((filter) => (
                      <label key={filter} className="flex items-center gap-2">
                        <input type="checkbox" name={filter} />
                        {filter}
                      </label>
                    ))}
                  </div>
                  <Button type="submit" className="w-full">
                    Create profile
                  </Button>
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
                    <Field name="label" label="Label" placeholder="Local coffee shops" />
                    <Field
                      name="url"
                      label="Source URL"
                      placeholder="https://example.com/careers"
                      type="url"
                    />
                    <Button type="submit" variant="outline" className="w-full">
                      Add source
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </aside>

          <section className="space-y-6">
            {profiles.length === 0 ? (
              <div className="rounded-lg border border-dashed border-neutral-300 px-6 py-16 text-center text-sm text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
                Create a search profile to start collecting job links.
              </div>
            ) : (
              profiles.map((profile) => (
                <Card key={profile.id}>
                  <CardHeader>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <CardTitle>{profile.candidateName}</CardTitle>
                        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                          {profile.targetRoles.join(", ")}
                        </p>
                      </div>
                      <form action={runJobDiscoveryAction}>
                        <input type="hidden" name="profileId" value={profile.id} />
                        <Button type="submit" disabled={profile.sources.length === 0}>
                          Run discovery
                        </Button>
                      </form>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xs text-neutral-500">
                      Sources:{" "}
                      {profile.sources.length > 0
                        ? profile.sources.map((s) => s.label).join(", ")
                        : "none yet"}
                    </div>
                    <ul className="mt-4 divide-y divide-neutral-200 border-y border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
                      {profile.listings.map((listing) => (
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
              ))
            )}
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
}: {
  name: string;
  label: string;
  placeholder: string;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} placeholder={placeholder} />
    </div>
  );
}

function Select({
  name,
  label,
  children,
}: {
  name: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
        name={name}
        className="h-9 w-full rounded-md border border-neutral-200 bg-transparent px-3 text-sm dark:border-neutral-800"
      >
        {children}
      </select>
    </div>
  );
}
