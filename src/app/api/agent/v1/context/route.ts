import { loadAgentContext } from "@/lib/agent/context";
import {
  agentJson,
  isAgentErrorResponse,
  requireAgentRequest,
} from "@/lib/agent/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await requireAgentRequest(request);
  if (isAgentErrorResponse(access)) return access;
  return agentJson(await loadAgentContext(access.userId));
}
