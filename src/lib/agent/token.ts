import { createHash, randomBytes } from "node:crypto";

export const AGENT_TOKEN_PREFIX = "rb_agent_";

export function generateAgentToken(): string {
  return `${AGENT_TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
}

export function hashAgentToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function agentTokenDisplayPrefix(token: string): string {
  return `${token.slice(0, AGENT_TOKEN_PREFIX.length + 8)}...`;
}

export function readBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+([^\s]+)$/i.exec(header.trim());
  const token = match?.[1] ?? null;
  return token && /^rb_agent_[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}
