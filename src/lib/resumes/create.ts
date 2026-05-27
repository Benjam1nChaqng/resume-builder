import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { importResume, type ImportInput } from "@/lib/ai/resume-importer";
import { insertResumeWithRelations } from "./repo";

export type CreateResumeInput =
  | { kind: "text"; content: string }
  | { kind: "pdf"; file: File };

export async function createResumeForUser({
  userId,
  input,
}: {
  userId: string;
  input: CreateResumeInput;
}): Promise<string> {
  let sourcePdfUrl: string | null = null;
  let importerInput: ImportInput;

  if (input.kind === "pdf") {
    const dot = input.file.name.lastIndexOf(".");
    const ext =
      dot > 0 ? input.file.name.slice(dot + 1).toLowerCase() || "pdf" : "pdf";
    const key = `pdfs/${userId}/${randomUUID()}.${ext}`;
    const blob = await put(key, input.file, { access: "private" });
    sourcePdfUrl = blob.url;
    importerInput = { kind: "pdf", pdfUrl: blob.url };
  } else {
    importerInput = { kind: "text", content: input.content };
  }

  const parsed = await importResume(importerInput);

  return insertResumeWithRelations({ userId, parsed, sourcePdfUrl });
}
