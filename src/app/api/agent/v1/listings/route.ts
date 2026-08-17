import { ZodError } from "zod";
import {
  agentJson,
  isAgentErrorResponse,
  requireAgentRequest,
} from "@/lib/agent/http";
import {
  AgentListingBatchSchema,
  ingestAgentListings,
} from "@/lib/agent/listings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const access = await requireAgentRequest(request);
  if (isAgentErrorResponse(access)) return access;

  try {
    const input = AgentListingBatchSchema.parse(await request.json());
    return agentJson(await ingestAgentListings({ userId: access.userId, input }));
  } catch (error) {
    if (error instanceof ZodError) {
      return agentJson(
        { error: "Invalid request", issues: error.issues },
        { status: 400 },
      );
    }
    if (error instanceof SyntaxError) {
      return agentJson({ error: "Invalid JSON" }, { status: 400 });
    }
    if (error instanceof Error && error.message.includes("not found")) {
      return agentJson({ error: "Search profile not found" }, { status: 404 });
    }
    throw error;
  }
}
