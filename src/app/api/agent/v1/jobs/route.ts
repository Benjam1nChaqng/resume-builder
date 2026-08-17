import { ZodError } from "zod";
import {
  agentJson,
  isAgentErrorResponse,
  requireAgentRequest,
} from "@/lib/agent/http";
import {
  AgentStructuredJobSchema,
  saveAgentStructuredJob,
} from "@/lib/agent/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const access = await requireAgentRequest(request);
  if (isAgentErrorResponse(access)) return access;

  try {
    const input = AgentStructuredJobSchema.parse(await request.json());
    return agentJson(await saveAgentStructuredJob({ userId: access.userId, input }));
  } catch (error) {
    if (error instanceof ZodError) {
      return agentJson(
        { error: "Invalid request", issues: error.issues },
        { status: 400 },
      );
    }
    if (
      error instanceof Error &&
      (error.message.includes("not found") ||
        error.message.includes("does not match"))
    ) {
      return agentJson({ error: error.message }, { status: 404 });
    }
    if (error instanceof Error && error.message.includes("Rejected")) {
      return agentJson({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
