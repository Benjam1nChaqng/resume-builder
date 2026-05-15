import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { job } from "@/lib/db/jobs-schema";

export async function loadJobOwner(jobId: string): Promise<string | null> {
  const rows = await db
    .select({ userId: job.userId })
    .from(job)
    .where(eq(job.id, jobId))
    .limit(1);
  return rows[0]?.userId ?? null;
}
