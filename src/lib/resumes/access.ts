import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { loadResumeOwner } from "./owner";

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor() {
    super("Forbidden");
    this.name = "ForbiddenError";
  }
}

export async function requireResumeAccess(
  resumeId: string,
): Promise<{ userId: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    throw new UnauthorizedError();
  }

  const ownerUserId = await loadResumeOwner(resumeId);
  if (!ownerUserId || ownerUserId !== session.user.id) {
    throw new ForbiddenError();
  }

  return { userId: session.user.id };
}
