"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createJobForUser } from "@/lib/jobs/create";
import {
  JobSearchProfileInputSchema,
  JobSourceInputSchema,
} from "@/lib/jobs/discovery";
import {
  createJobSearchProfile,
  createJobSourceForUser,
  updateListingStatusForUser,
} from "@/lib/jobs/discovery-repo";
import { runResumeJobFit } from "@/lib/jobs/fit";
import { runJobDiscovery } from "@/lib/jobs/run-discovery";
import { createTailoredResumeCopy } from "@/lib/jobs/tailored-resume";
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

async function requireSessionUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");
  return session.user.id;
}

function splitList(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function createJobSearchProfileAction(
  formData: FormData,
): Promise<void> {
  const userId = await requireSessionUserId();
  const input = JobSearchProfileInputSchema.parse({
    candidateName: formData.get("candidateName"),
    targetRoles: splitList(formData.get("targetRoles")),
    locationPreference:
      typeof formData.get("locationPreference") === "string"
        ? formData.get("locationPreference")
        : null,
    remotePreference: formData.get("remotePreference") || "any",
    experienceLevel:
      typeof formData.get("experienceLevel") === "string"
        ? formData.get("experienceLevel")
        : null,
    keywords: splitList(formData.get("keywords")),
    exclusions: splitList(formData.get("exclusions")),
    basicJobFilters: {
      partTime: formData.get("partTime") === "on",
      hourly: formData.get("hourly") === "on",
      entryLevel: formData.get("entryLevel") === "on",
      retail: formData.get("retail") === "on",
      admin: formData.get("admin") === "on",
      service: formData.get("service") === "on",
      warehouse: formData.get("warehouse") === "on",
      internship: formData.get("internship") === "on",
    },
  });
  await createJobSearchProfile(userId, input);
  redirect("/jobs/discover");
}

export async function createJobSourceAction(formData: FormData): Promise<void> {
  const userId = await requireSessionUserId();
  const input = JobSourceInputSchema.parse({
    profileId: formData.get("profileId"),
    label: formData.get("label"),
    url: formData.get("url"),
  });
  await createJobSourceForUser(userId, input);
  redirect("/jobs/discover");
}

export async function runJobDiscoveryAction(formData: FormData): Promise<void> {
  const userId = await requireSessionUserId();
  const profileId = formData.get("profileId");
  if (typeof profileId !== "string" || !profileId) {
    throw new Error("Profile is required.");
  }
  await runJobDiscovery({ profileId, userId });
  redirect("/jobs/discover");
}

export async function saveDiscoveredListingAction(
  listingId: string,
  url: string,
): Promise<void> {
  const userId = await requireSessionUserId();
  const jobId = await createJobForUser({ userId, url });
  await updateListingStatusForUser({ userId, listingId, status: "saved", jobId });
  redirect(`/job/${jobId}`);
}

export async function rejectDiscoveredListingAction(
  listingId: string,
): Promise<void> {
  const userId = await requireSessionUserId();
  await updateListingStatusForUser({ userId, listingId, status: "rejected" });
  redirect("/jobs/discover");
}

export async function runResumeJobFitAction(
  jobId: string,
  resumeId: string,
): Promise<void> {
  await runResumeJobFit({ jobId, resumeId });
  redirect(`/job/${jobId}`);
}

export async function createTailoredResumeCopyAction(
  jobId: string,
  resumeId: string,
): Promise<void> {
  const tailoredResumeId = await createTailoredResumeCopy({ jobId, resumeId });
  redirect(`/resume/${tailoredResumeId}`);
}
