import { headers } from "next/headers";
import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { listDiscoveryData } from "@/lib/jobs/discovery-repo";
import { profileToCriteria } from "@/lib/jobs/run-discovery";
import { buildSearchLinks } from "@/lib/jobs/search-links";
import {
  createJobSearchProfileAction,
  runJobDiscoveryAction,
} from "@/app/actions/jobs";
import { DiscoveredListingActions } from "@/components/discovered-listing-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const EMPLOYMENT_LABELS: Record<string, string> = {
  any: "Any type",
  full_time: "Full-time",
  part_time: "Part-time",
};

const FOCUS_LABELS: Record<string, string> = {
  both: "Local + professional",
  local: "Local / hourly",
  professional: "Professional",
};

export default async function JobDiscoverPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const profiles = await listDiscoveryData(session.user.id);

  return (
    <main className="min-h-screen bg-neutral-50 px-6 py-10 dark:bg-neutral-950">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/dashboard"
          className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
        >
          ← Back to dashboard
        </Link>

        <header className="mt-6">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            Find jobs
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
            Tell us what you&apos;re looking for. We build the searches for the big
            job sites for you, and pull in fresh listings — no link hunting.
          </p>
        </header>

        {/* New search */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Start a new search</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              action={createJobSearchProfileAction}
              className="grid gap-4 sm:grid-cols-2"
            >
              <Field
                name="targetRoles"
                label="What job?"
                placeholder="barista, cashier, AV technician"
                hint="Separate a few with commas."
              />
              <Field
                name="locationPreference"
                label="Where?"
                placeholder="Oakland, CA (or 'remote')"
              />
              <Select name="employmentType" label="Type">
                <option value="any">Any type</option>
                <option value="full_time">Full-time</option>
                <option value="part_time">Part-time</option>
              </Select>
              <Field
                name="salaryMin"
                label="Minimum pay (optional)"
                placeholder="50000"
                hint="Yearly. Leave blank for any."
              />
              <Select name="jobFocus" label="Focus">
                <option value="both">Local + professional</option>
                <option value="local">Local / hourly (coffee shops, retail)</option>
                <option value="professional">Professional / remote</option>
              </Select>
              <Field
                name="candidateName"
                label="Search name"
                placeholder="Me"
                hint="Name it (e.g. for a friend)."
              />
              <div className="sm:col-span-2">
                <Button type="submit" className="w-full sm:w-auto">
                  Save search
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Saved searches */}
        <div className="mt-8 space-y-6">
          {profiles.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-300 px-6 py-16 text-center text-sm text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
              No searches yet. Fill in the form above to get started.
            </div>
          ) : (
            profiles.map((profile) => {
              const criteria = profileToCriteria(profile);
              const links = buildSearchLinks(criteria);
              const openListings = profile.listings.filter(
                (l) => l.status === "discovered",
              );
              return (
                <Card key={profile.id}>
                  <CardHeader>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <CardTitle>{profile.candidateName}</CardTitle>
                        <p className="mt-1 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                          {profile.targetRoles.join(", ")}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Chip>{profile.locationPreference || "Anywhere"}</Chip>
                          <Chip>{EMPLOYMENT_LABELS[profile.employmentType]}</Chip>
                          {profile.salaryMin ? (
                            <Chip>${profile.salaryMin.toLocaleString("en-US")}+</Chip>
                          ) : null}
                          <Chip>{FOCUS_LABELS[profile.jobFocus]}</Chip>
                        </div>
                      </div>
                      <form action={runJobDiscoveryAction}>
                        <input type="hidden" name="profileId" value={profile.id} />
                        <Button type="submit">Find fresh jobs</Button>
                      </form>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* One-click site searches */}
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Search these sites (opens in a new tab)
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {links.map((link) => (
                          <a
                            key={link.id}
                            href={link.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-9 items-center rounded-md border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-800 shadow-sm transition hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
                          >
                            {link.label} ↗
                          </a>
                        ))}
                      </div>
                    </div>

                    {/* Pulled-in listings */}
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Jobs we pulled in
                      </p>
                      {profile.listings.length === 0 ? (
                        <p className="rounded-md bg-neutral-100 px-4 py-6 text-center text-sm text-neutral-500 dark:bg-neutral-900">
                          None yet. Click <strong>Find fresh jobs</strong>, or use the
                          search buttons above.
                        </p>
                      ) : (
                        <ul className="divide-y divide-neutral-200 rounded-md border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
                          {profile.listings.map((listing) => (
                            <li
                              key={listing.id}
                              className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="min-w-0">
                                <a
                                  href={listing.canonicalUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="font-medium text-neutral-900 underline-offset-4 hover:underline dark:text-neutral-50"
                                >
                                  {listing.title}
                                </a>
                                <p className="mt-1 truncate text-xs text-neutral-500">
                                  {[listing.company, listing.location]
                                    .filter(Boolean)
                                    .join(" · ") || "—"}
                                </p>
                              </div>
                              {listing.status === "discovered" ? (
                                <DiscoveredListingActions
                                  listingId={listing.id}
                                  url={listing.canonicalUrl}
                                />
                              ) : (
                                <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:bg-neutral-800">
                                  {listing.status}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                      {openListings.length === 0 && profile.listings.length > 0 ? (
                        <p className="mt-2 text-xs text-neutral-400">
                          All caught up — every pulled job has been saved or rejected.
                        </p>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
      {children}
    </span>
  );
}

function Field({
  name,
  label,
  placeholder,
  hint,
  type = "text",
}: {
  name: string;
  label: string;
  placeholder: string;
  hint?: string;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} placeholder={placeholder} />
      {hint ? <p className="text-xs text-neutral-400">{hint}</p> : null}
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
    <div className="space-y-1.5">
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
