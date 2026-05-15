import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { job } from "@/lib/db/jobs-schema";
import { resume } from "@/lib/db/resume-schema";
import { JobTailorPanel } from "@/components/job-tailor-panel";

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

        <JobTailorPanel jobId={jd.id} resumes={resumes} />
      </div>
    </main>
  );
}
