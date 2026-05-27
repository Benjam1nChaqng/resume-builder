import { headers } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { loadRenderableResume } from "@/lib/resumes/render";
import { PrintButton } from "@/components/print-button";

type RouteParams = { id: string };

export default async function ResumePdfPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const data = await loadRenderableResume(id);
  if (!data || data.userId !== session.user.id) notFound();

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-6 text-neutral-950 print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-3xl justify-between print:hidden">
        <Link href={`/resume/${id}`} className="text-sm underline underline-offset-4">
          Back to resume
        </Link>
        <PrintButton />
      </div>

      <article className="mx-auto min-h-[11in] max-w-3xl bg-white p-10 shadow-sm print:min-h-0 print:max-w-none print:p-0 print:shadow-none">
        {data.contactInfo && (
          <header className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight">
              {data.contactInfo.fullName}
            </h1>
            <p className="mt-2 text-xs">
              {[
                data.contactInfo.email,
                data.contactInfo.phone,
                data.contactInfo.location,
                ...data.contactInfo.links.map((l) => l.url),
              ]
                .filter(Boolean)
                .join(" | ")}
            </p>
          </header>
        )}

        <ResumeSection title="Experience">
          {data.experiences.map((exp) => (
            <div key={exp.id} className="mb-4 break-inside-avoid">
              <div className="flex justify-between gap-4">
                <div>
                  <h3 className="font-semibold">{exp.role}</h3>
                  <p className="text-sm">{exp.company}</p>
                </div>
                <p className="text-right text-xs">
                  {[exp.startDate, exp.current ? "Present" : exp.endDate]
                    .filter(Boolean)
                    .join(" - ")}
                </p>
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {exp.bullets.map((b) => (
                  <li key={b.id}>{b.text}</li>
                ))}
              </ul>
            </div>
          ))}
        </ResumeSection>

        {data.projects.length > 0 && (
          <ResumeSection title="Projects">
            {data.projects.map((project) => (
              <div key={project.id} className="mb-3 break-inside-avoid text-sm">
                <h3 className="font-semibold">{project.name}</h3>
                <p>{[project.description, project.link].filter(Boolean).join(" | ")}</p>
              </div>
            ))}
          </ResumeSection>
        )}

        {data.educations.length > 0 && (
          <ResumeSection title="Education">
            {data.educations.map((ed) => (
              <div key={ed.id} className="mb-2 flex justify-between gap-4 text-sm">
                <p>
                  <span className="font-semibold">{ed.school}</span>
                  {[ed.degree, ed.field].filter(Boolean).length > 0
                    ? ` | ${[ed.degree, ed.field].filter(Boolean).join(", ")}`
                    : ""}
                </p>
                <p className="text-right text-xs">
                  {[ed.startDate, ed.endDate].filter(Boolean).join(" - ")}
                </p>
              </div>
            ))}
          </ResumeSection>
        )}

        {data.skills.length > 0 && (
          <ResumeSection title="Skills">
            <p className="text-sm">
              {data.skills
                .map((s) => [s.category, s.name].filter(Boolean).join(": "))
                .join(", ")}
            </p>
          </ResumeSection>
        )}
      </article>
    </main>
  );
}

function ResumeSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-6">
      <h2 className="border-b border-neutral-300 pb-1 text-xs font-semibold uppercase tracking-wide">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
