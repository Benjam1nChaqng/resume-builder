import { z } from "zod";
import { getAnthropic } from "@/lib/ai/anthropic";
import { MODELS } from "@/lib/ai/models";
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
  const anthropic = getAnthropic();
  const inputSchema = z.toJSONSchema(JobEmailSchema);

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
    `Write the application email via the ${TOOL_NAME} tool.`,
  ]
    .filter((line) => line !== ``)
    .join("\n");

  const response = await anthropic.messages.create({
    model: MODELS.PLANNER,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: [{ type: "text", text: userContent }] }],
    tools: [
      {
        name: TOOL_NAME,
        description: "Return the composed job-application email.",
        input_schema: inputSchema as never,
      },
    ],
    tool_choice: { type: "tool", name: TOOL_NAME },
  });

  const toolUse = response.content.find(
    (block): block is Extract<typeof block, { type: "tool_use" }> =>
      block.type === "tool_use" && block.name === TOOL_NAME,
  );

  if (!toolUse) {
    throw new Error(
      `EmailWriter: Claude did not return a tool_use block for "${TOOL_NAME}". stop_reason=${response.stop_reason}`,
    );
  }

  return JobEmailSchema.parse(toolUse.input);
}
