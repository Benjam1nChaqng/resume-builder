import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { job } from "@/lib/db/jobs-schema";
import type { JobDescription } from "@/lib/ai/jd-scraper/schema";

export type InsertJobInput = {
  userId: string;
  sourceUrl: string;
  parsed: JobDescription;
};

export async function insertJob({
  userId,
  sourceUrl,
  parsed,
}: InsertJobInput): Promise<string> {
  const id = randomUUID();
  await db.insert(job).values({
    id,
    userId,
    sourceUrl,
    title: parsed.title,
    company: parsed.company,
    location: parsed.location,
    description: parsed.description,
    requirements: parsed.requirements,
    niceToHaves: parsed.niceToHaves,
    seniority: parsed.seniority,
    salaryMin: parsed.salaryMin,
    salaryMax: parsed.salaryMax,
  });
  return id;
}

export async function getJobForUser(jobId: string, userId: string) {
  const rows = await db
    .select()
    .from(job)
    .where(and(eq(job.id, jobId), eq(job.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}
