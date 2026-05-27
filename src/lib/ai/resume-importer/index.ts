import { z } from "zod";
import { get } from "@vercel/blob";
import { getAnthropic } from "@/lib/ai/anthropic";
import { MODELS } from "@/lib/ai/models";
import { ParsedResumeSchema, type ParsedResume } from "./schema";

const TOOL_NAME = "extract_resume";

const SYSTEM_PROMPT = `You are a precise resume parser. Extract structured resume data from the user's input.

Rules:
- Output dates as YYYY-MM-DD. If only year+month is known, use day 01. If only year is known, use YYYY-01-01. If a date is unknown, use null.
- Set "current" = true for ongoing roles and set endDate to null.
- Group skills by category when obvious (e.g. "Languages", "Frameworks"); use category: null for ungrouped skills.
- Preserve the user's wording in bullets verbatim. Do not rewrite or paraphrase.
- If a field is unknown or absent in the source, use null (or [] for arrays). Never invent data.
- Set "title" to a short label for the resume (e.g. "Software Engineer Resume" or the user's most recent role).`;

export type ImportInput =
  | { kind: "text"; content: string }
  | { kind: "pdf"; pdfUrl: string };

async function fetchPrivatePdfAsBase64(pdfUrl: string): Promise<string> {
  const response = await get(pdfUrl, { access: "private" });
  if (!response) {
    throw new Error(`ResumeImporter: PDF blob not found at ${pdfUrl}`);
  }
  if (response.statusCode !== 200 || !response.stream) {
    throw new Error(
      `ResumeImporter: unexpected blob response (status=${response.statusCode})`,
    );
  }
  const bytes = await new Response(response.stream).arrayBuffer();
  return Buffer.from(bytes).toString("base64");
}

export async function importResume(input: ImportInput): Promise<ParsedResume> {
  const anthropic = getAnthropic();

  const userContent =
    input.kind === "pdf"
      ? ([
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: await fetchPrivatePdfAsBase64(input.pdfUrl),
            },
          },
          {
            type: "text",
            text: "Extract this resume into structured JSON via the extract_resume tool.",
          },
        ] as const)
      : ([
          {
            type: "text",
            text: `Extract this resume into structured JSON via the extract_resume tool.\n\n--- RESUME TEXT ---\n${input.content}`,
          },
        ] as const);

  const inputSchema = z.toJSONSchema(ParsedResumeSchema);

  const response = await anthropic.messages.create({
    model: MODELS.PLANNER,
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent as unknown as never }],
    tools: [
      {
        name: TOOL_NAME,
        description: "Return the structured resume data extracted from the user's input.",
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
      `ResumeImporter: Claude did not return a tool_use block for "${TOOL_NAME}". stop_reason=${response.stop_reason}`,
    );
  }

  return ParsedResumeSchema.parse(toolUse.input);
}
