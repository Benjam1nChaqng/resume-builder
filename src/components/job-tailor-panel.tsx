"use client";

import { useState, useTransition } from "react";
import { tailorResumeForJobAction } from "@/app/actions/jobs";
import { Button } from "@/components/ui/button";
import type { TailorResumeResult } from "@/lib/jobs/tailor";

type Props = {
  jobId: string;
  resumes: Array<{ id: string; title: string }>;
};

export function JobTailorPanel({ jobId, resumes }: Props) {
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [result, setResult] = useState<TailorResumeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleTailor(resumeId: string) {
    setSelectedResumeId(resumeId);
    setResult(null);
    setError(null);
    startTransition(async () => {
      try {
        const r = await tailorResumeForJobAction(jobId, resumeId);
        setResult(r);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Tailoring failed");
      }
    });
  }

  if (resumes.length === 0) {
    return (
      <section>
        <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-50">
          Tailor my resume
        </h2>
        <div className="mt-4 rounded-lg border border-dashed border-neutral-300 px-6 py-12 text-center text-sm text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
          You don&apos;t have a resume yet. Import one from the dashboard first.
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-50">
        Tailor my resume
      </h2>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        Pick a resume to preview a JD-aligned rewrite of each bullet. Nothing is
        saved.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {resumes.map((r) => {
          const isSelected = selectedResumeId === r.id;
          return (
            <Button
              key={r.id}
              type="button"
              variant={isSelected ? "default" : "outline"}
              onClick={() => handleTailor(r.id)}
              disabled={isPending && isSelected}
            >
              {isPending && isSelected ? "Tailoring…" : r.title}
            </Button>
          );
        })}
      </div>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-8 space-y-8">
          {result.experiences.length === 0 ? (
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              This resume has no experience bullets to tailor.
            </p>
          ) : (
            result.experiences.map((exp) => (
              <ExperienceDiff key={exp.experienceId} exp={exp} />
            ))
          )}
        </div>
      )}
    </section>
  );
}

function ExperienceDiff({
  exp,
}: {
  exp: TailorResumeResult["experiences"][number];
}) {
  return (
    <div className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
      <h3 className="text-base font-medium text-neutral-900 dark:text-neutral-50">
        {exp.role} <span className="text-neutral-500">·</span>{" "}
        <span className="text-neutral-500">{exp.company}</span>
      </h3>

      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Before
          </h4>
          <ul className="mt-2 space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
            {exp.before.map((b) => (
              <li key={b.id} className="list-disc pl-2 marker:text-neutral-400">
                {b.text}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            After
          </h4>
          <ul className="mt-2 space-y-2 text-sm text-neutral-900 dark:text-neutral-100">
            {exp.tailored.map((t, i) => (
              <li
                key={i}
                className="group relative list-disc pl-2 marker:text-neutral-400"
              >
                <span title={t.rationale}>{t.text}</span>
                <span
                  aria-hidden="true"
                  className="ml-1 cursor-help text-xs text-neutral-400"
                  title={t.rationale}
                >
                  ⓘ
                </span>
                <span
                  role="tooltip"
                  className="pointer-events-none absolute left-0 top-full z-10 mt-1 hidden w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-700 shadow-lg group-hover:block dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300"
                >
                  <span className="font-medium">Why:</span> {t.rationale}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
