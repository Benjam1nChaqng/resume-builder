import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { resume } from "@/lib/db/resume-schema";
import { job } from "@/lib/db/jobs-schema";
import { ImportResumeButton } from "@/components/import-resume-button";
import { SignOutButton } from "@/components/sign-out-button";
import { buttonVariants } from "@/components/ui/button";
import { KeyRound } from "lucide-react";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/sign-in");
  }

  const [resumes, jobs] = await Promise.all([
    db
      .select({
        id: resume.id,
        title: resume.title,
        isDefault: resume.isDefault,
        updatedAt: resume.updatedAt,
      })
      .from(resume)
      .where(eq(resume.userId, session.user.id))
      .orderBy(desc(resume.updatedAt)),
    db
      .select({
        id: job.id,
        title: job.title,
        company: job.company,
        scrapedAt: job.scrapedAt,
      })
      .from(job)
      .where(eq(job.userId, session.user.id))
      .orderBy(desc(job.scrapedAt)),
  ]);

  return (
    <main className="min-h-screen bg-white px-6 py-16 dark:bg-neutral-950">
      <div className="mx-auto max-w-2xl">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
              Welcome, {session.user.name}
            </h1>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              {session.user.email}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/settings/agent-access"
              className={buttonVariants({ size: "sm", variant: "outline" })}
            >
              <KeyRound data-icon="inline-start" />
              Agent access
            </Link>
            <SignOutButton />
          </div>
        </header>

        <section className="mt-12">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-50">
              Resumes
            </h2>
            <ImportResumeButton />
          </div>

          {resumes.length === 0 ? (
            <div className="mt-6 rounded-lg border border-dashed border-neutral-300 px-6 py-12 text-center dark:border-neutral-800">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                No resume yet — import one to get started.
              </p>
            </div>
          ) : (
            <ul className="mt-6 divide-y divide-neutral-200 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
              {resumes.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/resume/${r.id}`}
                    className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900"
                  >
                    <span className="flex items-center gap-3">
                      <span className="font-medium text-neutral-900 dark:text-neutral-50">
                        {r.title}
                      </span>
                      {r.isDefault && (
                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                          default
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-neutral-400 dark:text-neutral-600">
                      {new Date(r.updatedAt).toLocaleDateString()}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-12">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-50">
              Jobs
            </h2>
            <div className="flex gap-2">
              <Link
                href="/jobs/discover"
                className={buttonVariants({ size: "sm", variant: "outline" })}
              >
                Discover
              </Link>
              <Link href="/job/new" className={buttonVariants({ size: "sm" })}>
                + Add job
              </Link>
            </div>
          </div>

          {jobs.length === 0 ? (
            <div className="mt-6 rounded-lg border border-dashed border-neutral-300 px-6 py-12 text-center dark:border-neutral-800">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                No jobs yet — add a job posting URL to tailor a resume.
              </p>
            </div>
          ) : (
            <ul className="mt-6 divide-y divide-neutral-200 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
              {jobs.map((j) => (
                <li key={j.id}>
                  <Link
                    href={`/job/${j.id}`}
                    className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900"
                  >
                    <span className="flex flex-col">
                      <span className="font-medium text-neutral-900 dark:text-neutral-50">
                        {j.title}
                      </span>
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">
                        {j.company}
                      </span>
                    </span>
                    <span className="text-xs text-neutral-400 dark:text-neutral-600">
                      {new Date(j.scrapedAt).toLocaleDateString()}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
