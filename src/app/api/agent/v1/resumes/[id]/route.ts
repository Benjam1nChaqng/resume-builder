import { ZodError } from "zod";
import {
  agentJson,
  isAgentErrorResponse,
  requireAgentRequest,
} from "@/lib/agent/http";
import {
  AgentResumeContentUpdateSchema,
  updateResumeContentForUser,
} from "@/lib/agent/resume-updates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const access = await requireAgentRequest(request);
  if (isAgentErrorResponse(access)) return access;

  try {
    const input = AgentResumeContentUpdateSchema.parse(await request.json());
    const { id } = await params;
    const result = await updateResumeContentForUser({
      userId: access.userId,
      resumeId: id,
      input,
    });
    return agentJson(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return agentJson(
        { error: "Invalid request", issues: error.issues },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message.includes("not found")) {
      return agentJson({ error: "Resume not found" }, { status: 404 });
    }
    throw error;
  }
}
