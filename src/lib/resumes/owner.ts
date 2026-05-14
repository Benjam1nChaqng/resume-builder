import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { resume } from "@/lib/db/resume-schema";

export async function loadResumeOwner(resumeId: string): Promise<string | null> {
  const rows = await db
    .select({ userId: resume.userId })
    .from(resume)
    .where(eq(resume.id, resumeId))
    .limit(1);
  return rows[0]?.userId ?? null;
}
