import { MODELS } from "@/lib/ai/models";
import { generateStructured } from "@/lib/ai/openai";
import { fetchPublicHtml } from "@/lib/jobs/public-web";
import { JobDescriptionSchema, type JobDescription } from "./schema";

const TOOL_NAME = "extract_job_description";

const SYSTEM_PROMPT = `You parse job-posting HTML into structured JobDescription data.

Rules:
- Extract title, company, and the human-readable description (clean prose, no nav/footer/boilerplate).
- requirements = the must-have qualifications and responsibilities. Each entry is one sentence-or-less.
- niceToHaves = the "preferred" / "bonus" qualifications (null if the listing does not separate them).
- location, seniority, salaryMin, salaryMax = null if not present.
- Salaries are integers in the listing's stated currency. Use the midpoint of "$120k - $150k" as min=120000 max=150000.
- If a field is unknown or absent in the source, use null (or [] for arrays). Never invent data.`;

export type ScrapeInput = { url: string };

export async function scrapeJobDescription({
  url,
}: ScrapeInput): Promise<JobDescription> {
  const { html, finalUrl } = await fetchPublicHtml(url).catch((error) => {
    throw new Error(
      `JDScraper: fetch failed for ${url}: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  });
  return generateStructured({
    model: MODELS.PLANNER,
    schema: JobDescriptionSchema,
    schemaName: TOOL_NAME,
    system: SYSTEM_PROMPT,
    input: `Source URL: ${finalUrl}\n\nExtract the job description from this HTML.\n\n--- HTML ---\n${html}`,
    maxOutputTokens: 4096,
    reasoningEffort: "low",
  });
}
