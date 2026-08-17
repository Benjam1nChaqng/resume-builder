import { authenticateAgentRequest, type AgentAccess } from "./access";

export const AGENT_API_HEADERS = {
  "Cache-Control": "private, no-store",
  "Content-Type": "application/json",
} as const;

export function agentJson(data: unknown, init: ResponseInit = {}): Response {
  return Response.json(data, {
    ...init,
    headers: { ...AGENT_API_HEADERS, ...init.headers },
  });
}

export async function requireAgentRequest(
  request: Request,
): Promise<AgentAccess | Response> {
  const access = await authenticateAgentRequest(request);
  return access ?? agentJson({ error: "Unauthorized" }, { status: 401 });
}

export function isAgentErrorResponse(
  value: AgentAccess | Response,
): value is Response {
  return value instanceof Response;
}
