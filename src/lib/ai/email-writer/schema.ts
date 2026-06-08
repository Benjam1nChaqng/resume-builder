import { z } from "zod";

export const JobEmailSchema = z.object({
  subject: z.string().min(1).describe("Concise, specific subject line."),
  body: z
    .string()
    .min(1)
    .describe("The full email body, greeting through sign-off, plain text."),
});

export type JobEmail = z.infer<typeof JobEmailSchema>;
