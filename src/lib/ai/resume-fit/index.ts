import { z } from "zod";
import { getAnthropic } from "@/lib/ai/anthropic";
import { MODELS } from "@/lib/ai/models";
import { ResumeJobFitSchema, type ResumeJobFit } from "./schema";

const TOOL_NAME = "score_resume_fit";

const SYSTEM_PROMPT = `You are a rigorous resume-to-job fit reviewer.

Return source-backed resume fit analysis:
- score is 0-100, where 100 means the resume clearly satisfies the role.
- matchingEvidence cites specific resume evidence for JD requirements.
- missingRequirements are requirements not supported by the resume.
- concerns are risks, ambiguity, or weak signals.
- recommendations are concrete resume changes that would improve fit without inventing experience.
Never fabricate candidate experience.`;

export type AnalyzeResumeFitInput = {
  job: {
    title: string;
    company: string;
    description: string;
    requirements: string[];
    niceToHaves: string[] | null;
  };
  resumeText: string;
};

export async function analyzeResumeFit({
  job,
  resumeText,
}: AnalyzeResumeFitInput): Promise<ResumeJobFit> {
  const anthropic = getAnthropic();
  const inputSchema = z.toJSONSchema(ResumeJobFitSchema);

  const response = await anthropic.messages.create({
    model: MODELS.REVIEWER,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Job:\n${JSON.stringify(job, null, 2)}\n\nResume:\n${resumeText}`,
      },
    ],
    tools: [
      {
        name: TOOL_NAME,
        description: "Return the resume fit analysis for the job.",
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
    throw new Error(`ResumeFit: Claude did not return ${TOOL_NAME}.`);
  }

  return ResumeJobFitSchema.parse(toolUse.input);
}

