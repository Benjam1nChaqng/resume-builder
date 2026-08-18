import { MODELS } from "@/lib/ai/models";
import { generateStructured } from "@/lib/ai/openai";
import { ResumeJobFitSchema, type ResumeJobFit } from "./schema";

export { RESUME_FIT_RUBRIC_VERSION } from "./schema";

const TOOL_NAME = "score_resume_fit";

const SYSTEM_PROMPT = `You are a rigorous resume-to-job fit reviewer.

Return source-backed resume fit analysis:
- score is 0-100, where 100 means the resume clearly satisfies the role.
- matchingEvidence cites specific resume evidence for JD requirements, names the resume source section, and assigns high, medium, or low confidence.
- missingRequirements are unmet required qualifications only.
- missingPreferredRequirements are unmet preferred or nice-to-have qualifications only.
- concerns are risks, ambiguity, or weak signals.
- unsupportedClaims are job-relevant claims, keywords, credentials, or metrics that must not be added because the resume provides no evidence for them.
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
  return generateStructured({
    model: MODELS.REVIEWER,
    schema: ResumeJobFitSchema,
    schemaName: TOOL_NAME,
    system: SYSTEM_PROMPT,
    input: `Job:\n${JSON.stringify(job, null, 2)}\n\nResume:\n${resumeText}`,
    maxOutputTokens: 2048,
    reasoningEffort: "medium",
  });
}
