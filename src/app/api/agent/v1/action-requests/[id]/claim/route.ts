import {
  agentJson,
  isAgentErrorResponse,
  requireAgentRequest,
} from "@/lib/agent/http";
import { applicationWorkflowErrorResponse } from "@/lib/agent/application-workflow-http";
import { claimApprovedApplicationActionForUser } from "@/lib/jobs/application-workflow";

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
    return agentJson(
      await claimApprovedApplicationActionForUser({
        userId: access.userId,
        tokenId: access.tokenId,
        requestId: id,
      }),
    );
  } catch (error) {
    const response = applicationWorkflowErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
