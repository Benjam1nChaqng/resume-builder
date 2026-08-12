import { cookies, headers } from "next/headers";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { listDiscoveryData } from "@/lib/jobs/discovery-repo";
import {
  runJobDiscoveryAction,
} from "@/app/actions/jobs";
import { ActionNotice } from "@/components/action-notice";
import { DiscoveredListingActions } from "@/components/discovered-listing-actions";
import { JobSearchProfileSelector } from "@/components/job-search-profile-selector";
import { JobSearchProfileCreateForm } from "@/components/job-search-profile-create-form";
import { JobSearchProfileUpdateForm } from "@/components/job-search-profile-update-form";
import { JobListingSortSelect } from "@/components/job-listing-sort-select";
import { JobSourceActions } from "@/components/job-source-actions";
import { JobSourceCreateForm } from "@/components/job-source-create-form";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import {
  parseSelectedProfileCookie,
  SELECTED_JOB_PROFILE_COOKIE,
  selectActiveProfile,
} from "@/lib/jobs/profile-selection";
import {
  createJobListingView,
  parseJobListingSort,
} from "@/lib/jobs/listing-view";

export default async function JobDiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{
    profile?: string;
    status?: string;
    sort?: string;
    page?: string;
    notice?: string;
    count?: string;
  }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const profiles = await listDiscoveryData(session.user.id);
  const {
    profile: requestedProfileId,
    status: requestedStatus,
    sort: requestedSort,
    page: requestedPage,
    notice,
    count,
  } = await searchParams;
  const selectedProfileId = parseSelectedProfileCookie(
    (await cookies()).get(SELECTED_JOB_PROFILE_COOKIE)?.value,
    session.user.id,
  );
  const activeProfile = selectActiveProfile(
    profiles,
    requestedProfileId,
    selectedProfileId,
  );
  const listingStatuses = [
    "all",
    "discovered",
    "saved",
    "rejected",
    "tailored",
    "applied",
  ] as const;
  const statusFilter = listingStatuses.includes(
    requestedStatus as (typeof listingStatuses)[number],
  )
    ? (requestedStatus as (typeof listingStatuses)[number])
    : "all";
  const listingSort = parseJobListingSort(requestedSort);
  const listingView = createJobListingView(activeProfile?.listings ?? [], {
    status: statusFilter,
    sort: listingSort,
    page: Number(requestedPage),
  });
  const visibleListings = listingView.items;

  return (
    <main className="min-h-screen bg-white px-3 py-8 sm:px-6 sm:py-12 dark:bg-neutral-950">
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
          <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
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
        <ActionNotice code={notice} count={count} />

        <div className="mt-8 grid gap-6 lg:grid-cols-[360px_1fr]">
          <aside className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>New search profile</CardTitle>
              </CardHeader>
              <CardContent>
                <JobSearchProfileCreateForm />
              </CardContent>
            </Card>

            {activeProfile && (
              <Card>
                <CardHeader>
                  <CardTitle>Add source</CardTitle>
                </CardHeader>
                <CardContent>
                  <JobSourceCreateForm profileId={activeProfile.id} />
                  {activeProfile.sources.length === 0 ? (
                    <p className="mt-4 border-t border-neutral-200 pt-4 text-sm text-neutral-500 dark:border-neutral-800">
                      Add a company career page or supported ATS board before
                      running discovery.
                    </p>
                  ) : (
                    <ul className="mt-4 divide-y divide-neutral-200 border-t border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
                      {activeProfile.sources.map((source) => (
                        <li key={source.id} className="flex flex-wrap items-center gap-2 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{source.label}</p>
                            <p className="truncate text-xs text-neutral-500">{source.url}</p>
                          </div>
                          {!source.enabled && (
                            <span className="text-xs text-neutral-400">Paused</span>
                          )}
                          <div className="basis-full sm:basis-auto">
                            <JobSourceActions
                              sourceId={source.id}
                              enabled={source.enabled}
                              sourceLabel={source.label}
                              sourceUrl={source.url}
                            />
                          </div>
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
                      <form action={runJobDiscoveryAction} className="w-full sm:w-auto">
                        <input type="hidden" name="profileId" value={activeProfile.id} />
                        <PendingSubmitButton
                          type="submit"
                          disabled={activeProfile.sources.filter((source) => source.enabled).length === 0}
                          pendingLabel="Discovering"
                          className="w-full sm:w-auto"
                        >
                          Run discovery
                        </PendingSubmitButton>
                      </form>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {activeProfile.runs[0] && (
                      <DiscoveryRunSummary run={activeProfile.runs[0]} />
                    )}
                    <details className="border-y border-neutral-200 py-3 dark:border-neutral-800">
                      <summary className="cursor-pointer text-sm font-medium">Edit search criteria</summary>
                      <JobSearchProfileUpdateForm profile={activeProfile} />
                    </details>
                    <nav
                      aria-label="Listing status"
                      className="mt-4 flex gap-1 overflow-x-auto border-b border-neutral-200 pb-2 dark:border-neutral-800"
                    >
                      {listingStatuses.map((status) => {
                        const count =
                          status === "all"
                            ? activeProfile.listings.length
                            : activeProfile.listings.filter(
                                (listing) => listing.status === status,
                              ).length;
                        return (
                          <Link
                            key={status}
                            href={
                              "/jobs/discover?profile=" +
                              encodeURIComponent(activeProfile.id) +
                              "&status=" +
                              status
                            }
                            className={`shrink-0 rounded-md px-2 py-1 text-xs capitalize ${
                              statusFilter === status
                                ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                                : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-900"
                            }`}
                          >
                            {status} ({count})
                          </Link>
                        );
                      })}
                    </nav>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-neutral-500">
                        Showing {listingView.rangeStart}-{listingView.rangeEnd} of{" "}
                        {listingView.total}
                      </p>
                      <JobListingSortSelect value={listingSort} />
                    </div>
                    <ul className="mt-2 divide-y divide-neutral-200 border-y border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
                      {visibleListings.length === 0 && (
                        <li className="py-10 text-center text-sm text-neutral-500">
                          No {statusFilter === "all" ? "" : statusFilter + " "}
                          listings yet.
                        </li>
                      )}
                      {visibleListings.map((listing) => (
                        <li
                          key={listing.id}
                          className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <a
                              href={listing.canonicalUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="break-words font-medium text-neutral-900 underline-offset-4 hover:underline dark:text-neutral-50"
                            >
                              {listing.title}
                            </a>
                            <p className="mt-1 break-words text-xs leading-relaxed text-neutral-500">
                              {[
                                listing.company,
                                listing.location,
                                listing.employmentType,
                                listing.compensationText,
                                listing.postedAt
                                  ? "Posted " +
                                    listing.postedAt.toLocaleDateString()
                                  : null,
                                listing.matchScore > 0
                                  ? `${listing.matchScore}% profile match`
                                  : null,
                                listing.status,
                              ]
                                .filter(Boolean)
                                .join(" | ")}
                            </p>
                          </div>
                          {listing.status === "discovered" ||
                          listing.status === "rejected" ? (
                            <div className="w-full sm:w-auto">
                              <DiscoveredListingActions
                                listingId={listing.id}
                                status={listing.status}
                              />
                            </div>
                          ) : listing.jobId ? (
                            <Link
                              href={`/job/${listing.jobId}`}
                              className="text-xs font-medium underline underline-offset-4"
                            >
                              Open job
                            </Link>
                          ) : (
                            <span className="text-xs uppercase tracking-wide text-neutral-400">
                              {listing.status}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                    {listingView.pageCount > 1 && (
                      <nav
                        aria-label="Listing pages"
                        className="mt-4 flex items-center justify-center gap-3"
                      >
                        {listingView.hasPrevious ? (
                          <Link
                            href={listingPageHref({
                              profileId: activeProfile.id,
                              status: statusFilter,
                              sort: listingSort,
                              page: listingView.page - 1,
                            })}
                            className={buttonVariants({
                              variant: "outline",
                              size: "icon-sm",
                            })}
                            title="Previous page"
                          >
                            <ChevronLeft />
                            <span className="sr-only">Previous page</span>
                          </Link>
                        ) : (
                          <span
                            aria-hidden="true"
                            className={buttonVariants({
                              variant: "outline",
                              size: "icon-sm",
                              className: "pointer-events-none opacity-40",
                            })}
                          >
                            <ChevronLeft />
                          </span>
                        )}
                        <span className="min-w-20 text-center text-xs text-neutral-500">
                          Page {listingView.page} of {listingView.pageCount}
                        </span>
                        {listingView.hasNext ? (
                          <Link
                            href={listingPageHref({
                              profileId: activeProfile.id,
                              status: statusFilter,
                              sort: listingSort,
                              page: listingView.page + 1,
                            })}
                            className={buttonVariants({
                              variant: "outline",
                              size: "icon-sm",
                            })}
                            title="Next page"
                          >
                            <ChevronRight />
                            <span className="sr-only">Next page</span>
                          </Link>
                        ) : (
                          <span
                            aria-hidden="true"
                            className={buttonVariants({
                              variant: "outline",
                              size: "icon-sm",
                              className: "pointer-events-none opacity-40",
                            })}
                          >
                            <ChevronRight />
                          </span>
                        )}
                      </nav>
                    )}
                  </CardContent>
                </Card>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}

function listingPageHref({
  profileId,
  status,
  sort,
  page,
}: {
  profileId: string;
  status: string;
  sort: string;
  page: number;
}) {
  const params = new URLSearchParams({
    profile: profileId,
    status,
    sort,
    page: String(page),
  });
  return `/jobs/discover?${params.toString()}`;
}

function DiscoveryRunSummary({
  run,
}: {
  run: {
    status: string;
    startedAt: Date;
    completedAt: Date | null;
    insertedCount: number;
    errorSummary: string | null;
    sourceResults: Array<{
      sourceId: string;
      label: string;
      status: "completed" | "failed";
      inserted: number;
      attempts?: number;
      durationMs: number;
      error?: string;
    }>;
  };
}) {
  const durationMs = run.completedAt
    ? run.completedAt.getTime() - run.startedAt.getTime()
    : null;
  return (
    <div className="mb-4 border-y border-neutral-200 py-3 text-sm dark:border-neutral-800">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium capitalize">{run.status}</span>
        <span className="text-neutral-500">
          {run.insertedCount} new listing{run.insertedCount === 1 ? "" : "s"}
        </span>
        {durationMs !== null && (
          <span className="text-neutral-500">
            {(durationMs / 1_000).toFixed(1)}s
          </span>
        )}
        <span className="text-xs text-neutral-400">
          {run.startedAt.toLocaleString()}
        </span>
      </div>
      {run.sourceResults.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-neutral-500">
            Source results
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-neutral-500">
            {run.sourceResults.map((source) => (
              <li key={source.sourceId}>
                <span className="font-medium text-neutral-700 dark:text-neutral-300">
                  {source.label}
                </span>
                {": "}
                {source.status === "completed"
                  ? source.inserted + " added"
                  : (source.error ?? "Failed")}
                {" (" + (source.durationMs / 1_000).toFixed(1) + "s)"}
                {source.attempts && source.attempts > 1
                  ? `, ${source.attempts} attempts`
                  : ""}
              </li>
            ))}
          </ul>
        </details>
      )}
      {run.errorSummary && run.sourceResults.length === 0 && (
        <p className="mt-2 text-xs text-red-700 dark:text-red-300">
          {run.errorSummary}
        </p>
      )}
    </div>
  );
}
