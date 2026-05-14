"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createResumeForUser } from "@/lib/resumes/create";

export async function createResumeFromImportAction(formData: FormData): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }

  const mode = formData.get("mode");
  let id: string;

  if (mode === "pdf") {
    const file = formData.get("pdf");
    if (!(file instanceof File) || file.size === 0) {
      throw new Error("PDF file is required.");
    }
    id = await createResumeForUser({
      userId: session.user.id,
      input: { kind: "pdf", file },
    });
  } else if (mode === "text") {
    const content = formData.get("text");
    if (typeof content !== "string" || !content.trim()) {
      throw new Error("Resume text is required.");
    }
    id = await createResumeForUser({
      userId: session.user.id,
      input: { kind: "text", content },
    });
  } else {
    throw new Error(`Unknown import mode: ${String(mode)}`);
  }

  redirect(`/resume/${id}`);
}
