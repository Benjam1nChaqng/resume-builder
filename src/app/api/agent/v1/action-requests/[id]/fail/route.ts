import { ZodError } from "zod";
import {
  agentJson,
  isAgentErrorResponse,
  requireAgentRequest,
} from "@/lib/agent/http";
import { applicationWorkflowErrorResponse } from "@/lib/agent/application-workflow-http";
import {
  ApplicationActionFailureSchema,
  failClaimedApplicationActionForUser,
} from "@/lib/jobs/application-workflow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireAgentRequest(request);
  if (isAgentErrorResponse(access)) return access;

  try {
    const { id } = await params;
    const input = ApplicationActionFailureSchema.parse(await request.json());
    return agentJson(
      await failClaimedApplicationActionForUser({
        userId: access.userId,
        tokenId: access.tokenId,
        requestId: id,
        errorSummary: input.errorSummary,
      }),
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return agentJson(
        { error: "Invalid request", issues: error.issues },
        { status: 400 },
      );
    }
    const response = applicationWorkflowErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
