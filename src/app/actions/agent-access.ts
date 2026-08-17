"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import {
  AgentTokenNameSchema,
  createAgentAccessToken,
  revokeAgentAccessToken,
} from "@/lib/agent/access";

export type CreateAgentTokenResult =
  | { ok: true; token: string }
  | { ok: false; error: string };

async function requireUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");
  return session.user.id;
}

export async function createAgentTokenAction(
  name: string,
): Promise<CreateAgentTokenResult> {
  const parsed = AgentTokenNameSchema.safeParse(name);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the key name.",
    };
  }

  const userId = await requireUserId();
  try {
    const created = await createAgentAccessToken({ userId, name: parsed.data });
    revalidatePath("/settings/agent-access");
    return { ok: true, token: created.token };
  } catch {
    return { ok: false, error: "Unable to create an access key right now." };
  }
}

export async function revokeAgentTokenAction(tokenId: string): Promise<void> {
  const userId = await requireUserId();
  await revokeAgentAccessToken({ userId, tokenId });
  revalidatePath("/settings/agent-access");
}
