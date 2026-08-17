import { z, ZodError } from "zod";
import {
  agentJson,
  isAgentErrorResponse,
  requireAgentRequest,
} from "@/lib/agent/http";
import {
  createTailoredResumeCopyForUser,
  TailoredBulletChangesSchema,
} from "@/lib/jobs/tailored-resume";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  jobId: z.string().min(1),
  resumeId: z.string().min(1),
  changes: TailoredBulletChangesSchema,
});

export async function POST(request: Request) {
  const access = await requireAgentRequest(request);
  if (isAgentErrorResponse(access)) return access;

  try {
    const input = RequestSchema.parse(await request.json());
    const tailoredResumeId = await createTailoredResumeCopyForUser({
      userId: access.userId,
      jobId: input.jobId,
      resumeId: input.resumeId,
      acceptedChanges: input.changes,
    });
    return agentJson({ tailoredResumeId }, { status: 201 });
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
