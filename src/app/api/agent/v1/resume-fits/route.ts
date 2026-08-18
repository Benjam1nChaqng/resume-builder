import { ZodError } from "zod";
import {
  AgentResumeJobFitSchema,
  saveAgentResumeJobFit,
} from "@/lib/agent/fits";
import {
  agentJson,
  isAgentErrorResponse,
  requireAgentRequest,
} from "@/lib/agent/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const access = await requireAgentRequest(request);
  if (isAgentErrorResponse(access)) return access;

  try {
    const input = AgentResumeJobFitSchema.parse(await request.json());
    return agentJson(
      await saveAgentResumeJobFit({ userId: access.userId, input }),
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return agentJson(
        { error: "Invalid request", issues: error.issues },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message.includes("not found")) {
      return agentJson({ error: "Job or resume not found" }, { status: 404 });
    }
    throw error;
  }
}
