import { z } from "zod";
import { getAnthropic } from "@/lib/ai/anthropic";
import { MODELS } from "@/lib/ai/models";
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

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (compatible; ResumeBuilderBot/0.1; +https://github.com/Benjam1nChaqng/resume-builder)",
  Accept: "text/html,application/xhtml+xml",
};

export async function scrapeJobDescription({
  url,
}: ScrapeInput): Promise<JobDescription> {
  const response = await fetch(url, { headers: FETCH_HEADERS });

  if (!response.ok) {
    throw new Error(
      `JDScraper: fetch failed for ${url} with status ${response.status}`,
    );
  }

  const html = await response.text();
  const anthropic = getAnthropic();
  const inputSchema = z.toJSONSchema(JobDescriptionSchema);

  const claudeResponse = await anthropic.messages.create({
    model: MODELS.PLANNER,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Source URL: ${url}\n\nExtract the job description from this HTML via the ${TOOL_NAME} tool.\n\n--- HTML ---\n${html}`,
          },
        ],
      },
    ],
    tools: [
      {
        name: TOOL_NAME,
        description:
          "Return the structured job description extracted from the page HTML.",
        input_schema: inputSchema as never,
      },
    ],
    tool_choice: { type: "tool", name: TOOL_NAME },
  });

  const toolUse = claudeResponse.content.find(
    (block): block is Extract<typeof block, { type: "tool_use" }> =>
      block.type === "tool_use" && block.name === TOOL_NAME,
  );

  if (!toolUse) {
    throw new Error(
      `JDScraper: Claude did not return a tool_use block for "${TOOL_NAME}". stop_reason=${claudeResponse.stop_reason}`,
    );
  }

  return JobDescriptionSchema.parse(toolUse.input);
}
