import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { agentAccessToken } from "@/lib/db/agent-schema";
import {
  agentTokenDisplayPrefix,
  generateAgentToken,
  hashAgentToken,
  readBearerToken,
} from "./token";

export {
  AGENT_TOKEN_PREFIX,
  agentTokenDisplayPrefix,
  generateAgentToken,
  hashAgentToken,
  readBearerToken,
} from "./token";

export const AgentTokenNameSchema = z
  .string()
  .trim()
  .min(1, "Enter a name for this key.")
  .max(80, "Key names must be 80 characters or fewer.");

export type AgentAccess = {
  tokenId: string;
  userId: string;
};

export async function createAgentAccessToken({
  userId,
  name,
}: {
  userId: string;
  name: string;
}): Promise<{ id: string; token: string }> {
  const parsedName = AgentTokenNameSchema.parse(name);
  const token = generateAgentToken();
  const id = randomUUID();

  await db.insert(agentAccessToken).values({
    id,
    userId,
    name: parsedName,
    tokenHash: hashAgentToken(token),
    tokenPrefix: agentTokenDisplayPrefix(token),
  });

  return { id, token };
}

export async function listAgentAccessTokens(userId: string) {
  return db
    .select({
      id: agentAccessToken.id,
      name: agentAccessToken.name,
      tokenPrefix: agentAccessToken.tokenPrefix,
      createdAt: agentAccessToken.createdAt,
      lastUsedAt: agentAccessToken.lastUsedAt,
      revokedAt: agentAccessToken.revokedAt,
    })
    .from(agentAccessToken)
    .where(eq(agentAccessToken.userId, userId))
    .orderBy(desc(agentAccessToken.createdAt));
}

export async function revokeAgentAccessToken({
  userId,
  tokenId,
}: {
  userId: string;
  tokenId: string;
}): Promise<boolean> {
  const rows = await db
    .update(agentAccessToken)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(agentAccessToken.id, tokenId),
        eq(agentAccessToken.userId, userId),
        isNull(agentAccessToken.revokedAt),
      ),
    )
    .returning({ id: agentAccessToken.id });
  return Boolean(rows[0]);
}

export async function authenticateAgentRequest(
  request: Request,
): Promise<AgentAccess | null> {
  const token = readBearerToken(request);
  if (!token) return null;

  const rows = await db
    .select({
      tokenId: agentAccessToken.id,
      userId: agentAccessToken.userId,
    })
    .from(agentAccessToken)
    .where(
      and(
        eq(agentAccessToken.tokenHash, hashAgentToken(token)),
        isNull(agentAccessToken.revokedAt),
      ),
    )
    .limit(1);
  const access = rows[0];
  if (!access) return null;

  await db
    .update(agentAccessToken)
    .set({ lastUsedAt: new Date() })
    .where(eq(agentAccessToken.id, access.tokenId));

  return access;
}
