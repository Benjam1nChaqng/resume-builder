import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { resume } from "@/lib/db/resume-schema";
import { buttonVariants } from "@/components/ui/button";

type RouteParams = { id: string };

export default async function ResumePage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }

  const found = await db.query.resume.findFirst({
    where: eq(resume.id, id),
    with: {
      contactInfo: true,
      experiences: {
        orderBy: (cols, { asc }) => [asc(cols.sortOrder)],
        with: {
          bullets: {
            orderBy: (cols, { asc }) => [asc(cols.sortOrder)],
          },
        },
      },
      educations: {
        orderBy: (cols, { asc }) => [asc(cols.sortOrder)],
      },
      skills: {
        orderBy: (cols, { asc }) => [asc(cols.sortOrder)],
      },
      projects: {
        orderBy: (cols, { asc }) => [asc(cols.sortOrder)],
      },
    },
  });

  if (!found || found.userId !== session.user.id) {
    notFound();
  }

  const ci = found.contactInfo;

  return (
    <main className="min-h-screen bg-white px-6 py-16 dark:bg-neutral-950">
      <div className="mx-auto max-w-2xl space-y-12">
        <header className="flex items-baseline justify-between">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            {found.title}
          </h1>
          <Link
            href="/dashboard"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            ← Dashboard
          </Link>
        </header>

        {ci && (
          <section>
            <h2 className="sr-only">Contact information</h2>
            <p className="text-xl font-medium text-neutral-900 dark:text-neutral-50">
              {ci.fullName}
            </p>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              {[ci.email, ci.phone, ci.location].filter(Boolean).join("  ·  ")}
            </p>
            {ci.links.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {ci.links.map((l, i) => (
                  <li key={i}>
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-neutral-700 underline underline-offset-4 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {found.experiences.length > 0 && (
          <section>
            <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-400 dark:text-neutral-600">
              Experience
            </h2>
            <ul className="mt-4 space-y-6">
              {found.experiences.map((exp) => (
                <li key={exp.id}>
                  <div className="flex items-baseline justify-between gap-4">
                    <p className="font-medium text-neutral-900 dark:text-neutral-50">
                      {exp.role} · {exp.company}
                    </p>
                    <p className="shrink-0 text-xs text-neutral-500 dark:text-neutral-500">
                      {formatRange(exp.startDate, exp.endDate, exp.current)}
                    </p>
                  </div>
                  {exp.location && (
                    <p className="text-sm text-neutral-500 dark:text-neutral-500">
                      {exp.location}
                    </p>
                  )}
                  {exp.bullets.length > 0 && (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700 dark:text-neutral-300">
                      {exp.bullets.map((b) => (
                        <li key={b.id}>{b.text}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {found.educations.length > 0 && (
          <section>
            <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-400 dark:text-neutral-600">
              Education
            </h2>
            <ul className="mt-4 space-y-3">
              {found.educations.map((ed) => (
                <li key={ed.id}>
                  <div className="flex items-baseline justify-between gap-4">
                    <p className="font-medium text-neutral-900 dark:text-neutral-50">
                      {ed.school}
                    </p>
                    <p className="shrink-0 text-xs text-neutral-500 dark:text-neutral-500">
                      {formatRange(ed.startDate, ed.endDate, false)}
                    </p>
                  </div>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    {[ed.degree, ed.field].filter(Boolean).join(", ")}
                    {ed.gpa && ` · GPA ${ed.gpa}`}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {found.skills.length > 0 && (
          <section>
            <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-400 dark:text-neutral-600">
              Skills
            </h2>
            <SkillsList skills={found.skills} />
          </section>
        )}

        {found.projects.length > 0 && (
          <section>
            <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-400 dark:text-neutral-600">
              Projects
            </h2>
            <ul className="mt-4 space-y-4">
              {found.projects.map((p) => (
                <li key={p.id}>
                  <p className="font-medium text-neutral-900 dark:text-neutral-50">
                    {p.link ? (
                      <a
                        href={p.link}
                        target="_blank"
                        rel="noreferrer"
                        className="underline underline-offset-4"
                      >
                        {p.name}
                      </a>
                    ) : (
                      p.name
                    )}
                  </p>
                  {p.description && (
                    <p className="text-sm text-neutral-700 dark:text-neutral-300">
                      {p.description}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="border-t border-neutral-200 pt-4 text-xs text-neutral-400 dark:border-neutral-800 dark:text-neutral-600">
          Read-only view. Inline editing lands in Chunk 5.
        </footer>
      </div>
    </main>
  );
}

function formatRange(start: string | null, end: string | null, current: boolean): string {
  const fmt = (d: string | null) => {
    if (!d) return "";
    const [y, m] = d.split("-");
    if (!m) return y;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthIdx = Number(m) - 1;
    const month = months[monthIdx] ?? "";
    return month ? `${month} ${y}` : y;
  };
  const s = fmt(start);
  const e = current ? "Present" : fmt(end);
  if (!s && !e) return "";
  if (!s) return e;
  if (!e) return s;
  return `${s} – ${e}`;
}

function SkillsList({
  skills,
}: {
  skills: Array<{ id: string; category: string | null; name: string }>;
}) {
  const grouped = new Map<string, string[]>();
  for (const s of skills) {
    const key = s.category ?? "_ungrouped";
    const list = grouped.get(key) ?? [];
    list.push(s.name);
    grouped.set(key, list);
  }

  return (
    <dl className="mt-4 space-y-2 text-sm">
      {[...grouped.entries()].map(([category, names]) => (
        <div key={category} className="flex gap-3">
          {category !== "_ungrouped" && (
            <dt className="w-32 shrink-0 text-neutral-500 dark:text-neutral-500">
              {category}
            </dt>
          )}
          <dd className="text-neutral-700 dark:text-neutral-300">{names.join(", ")}</dd>
        </div>
      ))}
    </dl>
  );
}
