import {
  Check,
  CircleAlert,
  CircleCheck,
  Clock3,
  FileText,
  Mail,
  Send,
  X,
} from "lucide-react";
import {
  approveApplicationActionRequestAction,
  rejectApplicationActionRequestAction,
} from "@/app/actions/jobs";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import type {
  applicationActionRequest,
  applicationArtifact,
} from "@/lib/db/jobs-schema";

type Artifact = typeof applicationArtifact.$inferSelect;
type ActionRequest = typeof applicationActionRequest.$inferSelect;

type EmailPayload = {
  to?: unknown;
  subject?: unknown;
  body?: unknown;
  attachments?: unknown;
};

type SubmissionPayload = {
  applicationUrl?: unknown;
  resumeId?: unknown;
  answerSummary?: unknown;
};

function words(value: string): string {
  return value.replaceAll("_", " ");
}

function ActionStatus({ request }: { request: ActionRequest }) {
  if (request.status === "approved") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
        <Clock3 className="size-3.5" aria-hidden="true" />
        Approved until {request.expiresAt?.toLocaleTimeString()}
      </span>
    );
  }
  if (request.status === "completed") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
        <CircleCheck className="size-3.5" aria-hidden="true" />
        Completed
      </span>
    );
  }
  if (request.status === "failed") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 dark:text-red-300">
        <CircleAlert className="size-3.5" aria-hidden="true" />
        Failed
      </span>
    );
  }
  return (
    <span className="text-xs font-medium capitalize text-neutral-500">
      {words(request.status)}
    </span>
  );
}

function EmailActionDetails({
  payload,
  resumeTitles,
}: {
  payload: EmailPayload;
  resumeTitles: Map<string, string>;
}) {
  const attachments = Array.isArray(payload.attachments)
    ? payload.attachments.filter(
        (item): item is { resumeId: string; filename?: string } =>
          Boolean(
            item &&
              typeof item === "object" &&
              "resumeId" in item &&
              typeof item.resumeId === "string",
          ),
      )
    : [];
  return (
    <div className="mt-3 space-y-2 text-sm">
      <p>
        <span className="font-medium">To:</span>{" "}
        {typeof payload.to === "string" ? payload.to : "Invalid recipient"}
      </p>
      <p>
        <span className="font-medium">Subject:</span>{" "}
        {typeof payload.subject === "string" ? payload.subject : "Invalid subject"}
      </p>
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap border-l border-neutral-200 pl-3 font-sans text-sm leading-relaxed dark:border-neutral-800">
        {typeof payload.body === "string" ? payload.body : "Invalid email body"}
      </pre>
      {attachments.length > 0 ? (
        <p className="text-xs text-neutral-500">
          Attachments:{" "}
          {attachments
            .map(
              (item) =>
                item.filename ?? resumeTitles.get(item.resumeId) ?? item.resumeId,
            )
            .join(", ")}
        </p>
      ) : null}
    </div>
  );
}

function SubmissionActionDetails({
  payload,
  resumeTitles,
}: {
  payload: SubmissionPayload;
  resumeTitles: Map<string, string>;
}) {
  const answers = Array.isArray(payload.answerSummary)
    ? payload.answerSummary.filter(
        (item): item is { question: string; answer: string } =>
          Boolean(
            item &&
              typeof item === "object" &&
              "question" in item &&
              "answer" in item &&
              typeof item.question === "string" &&
              typeof item.answer === "string",
          ),
      )
    : [];
  const resumeId = typeof payload.resumeId === "string" ? payload.resumeId : null;
  return (
    <div className="mt-3 space-y-3 text-sm">
      {typeof payload.applicationUrl === "string" ? (
        <a
          href={payload.applicationUrl}
          target="_blank"
          rel="noreferrer"
          className="break-all underline underline-offset-4"
        >
          {payload.applicationUrl}
        </a>
      ) : (
        <p className="text-red-600">Invalid application URL</p>
      )}
      <p>
        <span className="font-medium">Resume:</span>{" "}
        {resumeId ? resumeTitles.get(resumeId) ?? resumeId : "Invalid resume"}
      </p>
      {answers.length > 0 ? (
        <dl className="space-y-3 border-l border-neutral-200 pl-3 dark:border-neutral-800">
          {answers.map((item, index) => (
            <div key={`${item.question}:${index}`}>
              <dt className="font-medium">{item.question}</dt>
              <dd className="mt-1 whitespace-pre-wrap text-neutral-600 dark:text-neutral-400">
                {item.answer}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-xs text-neutral-500">No custom answers are included.</p>
      )}
    </div>
  );
}

export function ApplicationWorkspace({
  jobId,
  artifacts,
  actionRequests,
  resumes,
}: {
  jobId: string;
  artifacts: Artifact[];
  actionRequests: ActionRequest[];
  resumes: Array<{ id: string; title: string }>;
}) {
  const resumeTitles = new Map(resumes.map((item) => [item.id, item.title]));

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <section>
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-neutral-500" aria-hidden="true" />
          <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            Prepared materials
          </h3>
        </div>
        {artifacts.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">
            No saved research or writing yet.
          </p>
        ) : (
          <div className="mt-3 divide-y divide-neutral-200 border-y border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {artifacts.map((artifact) => (
              <details key={artifact.id} className="py-4">
                <summary className="cursor-pointer list-none">
                  <p className="font-medium text-neutral-900 dark:text-neutral-100">
                    {artifact.title}
                  </p>
                  <p className="mt-1 text-xs capitalize text-neutral-500">
                    {words(artifact.kind)} | {artifact.createdAt.toLocaleString()}
                    {artifact.usedAt ? " | Used" : ""}
                  </p>
                </summary>
                <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap border-l border-neutral-200 pl-3 font-sans text-sm leading-relaxed text-neutral-700 dark:border-neutral-800 dark:text-neutral-300">
                  {artifact.content}
                </pre>
                {artifact.sourceUrls.length > 0 ? (
                  <ul className="mt-3 space-y-1 text-xs">
                    {artifact.sourceUrls.map((url) => (
                      <li key={url}>
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="break-all text-neutral-500 underline underline-offset-4"
                        >
                          {url}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </details>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center gap-2">
          <Check className="size-4 text-neutral-500" aria-hidden="true" />
          <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            Approval queue
          </h3>
        </div>
        {actionRequests.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">No actions are awaiting review.</p>
        ) : (
          <div className="mt-3 divide-y divide-neutral-200 border-y border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {actionRequests.map((request) => (
              <article key={request.id} className="py-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      {request.action === "send_email" ? (
                        <Mail className="size-4" aria-hidden="true" />
                      ) : (
                        <Send className="size-4" aria-hidden="true" />
                      )}
                      <h4 className="font-medium text-neutral-900 dark:text-neutral-100">
                        {request.summary}
                      </h4>
                    </div>
                    <p className="mt-1 text-xs capitalize text-neutral-500">
                      {words(request.action)} | {request.createdAt.toLocaleString()}
                    </p>
                  </div>
                  <ActionStatus request={request} />
                </div>

                {request.action === "send_email" ? (
                  <EmailActionDetails
                    payload={request.payload as EmailPayload}
                    resumeTitles={resumeTitles}
                  />
                ) : (
                  <SubmissionActionDetails
                    payload={request.payload as SubmissionPayload}
                    resumeTitles={resumeTitles}
                  />
                )}

                {request.errorSummary ? (
                  <p className="mt-3 text-xs text-red-600 dark:text-red-400">
                    {request.errorSummary}
                  </p>
                ) : null}

                {request.status === "pending" ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <form
                      action={approveApplicationActionRequestAction.bind(
                        null,
                        jobId,
                        request.id,
                      )}
                    >
                      <PendingSubmitButton size="sm" pendingLabel="Approving...">
                        <Check aria-hidden="true" />
                        Approve for 30 minutes
                      </PendingSubmitButton>
                    </form>
                    <form
                      action={rejectApplicationActionRequestAction.bind(
                        null,
                        jobId,
                        request.id,
                      )}
                    >
                      <PendingSubmitButton
                        size="sm"
                        variant="outline"
                        pendingLabel="Rejecting..."
                      >
                        <X aria-hidden="true" />
                        Reject
                      </PendingSubmitButton>
                    </form>
                  </div>
                ) : request.status === "approved" ? (
                  <form
                    action={rejectApplicationActionRequestAction.bind(
                      null,
                      jobId,
                      request.id,
                    )}
                    className="mt-4"
                  >
                    <PendingSubmitButton
                      size="sm"
                      variant="outline"
                      pendingLabel="Revoking..."
                    >
                      <X aria-hidden="true" />
                      Revoke approval
                    </PendingSubmitButton>
                  </form>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
