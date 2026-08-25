import { z, ZodError } from "zod";
import {
  agentJson,
  isAgentErrorResponse,
  requireAgentRequest,
} from "@/lib/agent/http";
import { runJobDiscovery } from "@/lib/jobs/run-discovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AgentDiscoveryRunSchema = z
  .object({
    profileId: z.string().min(1),
    minAnnualSalary: z.number().int().min(80_000).default(80_000),
    minHourlySalary: z.number().min(50).default(50),
    maxPostedAgeDays: z.number().int().positive().max(90).default(90),
    allowMissingCompensation: z.boolean().default(true),
  })
  .strict();

export async function POST(request: Request) {
  const access = await requireAgentRequest(request);
  if (isAgentErrorResponse(access)) return access;

  try {
    const input = AgentDiscoveryRunSchema.parse(await request.json());
    return agentJson(
      await runJobDiscovery(
        { profileId: input.profileId, userId: access.userId },
        {},
        {
          minAnnualSalary: input.minAnnualSalary,
          minHourlySalary: input.minHourlySalary,
          maxPostedAgeDays: input.maxPostedAgeDays,
          allowMissingCompensation: input.allowMissingCompensation,
        },
      ),
    );
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
      return agentJson({ error: "Search profile not found" }, { status: 404 });
    }
    throw error;
  }
}
