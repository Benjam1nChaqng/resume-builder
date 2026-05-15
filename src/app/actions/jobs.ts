"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createJobForUser } from "@/lib/jobs/create";
import {
  tailorResumeForJob,
  type TailorResumeResult,
} from "@/lib/jobs/tailor";

export async function createJobFromUrlAction(formData: FormData): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }

  const url = formData.get("url");
  if (typeof url !== "string" || !url.trim()) {
    throw new Error("Job URL is required.");
  }

  const id = await createJobForUser({
    userId: session.user.id,
    url: url.trim(),
  });

  redirect(`/job/${id}`);
}

export async function tailorResumeForJobAction(
  jobId: string,
  resumeId: string,
): Promise<TailorResumeResult> {
  return tailorResumeForJob({ jobId, resumeId });
}
