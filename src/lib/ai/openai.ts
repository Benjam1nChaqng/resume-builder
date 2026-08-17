import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { ResponseInputContent } from "openai/resources/responses/responses";
import { z } from "zod";
import { env } from "@/env";
import type { ModelName } from "./models";

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }
  return client;
}

export type StructuredModelInput = string | ResponseInputContent[];

export async function generateStructured<Schema extends z.ZodType>({
  model,
  schema,
  schemaName,
  system,
  input,
  maxOutputTokens,
  reasoningEffort = "low",
}: {
  model: ModelName;
  schema: Schema;
  schemaName: string;
  system: string;
  input: StructuredModelInput;
  maxOutputTokens: number;
  reasoningEffort?: "none" | "low" | "medium" | "high";
}): Promise<z.output<Schema>> {
  const response = await getOpenAI().responses.parse({
    model,
    instructions: system,
    input:
      typeof input === "string"
        ? input
        : [{ role: "user", content: input }],
    max_output_tokens: maxOutputTokens,
    reasoning: { effort: reasoningEffort },
    store: false,
    text: {
      format: zodTextFormat(schema, schemaName),
      verbosity: "low",
    },
  });

  if (!response.output_parsed) {
    throw new Error(
      `${schemaName}: OpenAI did not return valid structured output. status=${response.status}`,
    );
  }

  return schema.parse(response.output_parsed);
}
