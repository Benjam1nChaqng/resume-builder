import { ApplicationWorkflowError } from "@/lib/jobs/application-workflow";
import { agentJson } from "./http";

export function applicationWorkflowErrorResponse(
  error: unknown,
): Response | null {
  if (!(error instanceof ApplicationWorkflowError)) return null;
  return agentJson(
    { error: error.message, code: error.code },
    { status: error.code === "not_found" ? 404 : 409 },
  );
}
