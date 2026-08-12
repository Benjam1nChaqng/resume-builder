import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { application, jobListing } from "@/lib/db/jobs-schema";
import { requireJobAccess } from "./access";

export async function markJobApplied({
  jobId,
}: {
  jobId: string;
}): Promise<void> {
  const { userId } = await requireJobAccess(jobId);
  const appliedAt = new Date();
  await db.batch([
    db
      .insert(application)
      .values({
        id: randomUUID(),
        userId,
        jobId,
        status: "applied",
        appliedAt,
      })
      .onConflictDoUpdate({
        target: [application.userId, application.jobId],
        set: { status: "applied", appliedAt },
      }),
    db
      .update(jobListing)
      .set({ status: "applied" })
      .where(eq(jobListing.jobId, jobId)),
  ]);
}
