import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { application, job, resumeJobFit } from "@/lib/db/jobs-schema";
import { resume } from "@/lib/db/resume-schema";
import { indexLatestFitsByResume } from "@/lib/jobs/fit-history";
import { JobTailorPanel } from "@/components/job-tailor-panel";
import {
  markJobAppliedAction,
  runResumeJobFitAction,
} from "@/app/actions/jobs";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { ActionNotice } from "@/components/action-notice";
import { ResumePdfDownloadLink } from "@/components/resume-pdf-download-link";
import { ApplicationNotesForm } from "@/components/application-notes-form";
import { getJobPipelineHistoryForUser } from "@/lib/jobs/application-record";

type RouteParams = { id: string };

function formatSalary(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  const fmt = (n: number) => `$${Math.round(n / 1000)}k`;
  if (min != null && max != null) return `${fmt(min)} – ${fmt(max)}`;
  if (min != null) return `From ${fmt(min)}`;
  return `Up to ${fmt(max!)}`;
}

export default async function JobPage({
  params,
  searchParams,
}: {
  params: Promise<RouteParams>;
  searchParams: Promise<{ resume?: string; notice?: string }>;
}) {
  const { id } = await params;
  const { resume: requestedResumeId, notice } = await searchParams;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }

  const found = await db
    .select()
    .from(job)
    .where(and(eq(job.id, id), eq(job.userId, session.user.id)))
    .limit(1);
  const jd = found[0];
  if (!jd) {
    notFound();
  }

  const resumes = await db
    .select({ id: resume.id, title: resume.title })
    .from(resume)
    .where(eq(resume.userId, session.user.id))
    .orderBy(desc(resume.updatedAt));

  const [fits, applications, pipelineHistory] = await Promise.all([
    db
      .select()
      .from(resumeJobFit)
      .where(
        and(
          eq(resumeJobFit.jobId, jd.id),
          eq(resumeJobFit.userId, session.user.id),
        ),
      )
      .orderBy(desc(resumeJobFit.createdAt)),
    db
      .select({
        resumeId: application.resumeId,
        status: application.status,
        notes: application.notes,
        appliedAt: application.appliedAt,
      })
      .from(application)
      .where(
        and(
          eq(application.jobId, jd.id),
          eq(application.userId, session.user.id),
        ),
      ),
    getJobPipelineHistoryForUser({
      jobId: jd.id,
      userId: session.user.id,
    }),
  ]);
  const latestFitsByResume = indexLatestFitsByResume(fits);
  const applicationRecord = applications[0] ?? null;
  const tailoredResumeId = applications.find((a) => a.resumeId)?.resumeId ?? null;
  const activeResumeId = resumes.some((resumeRow) => resumeRow.id === requestedResumeId)
    ? requestedResumeId!
    : (fits[0]?.resumeId ?? resumes[0]?.id ?? null);
  const activeFit = activeResumeId
    ? (latestFitsByResume.get(activeResumeId) ?? null)
    : null;
  const activeResume = resumes.find((resumeRow) => resumeRow.id === activeResumeId);

  const salary = formatSalary(jd.salaryMin, jd.salaryMax);

  return (
    <main className="min-h-screen bg-white px-6 py-12 dark:bg-neutral-950">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/dashboard"
          className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
        >
          ← Dashboard
        </Link>

        <header className="mt-6">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            {jd.title}
          </h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            <span className="font-medium">{jd.company}</span>
            {jd.location ? <span> · {jd.location}</span> : null}
            {jd.seniority ? <span> · {jd.seniority}</span> : null}
            {salary ? <span> · {salary}</span> : null}
          </p>
          <a
            href={jd.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-xs text-neutral-500 underline-offset-2 hover:underline dark:text-neutral-500"
          >
            Source: {jd.sourceUrl}
          </a>
        </header>
        <ActionNotice code={notice} />

        <section className="mt-8">
          <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Description
          </h2>
          <p className="mt-2 whitespace-pre-line text-sm text-neutral-800 dark:text-neutral-200">
            {jd.description}
          </p>
        </section>

        {jd.requirements.length > 0 && (
          <section className="mt-8">
            <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Requirements
            </h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-800 dark:text-neutral-200">
              {jd.requirements.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </section>
        )}

        {jd.niceToHaves && jd.niceToHaves.length > 0 && (
          <section className="mt-8">
            <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Nice to haves
            </h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-800 dark:text-neutral-200">
              {jd.niceToHaves.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </section>
        )}

        <hr className="my-12 border-neutral-200 dark:border-neutral-800" />

        <section className="mb-12">
          <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-50">
            Fit check and tailored copy
          </h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Score a resume against this JD, then create a separate tailored copy for download.
          </p>

          <div className="mt-4 space-y-3">
            {resumes.length === 0 && (
              <div className="border-y border-dashed border-neutral-300 px-5 py-10 text-center text-sm text-neutral-500 dark:border-neutral-800">
                Import a resume from the dashboard before running a fit check.
              </div>
            )}
            {resumes.map((r) => {
              const latestFit = latestFitsByResume.get(r.id);
              return (
              <div
                key={r.id}
                className={`flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between ${
                  r.id === activeResumeId
                    ? "border-neutral-900 dark:border-neutral-100"
                    : "border-neutral-200 dark:border-neutral-800"
                }`}
              >
                <div>
                  <Link
                    href={`/job/${jd.id}?resume=${r.id}`}
                    className="font-medium text-neutral-900 underline-offset-4 hover:underline dark:text-neutral-50"
                  >
                    {r.title}
                  </Link>
                  {latestFit && (
                    <p className="mt-1 text-xs text-neutral-500">
                      {latestFit.status === "failed"
                        ? "Latest check failed"
                        : `Latest score: ${latestFit.score}/100`}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <form
                    action={async () => {
                      "use server";
                      await runResumeJobFitAction(jd.id, r.id);
                    }}
                  >
                    <PendingSubmitButton
                      type="submit"
                      variant="outline"
                      size="sm"
                      pendingLabel="Checking..."
                    >
                      Run fit check
                    </PendingSubmitButton>
                  </form>
                </div>
              </div>
              );
            })}
          </div>

          {tailoredResumeId && (
            <div className="mt-4 rounded-lg border border-neutral-200 p-4 text-sm dark:border-neutral-800">
              <Link href={`/resume/${tailoredResumeId}`} className="font-medium underline underline-offset-4">
                Open tailored resume
              </Link>
              <ResumePdfDownloadLink
                resumeId={tailoredResumeId}
                className="ml-4 underline underline-offset-4"
              />
            </div>
          )}

          <div className="mt-4 flex items-center gap-3">
            {applicationRecord?.status === "applied" ? (
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Applied {applicationRecord.appliedAt.toLocaleDateString()}
              </p>
            ) : (
              <form
                action={async () => {
                  "use server";
                  await markJobAppliedAction(jd.id);
                }}
              >
                <PendingSubmitButton
                  type="submit"
                  variant="outline"
                  size="sm"
                  pendingLabel="Saving..."
                >
                  Mark applied
                </PendingSubmitButton>
              </form>
            )}
          </div>

          <div className="mt-6 grid gap-6 border-t border-neutral-200 pt-6 dark:border-neutral-800 md:grid-cols-2">
            <ApplicationNotesForm
              jobId={jd.id}
              notes={applicationRecord?.notes ?? null}
            />
            <div>
              <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                Activity
              </h3>
              {pipelineHistory.length > 0 ? (
                <ol className="mt-3 space-y-3 border-l border-neutral-200 pl-4 dark:border-neutral-800">
                  {pipelineHistory.map((event) => (
                    <li key={event.id} className="text-sm">
                      <p className="font-medium capitalize text-neutral-800 dark:text-neutral-200">
                        {event.restored ? "Restored to discovered" : event.status}
                      </p>
                      <time
                        dateTime={event.occurredAt.toISOString()}
                        className="text-xs text-neutral-500"
                      >
                        {event.occurredAt.toLocaleString()}
                      </time>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-2 text-sm text-neutral-500">
                  Activity appears here as this job moves through the pipeline.
                </p>
              )}
            </div>
          </div>

          {activeResume && !activeFit && (
            <div className="mt-6 border-y border-dashed border-neutral-300 px-5 py-10 text-center text-sm text-neutral-500 dark:border-neutral-800">
              No fit result for {activeResume.title} yet. Run a fit check to
              compare its evidence with this job.
            </div>
          )}

          {activeFit?.status === "failed" ? (
            <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-5 dark:border-red-900 dark:bg-red-950/40">
              <p className="font-medium text-red-800 dark:text-red-200">
                {activeFit.errorSummary ??
                  "Fit check failed. Review the inputs and try again."}
              </p>
              <p className="mt-1 text-xs text-red-700 dark:text-red-300">
                {activeResume?.title ?? "Selected resume"} checked{" "}
                {new Date(activeFit.createdAt).toLocaleString()}
              </p>
              {activeFit.modelMetadata?.baselineScore !== undefined && (
                <p className="mt-2 text-xs text-red-700 dark:text-red-300">
                  Deterministic baseline completed at{" "}
                  {activeFit.modelMetadata.baselineScore}/100.
                </p>
              )}
            </div>
          ) : activeFit && activeFit.score !== null ? (
            <div className="mt-6 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
              <div className="text-3xl font-semibold text-neutral-900 dark:text-neutral-50">
                {activeFit.score}/100
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                {activeResume?.title ?? "Selected resume"} checked {new Date(activeFit.createdAt).toLocaleString()}
              </p>
              {activeFit.modelMetadata?.baselineScore !== undefined && (
                <p className="mt-1 text-xs text-neutral-500">
                  Deterministic baseline: {activeFit.modelMetadata.baselineScore}/100
                  {activeFit.modelMetadata.rubricVersion
                    ? " | " + activeFit.modelMetadata.rubricVersion
                    : ""}
                </p>
              )}
              <div className="mt-4 grid gap-5 md:grid-cols-2">
                <ListBlock
                  title="Matching evidence"
                  items={activeFit.matchingEvidence.map(
                    (finding) =>
                      finding.label +
                      ": " +
                      finding.evidence +
                      " [" +
                      (finding.confidence ?? "unrated") +
                      (finding.sourceSection
                        ? ", " + finding.sourceSection
                        : "") +
                      "]",
                  )}
                />
                <ListBlock
                  title="Missing hard requirements"
                  items={activeFit.missingRequirements}
                />
                <ListBlock
                  title="Missing preferred requirements"
                  items={activeFit.missingPreferredRequirements}
                />
                <ListBlock title="Concerns" items={activeFit.concerns} />
                <ListBlock
                  title="Unsupported claims to avoid"
                  items={activeFit.unsupportedClaims}
                />
                <ListBlock title="Recommendations" items={activeFit.recommendations} />
              </div>
            </div>
          ) : null}
        </section>

        <JobTailorPanel jobId={jd.id} resumes={resumes} />
      </div>
    </main>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {title}
      </h3>
      {items.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-800 dark:text-neutral-200">
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-neutral-500">None yet.</p>
      )}
    </div>
  );
}
