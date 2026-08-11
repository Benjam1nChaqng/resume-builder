"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createTailoredResumeCopyAction,
  tailorResumeForJobAction,
} from "@/app/actions/jobs";
import { Button } from "@/components/ui/button";
import type { TailorResumeResult } from "@/lib/jobs/tailor";

type Props = {
  jobId: string;
  resumes: Array<{ id: string; title: string }>;
};

export function JobTailorPanel({ jobId, resumes }: Props) {
  const router = useRouter();
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null);
  const [result, setResult] = useState<TailorResumeResult | null>(null);
  const [acceptedKeys, setAcceptedKeys] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isCreating, startCreating] = useTransition();

  function handleTailor(resumeId: string) {
    setSelectedResumeId(resumeId);
    setResult(null);
    setError(null);
    startTransition(async () => {
      try {
        const tailored = await tailorResumeForJobAction(jobId, resumeId);
        setResult(tailored);
        setAcceptedKeys(
          new Set(
            tailored.experiences.flatMap((experience) =>
              experience.before
                .filter((_, index) => Boolean(experience.tailored[index]))
                .map((bullet) => `${experience.experienceId}:${bullet.id}`),
            ),
          ),
        );
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Tailoring failed");
      }
    });
  }

  function handleCreateCopy() {
    if (!result || !selectedResumeId) return;
    const acceptedChanges = result.experiences.flatMap((experience) =>
      experience.before.flatMap((bullet, index) => {
        const tailored = experience.tailored[index];
        if (
          !tailored ||
          !acceptedKeys.has(`${experience.experienceId}:${bullet.id}`)
        ) {
          return [];
        }
        return [
          {
            experienceId: experience.experienceId,
            bulletId: bullet.id,
            text: tailored.text,
          },
        ];
      }),
    );

    setError(null);
    startCreating(async () => {
      try {
        await createTailoredResumeCopyAction(
          jobId,
          selectedResumeId,
          acceptedChanges,
        );
        router.push(
          `/job/${jobId}?resume=${encodeURIComponent(selectedResumeId)}&notice=tailored-created`,
        );
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Unable to create resume copy",
        );
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
        Pick a resume to preview a JD-aligned rewrite. Nothing is saved until you
        approve the changes.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {resumes.map((resume) => {
          const isSelected = selectedResumeId === resume.id;
          return (
            <Button
              key={resume.id}
              type="button"
              variant={isSelected ? "default" : "outline"}
              onClick={() => handleTailor(resume.id)}
              disabled={(isPending && isSelected) || isCreating}
            >
              {isPending && isSelected ? "Tailoring..." : resume.title}
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
            result.experiences.map((experience) => (
              <ExperienceDiff
                key={experience.experienceId}
                exp={experience}
                acceptedKeys={acceptedKeys}
                onToggle={(key, accepted) =>
                  setAcceptedKeys((current) => {
                    const next = new Set(current);
                    if (accepted) next.add(key);
                    else next.delete(key);
                    return next;
                  })
                }
              />
            ))
          )}
          {result.experiences.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-neutral-200 pt-5 dark:border-neutral-800 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-neutral-500">
                {acceptedKeys.size} tailored bullet
                {acceptedKeys.size === 1 ? "" : "s"} selected
              </p>
              <Button
                type="button"
                disabled={isCreating || acceptedKeys.size === 0}
                onClick={handleCreateCopy}
              >
                {isCreating ? "Creating copy..." : "Create tailored resume"}
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ExperienceDiff({
  exp,
  acceptedKeys,
  onToggle,
}: {
  exp: TailorResumeResult["experiences"][number];
  acceptedKeys: Set<string>;
  onToggle: (key: string, accepted: boolean) => void;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
      <h3 className="text-base font-medium text-neutral-900 dark:text-neutral-50">
        {exp.role} <span className="text-neutral-500">|</span>{" "}
        <span className="text-neutral-500">{exp.company}</span>
      </h3>

      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <div>
          <h4 className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            Before
          </h4>
          <ul className="mt-2 space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
            {exp.before.map((bullet) => (
              <li
                key={bullet.id}
                className="list-disc pl-2 marker:text-neutral-400"
              >
                {bullet.text}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            After
          </h4>
          <ul className="mt-2 space-y-2 text-sm text-neutral-900 dark:text-neutral-100">
            {exp.tailored.map((tailored, index) => {
              const bullet = exp.before[index];
              if (!bullet) return null;
              const key = `${exp.experienceId}:${bullet.id}`;
              return (
                <li key={key} className="group relative flex gap-2">
                  <input
                    type="checkbox"
                    checked={acceptedKeys.has(key)}
                    onChange={(event) => onToggle(key, event.target.checked)}
                    aria-label={`Use tailored bullet ${index + 1}`}
                    className="mt-1 size-4 shrink-0"
                  />
                  <span title={tailored.rationale}>{tailored.text}</span>
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute left-6 top-full z-10 mt-1 hidden w-[calc(100%-1.5rem)] rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-700 shadow-lg group-hover:block dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300"
                  >
                    <span className="font-medium">Why:</span>{" "}
                    {tailored.rationale}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
