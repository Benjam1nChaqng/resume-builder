import { ZodError } from "zod";
import { ParsedResumeSchema } from "@/lib/ai/resume-importer/schema";
import {
  agentJson,
  isAgentErrorResponse,
  requireAgentRequest,
} from "@/lib/agent/http";
import { insertResumeWithRelations } from "@/lib/resumes/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const access = await requireAgentRequest(request);
  if (isAgentErrorResponse(access)) return access;

  try {
    const parsed = ParsedResumeSchema.parse(await request.json());
    const resumeId = await insertResumeWithRelations({
      userId: access.userId,
      parsed,
      sourcePdfUrl: null,
    });
    return agentJson({ resumeId }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return agentJson(
        { error: "Invalid request", issues: error.issues },
        { status: 400 },
      );
    }
    throw error;
  }
}
