"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Mail, ShieldCheck, Sparkles } from "lucide-react";
import {
  draftJobEmailAction,
  queueOutreachEmailAction,
} from "@/app/actions/jobs";
import { gmailComposeUrl, mailtoUrl } from "@/lib/email/links";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ResumeOption = { id: string; title: string };

export function JobEmailPanel({
  jobId,
  resumes,
}: {
  jobId: string;
  resumes: ResumeOption[];
}) {
  const [resumeId, setResumeId] = useState(resumes[0]?.id ?? "");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [drafted, setDrafted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [queueStatus, setQueueStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isQueuePending, startQueueTransition] = useTransition();
  const router = useRouter();

  function handleDraft() {
    setError(null);
    setCopied(false);
    setQueueStatus(null);
    startTransition(async () => {
      try {
        const result = await draftJobEmailAction(jobId, resumeId);
        setSubject(result.subject);
        setBody(result.body);
        setDrafted(true);
      } catch {
        setError("Could not draft the email. Please try again.");
      }
    });
  }

  const draft = { to: to.trim() || null, subject, body };

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy the email. Select the text and copy it manually.");
    }
  }

  function queueForApproval() {
    setError(null);
    setQueueStatus(null);
    startQueueTransition(async () => {
      try {
        const result = await queueOutreachEmailAction(
          jobId,
          resumeId,
          to,
          subject,
          body,
        );
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setQueueStatus(
          result.created
            ? "Saved and queued for approval."
            : "This exact email is already in the approval queue.",
        );
        router.refresh();
      } catch {
        setError("Could not save this email to the approval queue.");
      }
    });
  }

  if (resumes.length === 0) {
    return (
      <section className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
        <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-50">
          Draft an email
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          Import a resume first, then you can draft a tailored email here.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
      <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-50">
        Draft an email
      </h2>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        We write a tailored email from your resume and this job. You review it,
        then open it in your own email and hit send.
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="email-resume">Use which resume?</Label>
          <select
            id="email-resume"
            value={resumeId}
            onChange={(e) => setResumeId(e.target.value)}
            className="h-9 w-full rounded-md border border-neutral-200 bg-transparent px-3 text-sm dark:border-neutral-800"
          >
            {resumes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </div>
        <Button type="button" onClick={handleDraft} disabled={isPending}>
          <Sparkles aria-hidden="true" />
          {isPending ? "Writing..." : drafted ? "Redraft" : "Draft email"}
        </Button>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}

      {drafted ? (
        <div className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email-to">To (optional)</Label>
            <Input
              id="email-to"
              type="email"
              placeholder="hiring@company.com"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email-subject">Subject</Label>
            <Input
              id="email-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email-body">Message</Label>
            <textarea
              id="email-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              className="w-full rounded-md border border-neutral-200 bg-transparent p-3 text-sm leading-relaxed dark:border-neutral-800"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={queueForApproval}
              disabled={
                isQueuePending || !to.trim() || !subject.trim() || !body.trim()
              }
            >
              <ShieldCheck aria-hidden="true" />
              {isQueuePending ? "Queuing..." : "Queue for approval"}
            </Button>
            <a
              href={gmailComposeUrl(draft)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center rounded-md bg-neutral-900 px-4 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              <Mail aria-hidden="true" />
              Open in Gmail
            </a>
            <a
              href={mailtoUrl(draft)}
              className="inline-flex h-9 items-center rounded-md border border-neutral-300 px-4 text-sm font-medium text-neutral-800 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-800"
            >
              <Mail aria-hidden="true" />
              Open in mail app
            </a>
            <Button type="button" variant="outline" size="sm" onClick={copyAll}>
              <Copy aria-hidden="true" />
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
          <p className="text-xs text-neutral-400">
            Attach your tailored resume PDF before sending.
          </p>
          {queueStatus ? (
            <p role="status" className="text-xs text-emerald-700 dark:text-emerald-400">
              {queueStatus}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
