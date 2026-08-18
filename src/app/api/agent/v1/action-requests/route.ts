import { ZodError } from "zod";
import {
  agentJson,
  isAgentErrorResponse,
  requireAgentRequest,
} from "@/lib/agent/http";
import { applicationWorkflowErrorResponse } from "@/lib/agent/application-workflow-http";
import {
  ApplicationActionRequestInputSchema,
  createApplicationActionRequestForUser,
} from "@/lib/jobs/application-workflow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const access = await requireAgentRequest(request);
  if (isAgentErrorResponse(access)) return access;

  try {
    const input = ApplicationActionRequestInputSchema.parse(await request.json());
    const result = await createApplicationActionRequestForUser({
      userId: access.userId,
      input,
    });
    return agentJson(result, { status: result.created ? 201 : 200 });
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
