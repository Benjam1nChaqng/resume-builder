import { MODELS } from "@/lib/ai/models";
import { generateStructured } from "@/lib/ai/openai";
import { JobEmailSchema, type JobEmail } from "./schema";

const TOOL_NAME = "compose_job_email";

const SYSTEM_PROMPT = `You write short, professional job-application emails on behalf of a candidate.

Rules:
- Truthful: use ONLY facts found in the candidate's resume. Never invent employers, titles, skills, or metrics.
- Subject: clear and specific, naming the role and company (e.g. "Application: AV Technician - Acme").
- Body: a warm greeting, then 2-3 short paragraphs that connect the candidate's REAL experience to what the job needs, then a brief call to action, then a sign-off with the candidate's name.
- Mention that the resume is attached.
- Keep it under ~180 words. Plain text, no markdown, no placeholders like [Company]. Use the real values provided.
- If the candidate's name is unknown, sign off with a neutral closing and no fabricated name.`;

export type DraftJobEmailInput = {
  job: {
    title: string;
    company: string | null;
    description: string | null;
    requirements: string[];
  };
  resumeText: string;
  candidateName: string;
};

export async function draftJobEmail({
  job,
  resumeText,
  candidateName,
}: DraftJobEmailInput): Promise<JobEmail> {
  const userContent = [
    `Candidate name: ${candidateName || "(unknown)"}`,
    ``,
    `JOB`,
    `Title: ${job.title}`,
    `Company: ${job.company ?? "(unknown)"}`,
    job.description ? `Description: ${job.description}` : ``,
    job.requirements.length > 0
      ? `Requirements:\n${job.requirements.map((r) => `- ${r}`).join("\n")}`
      : ``,
    ``,
    `CANDIDATE RESUME`,
    resumeText,
    ``,
    `Write the application email in the required structured format.`,
  ]
    .filter((line) => line !== ``)
    .join("\n");

  return generateStructured({
    model: MODELS.PLANNER,
    schema: JobEmailSchema,
    schemaName: TOOL_NAME,
    system: SYSTEM_PROMPT,
    input: userContent,
    maxOutputTokens: 1024,
    reasoningEffort: "low",
  });
}
