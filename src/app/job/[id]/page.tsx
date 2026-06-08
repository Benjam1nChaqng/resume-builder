import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { application, job, resumeJobFit } from "@/lib/db/jobs-schema";
import { resume } from "@/lib/db/resume-schema";
import { JobEmailPanel } from "@/components/job-email-panel";
import { JobTailorPanel } from "@/components/job-tailor-panel";
import {
  createTailoredResumeCopyAction,
  runResumeJobFitAction,
} from "@/app/actions/jobs";
import { Button } from "@/components/ui/button";

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
}: {
  params: Promise<RouteParams>;
}) {
  const { id } = await params;
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

  const [fits, applications] = await Promise.all([
    db
      .select()
      .from(resumeJobFit)
      .where(eq(resumeJobFit.jobId, jd.id))
      .orderBy(desc(resumeJobFit.createdAt)),
    db
      .select({ resumeId: application.resumeId, status: application.status })
      .from(application)
      .where(eq(application.jobId, jd.id)),
  ]);
  const tailoredResumeId = applications.find((a) => a.resumeId)?.resumeId ?? null;

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
            {resumes.map((r) => (
              <div
                key={r.id}
                className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="font-medium text-neutral-900 dark:text-neutral-50">
                  {r.title}
                </span>
                <div className="flex flex-wrap gap-2">
                  <form
                    action={async () => {
                      "use server";
                      await runResumeJobFitAction(jd.id, r.id);
                    }}
                  >
                    <Button type="submit" variant="outline" size="sm">
                      Run fit check
                    </Button>
                  </form>
                  <form
                    action={async () => {
                      "use server";
                      await createTailoredResumeCopyAction(jd.id, r.id);
                    }}
                  >
                    <Button type="submit" size="sm">
                      Create tailored copy
                    </Button>
                  </form>
                </div>
              </div>
            ))}
          </div>

          {tailoredResumeId && (
            <div className="mt-4 rounded-lg border border-neutral-200 p-4 text-sm dark:border-neutral-800">
              <Link href={`/resume/${tailoredResumeId}`} className="font-medium underline underline-offset-4">
                Open tailored resume
              </Link>
              <Link
                href={`/resume/${tailoredResumeId}/pdf`}
                className="ml-4 underline underline-offset-4"
              >
                Download PDF
              </Link>
            </div>
          )}

          {fits[0] && (
            <div className="mt-6 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
              <div className="text-3xl font-semibold text-neutral-900 dark:text-neutral-50">
                {fits[0].score}/100
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                Latest fit check from {new Date(fits[0].createdAt).toLocaleString()}
              </p>
              <div className="mt-4 grid gap-5 md:grid-cols-2">
                <ListBlock title="Matching evidence" items={fits[0].matchingEvidence.map((f) => `${f.label}: ${f.evidence}`)} />
                <ListBlock title="Missing requirements" items={fits[0].missingRequirements} />
                <ListBlock title="Concerns" items={fits[0].concerns} />
                <ListBlock title="Recommendations" items={fits[0].recommendations} />
              </div>
            </div>
          )}
        </section>

        <JobTailorPanel jobId={jd.id} resumes={resumes} />

        <div className="mt-12">
          <JobEmailPanel jobId={jd.id} resumes={resumes} />
        </div>
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
