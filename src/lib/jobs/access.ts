import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  ForbiddenError,
  UnauthorizedError,
} from "@/lib/access-errors";
import { loadJobOwner } from "./owner";

export { UnauthorizedError, ForbiddenError };

export async function requireJobAccess(
  jobId: string,
): Promise<{ userId: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    throw new UnauthorizedError();
  }

  const ownerUserId = await loadJobOwner(jobId);
  if (!ownerUserId || ownerUserId !== session.user.id) {
    throw new ForbiddenError();
  }

  return { userId: session.user.id };
}
