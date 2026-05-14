import { z } from "zod";
import { getAnthropic } from "@/lib/ai/anthropic";
import { MODELS } from "@/lib/ai/models";
import {
  TailoredBulletsSchema,
  type TailorExperience,
  type TailorJobDescription,
  type TailoredBullets,
} from "./schema";

const TOOL_NAME = "tailor_bullets";

const SYSTEM_PROMPT = `You rewrite resume bullets to align with a target job description's requirements.

Constraints:
1. Keep the underlying truth — never invent metrics, technologies, scope, or accomplishments not present in the original bullet.
2. Match the job description's language and vocabulary where it overlaps with the user's actual experience. Do not paste JD phrases that don't reflect what the user did.
3. Produce exactly one tailored bullet per input bullet — never merge, split, drop, or add bullets.
4. For each rewritten bullet, also return a short rationale (one sentence) explaining what you changed and why.
5. Set originalText to the original bullet you rewrote so the UI can show a diff.`;

export type TailorInput = {
  experience: TailorExperience;
  jobDescription: TailorJobDescription;
};

export async function tailorBullets({
  experience,
  jobDescription,
}: TailorInput): Promise<TailoredBullets> {
  const anthropic = getAnthropic();
  const inputSchema = z.toJSONSchema(TailoredBulletsSchema);

  const niceToHavesBlock = jobDescription.niceToHaves?.length
    ? `\nNice-to-haves:\n${jobDescription.niceToHaves.map((h) => `- ${h}`).join("\n")}`
    : "";

  const userText = `Job: ${jobDescription.title}
Requirements:
${jobDescription.requirements.map((r) => `- ${r}`).join("\n")}${niceToHavesBlock}

Experience: ${experience.role} at ${experience.company}
Original bullets:
${experience.bullets.map((b, i) => `${i + 1}. ${b}`).join("\n")}

Rewrite each bullet to align with the requirements above, then return them via the ${TOOL_NAME} tool. Preserve order and count.`;

  const response = await anthropic.messages.create({
    model: MODELS.EXECUTOR,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: userText }],
      },
    ],
    tools: [
      {
        name: TOOL_NAME,
        description:
          "Return the JD-aligned rewrite of each input bullet, one for one, with a rationale per bullet.",
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
      `BulletTailorer: Claude did not return a tool_use block for "${TOOL_NAME}". stop_reason=${response.stop_reason}`,
    );
  }

  return TailoredBulletsSchema.parse(toolUse.input);
}
