"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Download, Eye, Plus, X } from "lucide-react";
import {
  addBulletAction,
  addEducationAction,
  addExperienceAction,
  addProjectAction,
  addSkillAction,
  deleteBulletAction,
  deleteEducationAction,
  deleteExperienceAction,
  deleteProjectAction,
  deleteSkillAction,
  reorderBulletsAction,
  reorderEducationsAction,
  reorderExperiencesAction,
  reorderProjectsAction,
  reorderSkillsAction,
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
import { cn } from "@/lib/utils";

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
const fieldHeading = "font-medium text-neutral-900 dark:text-neutral-50";

function ItemControls({
  canUp,
  canDown,
  onUp,
  onDown,
  onDelete,
  className,
}: {
  canUp: boolean;
  canDown: boolean;
  onUp: () => void;
  onDown: () => void;
  onDelete: () => void;
  className?: string;
}) {
  const btn =
    "inline-flex size-6 items-center justify-center rounded text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-30 disabled:hover:bg-transparent dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100";
  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100",
        className,
      )}
    >
      <button type="button" onClick={onUp} disabled={!canUp} className={btn} aria-label="Move up">
        <ChevronUp className="size-4" />
      </button>
      <button type="button" onClick={onDown} disabled={!canDown} className={btn} aria-label="Move down">
        <ChevronDown className="size-4" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        className={cn(btn, "hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400")}
        aria-label="Delete"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-dashed border-neutral-300 px-3 py-1.5 text-xs text-neutral-500 transition-colors hover:border-neutral-400 hover:bg-neutral-50 hover:text-neutral-700 dark:border-neutral-700 dark:text-neutral-400 dark:hover:border-neutral-600 dark:hover:bg-neutral-900 dark:hover:text-neutral-200"
    >
      <Plus className="size-3.5" />
      {label}
    </button>
  );
}

export function ResumeEditor({ resume }: { resume: ResumeEditorData }) {
  const router = useRouter();

  function moveItem<T extends { id: string }>(items: readonly T[], index: number, dir: -1 | 1): string[] {
    const newOrder = [...items];
    const j = index + dir;
    [newOrder[index], newOrder[j]] = [newOrder[j]!, newOrder[index]!];
    return newOrder.map((it) => it.id);
  }

  async function withRefresh<T>(fn: () => Promise<T>): Promise<T> {
    const result = await fn();
    router.refresh();
    return result;
  }

  return (
    <main className="min-h-screen bg-white px-6 py-16 dark:bg-neutral-950">
      <div className="mx-auto max-w-2xl space-y-12">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-baseline sm:justify-between">
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
          <div className="flex gap-2">
            <Link
              href={`/resume/${resume.id}/preview`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Eye className="size-4" />
              Preview
            </Link>
            <Link
              href={`/resume/${resume.id}/pdf`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Download className="size-4" />
              Download PDF
            </Link>
            <Link href="/dashboard" className={buttonVariants({ variant: "outline", size: "sm" })}>
              ← Dashboard
            </Link>
          </div>
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
                onSave={async (next) => updateContactInfoAction(resume.id, { email: next })}
                ariaLabel="Email"
              />
              <EditableText
                value={resume.contactInfo.phone}
                placeholder="Phone"
                onSave={async (next) => updateContactInfoAction(resume.id, { phone: next })}
                ariaLabel="Phone"
              />
              <EditableText
                value={resume.contactInfo.location}
                placeholder="Location"
                onSave={async (next) => updateContactInfoAction(resume.id, { location: next })}
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

        <section>
          <h2 className={sectionLabel}>Experience</h2>
          {resume.experiences.length > 0 && (
            <ul className="mt-4 space-y-6">
              {resume.experiences.map((exp, expIdx) => (
                <li key={exp.id} className="group relative">
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
                      <ItemControls
                        canUp={expIdx > 0}
                        canDown={expIdx < resume.experiences.length - 1}
                        onUp={() =>
                          withRefresh(() =>
                            reorderExperiencesAction(resume.id, moveItem(resume.experiences, expIdx, -1)),
                          )
                        }
                        onDown={() =>
                          withRefresh(() =>
                            reorderExperiencesAction(resume.id, moveItem(resume.experiences, expIdx, 1)),
                          )
                        }
                        onDelete={() =>
                          withRefresh(() => deleteExperienceAction(resume.id, exp.id))
                        }
                        className="ml-2"
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
                          router.refresh();
                        }}
                      />
                      Current
                    </label>
                  </div>
                  {exp.bullets.length > 0 && (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700 dark:text-neutral-300">
                      {exp.bullets.map((b, bIdx) => (
                        <li key={b.id} className="group/bullet flex items-start gap-2">
                          <EditableText
                            value={b.text}
                            multiline
                            emptyAsNull={false}
                            onSave={async (next) => {
                              if (!next) return;
                              await updateBulletAction(resume.id, b.id, { text: next });
                            }}
                            ariaLabel="Bullet"
                            className="flex-1"
                          />
                          <ItemControls
                            canUp={bIdx > 0}
                            canDown={bIdx < exp.bullets.length - 1}
                            onUp={() =>
                              withRefresh(() =>
                                reorderBulletsAction(
                                  resume.id,
                                  exp.id,
                                  moveItem(exp.bullets, bIdx, -1),
                                ),
                              )
                            }
                            onDown={() =>
                              withRefresh(() =>
                                reorderBulletsAction(
                                  resume.id,
                                  exp.id,
                                  moveItem(exp.bullets, bIdx, 1),
                                ),
                              )
                            }
                            onDelete={() =>
                              withRefresh(() => deleteBulletAction(resume.id, b.id))
                            }
                            className="opacity-0 group-hover/bullet:opacity-100"
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                  <AddButton
                    label="Add bullet"
                    onClick={() => withRefresh(() => addBulletAction(resume.id, exp.id))}
                  />
                </li>
              ))}
            </ul>
          )}
          <AddButton
            label="Add experience"
            onClick={() => withRefresh(() => addExperienceAction(resume.id))}
          />
        </section>

        <section>
          <h2 className={sectionLabel}>Education</h2>
          {resume.educations.length > 0 && (
            <ul className="mt-4 space-y-4">
              {resume.educations.map((ed, edIdx) => (
                <li key={ed.id} className="group">
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
                      <ItemControls
                        canUp={edIdx > 0}
                        canDown={edIdx < resume.educations.length - 1}
                        onUp={() =>
                          withRefresh(() =>
                            reorderEducationsAction(resume.id, moveItem(resume.educations, edIdx, -1)),
                          )
                        }
                        onDown={() =>
                          withRefresh(() =>
                            reorderEducationsAction(resume.id, moveItem(resume.educations, edIdx, 1)),
                          )
                        }
                        onDelete={() =>
                          withRefresh(() => deleteEducationAction(resume.id, ed.id))
                        }
                        className="ml-2"
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
          )}
          <AddButton
            label="Add education"
            onClick={() => withRefresh(() => addEducationAction(resume.id))}
          />
        </section>

        <section>
          <h2 className={sectionLabel}>Skills</h2>
          {resume.skills.length > 0 && (
            <ul className="mt-4 space-y-2 text-sm">
              {resume.skills.map((s, sIdx) => (
                <li key={s.id} className="group flex items-baseline gap-3">
                  <EditableText
                    value={s.category}
                    placeholder="Category (optional)"
                    onSave={async (next) => updateSkillAction(resume.id, s.id, { category: next })}
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
                    className="flex-1 text-neutral-700 dark:text-neutral-300"
                  />
                  <ItemControls
                    canUp={sIdx > 0}
                    canDown={sIdx < resume.skills.length - 1}
                    onUp={() =>
                      withRefresh(() =>
                        reorderSkillsAction(resume.id, moveItem(resume.skills, sIdx, -1)),
                      )
                    }
                    onDown={() =>
                      withRefresh(() =>
                        reorderSkillsAction(resume.id, moveItem(resume.skills, sIdx, 1)),
                      )
                    }
                    onDelete={() => withRefresh(() => deleteSkillAction(resume.id, s.id))}
                  />
                </li>
              ))}
            </ul>
          )}
          <AddButton
            label="Add skill"
            onClick={() => withRefresh(() => addSkillAction(resume.id))}
          />
        </section>

        <section>
          <h2 className={sectionLabel}>Projects</h2>
          {resume.projects.length > 0 && (
            <ul className="mt-4 space-y-4">
              {resume.projects.map((p, pIdx) => (
                <li key={p.id} className="group">
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
                      onSave={async (next) => updateProjectAction(resume.id, p.id, { link: next })}
                      ariaLabel="Project link"
                      className={`flex-1 text-sm ${fieldGray}`}
                    />
                    <ItemControls
                      canUp={pIdx > 0}
                      canDown={pIdx < resume.projects.length - 1}
                      onUp={() =>
                        withRefresh(() =>
                          reorderProjectsAction(resume.id, moveItem(resume.projects, pIdx, -1)),
                        )
                      }
                      onDown={() =>
                        withRefresh(() =>
                          reorderProjectsAction(resume.id, moveItem(resume.projects, pIdx, 1)),
                        )
                      }
                      onDelete={() => withRefresh(() => deleteProjectAction(resume.id, p.id))}
                    />
                  </div>
                  <EditableText
                    value={p.description}
                    multiline
                    placeholder="Description"
                    onSave={async (next) => updateProjectAction(resume.id, p.id, { description: next })}
                    ariaLabel="Project description"
                    className="text-sm text-neutral-700 dark:text-neutral-300"
                  />
                </li>
              ))}
            </ul>
          )}
          <AddButton
            label="Add project"
            onClick={() => withRefresh(() => addProjectAction(resume.id))}
          />
        </section>

        <footer className="border-t border-neutral-200 pt-4 text-xs text-neutral-400 dark:border-neutral-800 dark:text-neutral-600">
          Edits save when you tab away. Hover an item to reorder or delete.
        </footer>
      </div>
    </main>
  );
}
