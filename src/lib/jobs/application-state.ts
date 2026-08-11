import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { application, jobListing } from "@/lib/db/jobs-schema";
import { requireJobAccess } from "./access";

export async function markJobApplied({
  jobId,
}: {
  jobId: string;
}): Promise<void> {
  const { userId } = await requireJobAccess(jobId);
  const existing = await db
    .select({ id: application.id })
    .from(application)
    .where(and(eq(application.jobId, jobId), eq(application.userId, userId)))
    .limit(1);
  const appliedAt = new Date();

  if (existing[0]) {
    await db
      .update(application)
      .set({ status: "applied", appliedAt })
      .where(eq(application.id, existing[0].id));
  } else {
    await db.insert(application).values({
      id: randomUUID(),
      userId,
      jobId,
      status: "applied",
      appliedAt,
    });
  }

  await db
    .update(jobListing)
    .set({ status: "applied" })
    .where(eq(jobListing.jobId, jobId));
}
