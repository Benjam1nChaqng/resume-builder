import { z, ZodError } from "zod";
import {
  agentJson,
  isAgentErrorResponse,
  requireAgentRequest,
} from "@/lib/agent/http";
import {
  FIT_CHECK_FAILURE_MESSAGE,
  runResumeJobFitForUser,
} from "@/lib/jobs/fit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AgentResumeFitRunSchema = z
  .object({
    jobId: z.string().min(1),
    resumeId: z.string().min(1),
  })
  .strict();

export async function POST(request: Request) {
  const access = await requireAgentRequest(request);
  if (isAgentErrorResponse(access)) return access;

  try {
    const input = AgentResumeFitRunSchema.parse(await request.json());
    const fitId = await runResumeJobFitForUser({
      userId: access.userId,
      jobId: input.jobId,
      resumeId: input.resumeId,
    });
    return agentJson({ fitId }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return agentJson(
        {
          error: "Invalid request",
          ...(error instanceof ZodError ? { issues: error.issues } : {}),
        },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message.includes("not found")) {
      return agentJson({ error: "Job or resume not found" }, { status: 404 });
    }
    if (error instanceof Error && error.message === FIT_CHECK_FAILURE_MESSAGE) {
      return agentJson({ error: FIT_CHECK_FAILURE_MESSAGE }, { status: 502 });
    }
    throw error;
  }
}
