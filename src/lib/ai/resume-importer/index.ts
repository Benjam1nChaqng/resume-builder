import { get } from "@vercel/blob";
import { MODELS } from "@/lib/ai/models";
import {
  generateStructured,
  type StructuredModelInput,
} from "@/lib/ai/openai";
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
  const userContent: StructuredModelInput =
    input.kind === "pdf"
      ? [
          {
            type: "input_file",
            filename: "resume.pdf",
            file_data: `data:application/pdf;base64,${await fetchPrivatePdfAsBase64(input.pdfUrl)}`,
            detail: "low",
          },
          {
            type: "input_text",
            text: "Extract this resume into the required structured format.",
          },
        ]
      : [
          {
            type: "input_text",
            text: `Extract this resume into the required structured format.\n\n--- RESUME TEXT ---\n${input.content}`,
          },
        ];

  return generateStructured({
    model: MODELS.PLANNER,
    schema: ParsedResumeSchema,
    schemaName: TOOL_NAME,
    system: SYSTEM_PROMPT,
    input: userContent,
    maxOutputTokens: 8192,
    reasoningEffort: "low",
  });
}
