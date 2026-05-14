import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { resume } from "@/lib/db/resume-schema";
import { ResumeEditor } from "@/components/resume-editor";

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

  return (
    <ResumeEditor
      resume={{
        id: found.id,
        title: found.title,
        isDefault: found.isDefault,
        contactInfo: found.contactInfo
          ? {
              fullName: found.contactInfo.fullName,
              email: found.contactInfo.email,
              phone: found.contactInfo.phone,
              location: found.contactInfo.location,
              links: found.contactInfo.links,
            }
          : null,
        experiences: found.experiences.map((e) => ({
          id: e.id,
          company: e.company,
          role: e.role,
          location: e.location,
          startDate: e.startDate,
          endDate: e.endDate,
          current: e.current,
          bullets: e.bullets.map((b) => ({ id: b.id, text: b.text })),
        })),
        educations: found.educations.map((e) => ({
          id: e.id,
          school: e.school,
          degree: e.degree,
          field: e.field,
          startDate: e.startDate,
          endDate: e.endDate,
          gpa: e.gpa,
        })),
        skills: found.skills.map((s) => ({
          id: s.id,
          category: s.category,
          name: s.name,
        })),
        projects: found.projects.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          link: p.link,
        })),
      }}
    />
  );
}
