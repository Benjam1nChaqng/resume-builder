"use client";

import Link from "next/link";
import {
  updateBulletAction,
  updateContactInfoAction,
  updateEducationAction,
  updateExperienceAction,
  updateProjectAction,
  updateResumeAction,
  updateSkillAction,
} from "@/app/actions/resumes";
import { buttonVariants } from "@/components/ui/button";
import { EditableDate } from "@/components/editable-date";
import { EditableText } from "@/components/editable-text";
import type { ContactLink } from "@/lib/ai/resume-importer/schema";

type ResumeEditorData = {
  id: string;
  title: string;
  isDefault: boolean;
  contactInfo: {
    fullName: string;
    email: string | null;
    phone: string | null;
    location: string | null;
    links: ContactLink[];
  } | null;
  experiences: Array<{
    id: string;
    company: string;
    role: string;
    location: string | null;
    startDate: string | null;
    endDate: string | null;
    current: boolean;
    bullets: Array<{ id: string; text: string }>;
  }>;
  educations: Array<{
    id: string;
    school: string;
    degree: string | null;
    field: string | null;
    startDate: string | null;
    endDate: string | null;
    gpa: string | null;
  }>;
  skills: Array<{ id: string; category: string | null; name: string }>;
  projects: Array<{
    id: string;
    name: string;
    description: string | null;
    link: string | null;
  }>;
};

const sectionLabel =
  "text-xs font-medium uppercase tracking-[0.2em] text-neutral-400 dark:text-neutral-600";
const fieldGray = "text-neutral-600 dark:text-neutral-400";
const fieldHeading =
  "font-medium text-neutral-900 dark:text-neutral-50";

export function ResumeEditor({ resume }: { resume: ResumeEditorData }) {
  return (
    <main className="min-h-screen bg-white px-6 py-16 dark:bg-neutral-950">
      <div className="mx-auto max-w-2xl space-y-12">
        <header className="flex items-baseline justify-between gap-4">
          <EditableText
            value={resume.title}
            onSave={async (next) => {
              if (!next) return;
              await updateResumeAction(resume.id, { title: next });
            }}
            emptyAsNull={false}
            ariaLabel="Resume title"
            className="text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50"
          />
          <Link
            href="/dashboard"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            ← Dashboard
          </Link>
        </header>

        {resume.contactInfo && (
          <section>
            <h2 className="sr-only">Contact information</h2>
            <EditableText
              value={resume.contactInfo.fullName}
              onSave={async (next) => {
                if (!next) return;
                await updateContactInfoAction(resume.id, { fullName: next });
              }}
              emptyAsNull={false}
              ariaLabel="Full name"
              className={`text-xl ${fieldHeading}`}
            />
            <div className={`mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-3 ${fieldGray}`}>
              <EditableText
                value={resume.contactInfo.email}
                placeholder="email@example.com"
                onSave={async (next) =>
                  updateContactInfoAction(resume.id, { email: next })
                }
                ariaLabel="Email"
              />
              <EditableText
                value={resume.contactInfo.phone}
                placeholder="Phone"
                onSave={async (next) =>
                  updateContactInfoAction(resume.id, { phone: next })
                }
                ariaLabel="Phone"
              />
              <EditableText
                value={resume.contactInfo.location}
                placeholder="Location"
                onSave={async (next) =>
                  updateContactInfoAction(resume.id, { location: next })
                }
                ariaLabel="Location"
              />
            </div>
            {resume.contactInfo.links.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {resume.contactInfo.links.map((l, i) => (
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

        {resume.experiences.length > 0 && (
          <section>
            <h2 className={sectionLabel}>Experience</h2>
            <ul className="mt-4 space-y-6">
              {resume.experiences.map((exp) => (
                <li key={exp.id}>
                  <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-[1fr_auto]">
                    <EditableText
                      value={exp.role}
                      onSave={async (next) => {
                        if (!next) return;
                        await updateExperienceAction(resume.id, exp.id, { role: next });
                      }}
                      emptyAsNull={false}
                      ariaLabel="Role"
                      className={fieldHeading}
                    />
                    <div className={`flex items-center gap-2 text-xs ${fieldGray}`}>
                      <EditableDate
                        value={exp.startDate}
                        onSave={async (next) =>
                          updateExperienceAction(resume.id, exp.id, { startDate: next })
                        }
                        ariaLabel="Start date"
                      />
                      <span>–</span>
                      <EditableDate
                        value={exp.endDate}
                        onSave={async (next) =>
                          updateExperienceAction(resume.id, exp.id, { endDate: next })
                        }
                        ariaLabel="End date"
                        disabled={exp.current}
                      />
                    </div>
                  </div>
                  <div className={`flex items-baseline gap-3 text-sm ${fieldGray}`}>
                    <EditableText
                      value={exp.company}
                      onSave={async (next) => {
                        if (!next) return;
                        await updateExperienceAction(resume.id, exp.id, { company: next });
                      }}
                      emptyAsNull={false}
                      ariaLabel="Company"
                      className="font-medium"
                    />
                    <span>·</span>
                    <EditableText
                      value={exp.location}
                      placeholder="Location"
                      onSave={async (next) =>
                        updateExperienceAction(resume.id, exp.id, { location: next })
                      }
                      ariaLabel="Job location"
                    />
                    <label className="ml-auto flex shrink-0 items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={exp.current}
                        onChange={async (e) => {
                          const next = e.target.checked;
                          await updateExperienceAction(resume.id, exp.id, {
                            current: next,
                            ...(next ? { endDate: null } : {}),
                          });
                        }}
                      />
                      Current
                    </label>
                  </div>
                  {exp.bullets.length > 0 && (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700 dark:text-neutral-300">
                      {exp.bullets.map((b) => (
                        <li key={b.id}>
                          <EditableText
                            value={b.text}
                            multiline
                            emptyAsNull={false}
                            onSave={async (next) => {
                              if (!next) return;
                              await updateBulletAction(resume.id, b.id, { text: next });
                            }}
                            ariaLabel="Bullet"
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {resume.educations.length > 0 && (
          <section>
            <h2 className={sectionLabel}>Education</h2>
            <ul className="mt-4 space-y-4">
              {resume.educations.map((ed) => (
                <li key={ed.id}>
                  <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-[1fr_auto]">
                    <EditableText
                      value={ed.school}
                      onSave={async (next) => {
                        if (!next) return;
                        await updateEducationAction(resume.id, ed.id, { school: next });
                      }}
                      emptyAsNull={false}
                      ariaLabel="School"
                      className={fieldHeading}
                    />
                    <div className={`flex items-center gap-2 text-xs ${fieldGray}`}>
                      <EditableDate
                        value={ed.startDate}
                        onSave={async (next) =>
                          updateEducationAction(resume.id, ed.id, { startDate: next })
                        }
                        ariaLabel="Start date"
                      />
                      <span>–</span>
                      <EditableDate
                        value={ed.endDate}
                        onSave={async (next) =>
                          updateEducationAction(resume.id, ed.id, { endDate: next })
                        }
                        ariaLabel="End date"
                      />
                    </div>
                  </div>
                  <div className={`flex flex-wrap items-baseline gap-3 text-sm ${fieldGray}`}>
                    <EditableText
                      value={ed.degree}
                      placeholder="Degree"
                      onSave={async (next) =>
                        updateEducationAction(resume.id, ed.id, { degree: next })
                      }
                      ariaLabel="Degree"
                    />
                    <EditableText
                      value={ed.field}
                      placeholder="Field of study"
                      onSave={async (next) =>
                        updateEducationAction(resume.id, ed.id, { field: next })
                      }
                      ariaLabel="Field"
                    />
                    <span className="ml-auto flex items-center gap-1 text-xs">
                      <span>GPA</span>
                      <EditableText
                        value={ed.gpa}
                        placeholder="—"
                        ariaLabel="GPA"
                        className="w-12"
                        onSave={async (next) => {
                          if (next === null) {
                            await updateEducationAction(resume.id, ed.id, { gpa: null });
                            return;
                          }
                          const num = Number(next);
                          if (Number.isNaN(num)) return;
                          await updateEducationAction(resume.id, ed.id, { gpa: num });
                        }}
                      />
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {resume.skills.length > 0 && (
          <section>
            <h2 className={sectionLabel}>Skills</h2>
            <ul className="mt-4 space-y-2 text-sm">
              {resume.skills.map((s) => (
                <li key={s.id} className="flex items-baseline gap-3">
                  <EditableText
                    value={s.category}
                    placeholder="Category (optional)"
                    onSave={async (next) =>
                      updateSkillAction(resume.id, s.id, { category: next })
                    }
                    ariaLabel="Skill category"
                    className={`w-32 shrink-0 ${fieldGray}`}
                  />
                  <EditableText
                    value={s.name}
                    onSave={async (next) => {
                      if (!next) return;
                      await updateSkillAction(resume.id, s.id, { name: next });
                    }}
                    emptyAsNull={false}
                    ariaLabel="Skill name"
                    className="text-neutral-700 dark:text-neutral-300"
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        {resume.projects.length > 0 && (
          <section>
            <h2 className={sectionLabel}>Projects</h2>
            <ul className="mt-4 space-y-4">
              {resume.projects.map((p) => (
                <li key={p.id}>
                  <div className="flex items-baseline gap-3">
                    <EditableText
                      value={p.name}
                      onSave={async (next) => {
                        if (!next) return;
                        await updateProjectAction(resume.id, p.id, { name: next });
                      }}
                      emptyAsNull={false}
                      ariaLabel="Project name"
                      className={fieldHeading}
                    />
                    <EditableText
                      value={p.link}
                      placeholder="https://..."
                      onSave={async (next) =>
                        updateProjectAction(resume.id, p.id, { link: next })
                      }
                      ariaLabel="Project link"
                      className={`text-sm ${fieldGray}`}
                    />
                  </div>
                  <EditableText
                    value={p.description}
                    multiline
                    placeholder="Description"
                    onSave={async (next) =>
                      updateProjectAction(resume.id, p.id, { description: next })
                    }
                    ariaLabel="Project description"
                    className="text-sm text-neutral-700 dark:text-neutral-300"
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="border-t border-neutral-200 pt-4 text-xs text-neutral-400 dark:border-neutral-800 dark:text-neutral-600">
          Edits save automatically when you tab or click away.
        </footer>
      </div>
    </main>
  );
}
