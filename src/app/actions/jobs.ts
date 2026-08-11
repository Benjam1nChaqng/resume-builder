"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createJobForUser } from "@/lib/jobs/create";
import { markJobApplied } from "@/lib/jobs/application-state";
import {
  JobSearchProfileInputSchema,
  JobSourceInputSchema,
  JobSourceUpdateSchema,
} from "@/lib/jobs/discovery";
import {
  createJobSearchProfile,
  createJobSourceForUser,
  deleteJobSearchProfileForUser,
  deleteJobSourceForUser,
  setJobSourceEnabledForUser,
  updateJobSearchProfileForUser,
  updateJobSourceForUser,
  updateListingStatusForUser,
} from "@/lib/jobs/discovery-repo";
import {
  FIT_CHECK_FAILURE_MESSAGE,
  runResumeJobFit,
} from "@/lib/jobs/fit";
import { runJobDiscovery } from "@/lib/jobs/run-discovery";
import { saveDiscoveredListingForUser } from "@/lib/jobs/save-listing";
import {
  createTailoredResumeCopy,
  type TailoredBulletChange,
} from "@/lib/jobs/tailored-resume";
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

function parseSearchProfileForm(formData: FormData) {
  return JobSearchProfileInputSchema.parse({
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
    basicJobFilters: Object.fromEntries(
      [
        "partTime",
        "hourly",
        "entryLevel",
        "retail",
        "admin",
        "service",
        "warehouse",
        "internship",
      ].map((filter) => [filter, formData.get(filter) === "on"]),
    ),
  });
}

export async function createJobSearchProfileAction(
  formData: FormData,
): Promise<void> {
  const userId = await requireSessionUserId();
  const profileId = await createJobSearchProfile(
    userId,
    parseSearchProfileForm(formData),
  );
  redirect(`/jobs/discover?profile=${profileId}`);
}

export async function updateJobSearchProfileAction(
  formData: FormData,
): Promise<void> {
  const userId = await requireSessionUserId();
  const profileId = formData.get("profileId");
  if (typeof profileId !== "string" || !profileId) {
    throw new Error("Profile is required.");
  }
  await updateJobSearchProfileForUser(
    userId,
    profileId,
    parseSearchProfileForm(formData),
  );
  redirect(`/jobs/discover?profile=${profileId}`);
}

export async function deleteJobSearchProfileAction(
  profileId: string,
): Promise<void> {
  const userId = await requireSessionUserId();
  await deleteJobSearchProfileForUser(userId, profileId);
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
  redirect(`/jobs/discover?profile=${input.profileId}`);
}

export async function setJobSourceEnabledAction(
  sourceId: string,
  enabled: boolean,
): Promise<void> {
  const userId = await requireSessionUserId();
  const profileId = await setJobSourceEnabledForUser(userId, sourceId, enabled);
  redirect(`/jobs/discover?profile=${profileId}`);
}

export async function deleteJobSourceAction(sourceId: string): Promise<void> {
  const userId = await requireSessionUserId();
  const profileId = await deleteJobSourceForUser(userId, sourceId);
  redirect(`/jobs/discover?profile=${profileId}`);
}

export type UpdateJobSourceActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateJobSourceAction(
  sourceId: string,
  label: string,
  url: string,
): Promise<UpdateJobSourceActionResult> {
  const userId = await requireSessionUserId();
  const parsed = JobSourceUpdateSchema.safeParse({ label, url });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Enter a valid source.",
    };
  }
  try {
    await updateJobSourceForUser(userId, sourceId, parsed.data);
    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Error &&
      (error.message.includes("already added") ||
        error.message.includes("Private or local"))
        ? error.message
        : "Unable to update this source.";
    return { ok: false, error: message };
  }
}

export async function runJobDiscoveryAction(formData: FormData): Promise<void> {
  const userId = await requireSessionUserId();
  const profileId = formData.get("profileId");
  if (typeof profileId !== "string" || !profileId) {
    throw new Error("Profile is required.");
  }
  await runJobDiscovery({ profileId, userId });
  redirect(`/jobs/discover?profile=${profileId}`);
}

export async function saveDiscoveredListingAction(
  listingId: string,
): Promise<void> {
  const userId = await requireSessionUserId();
  const jobId = await saveDiscoveredListingForUser({ userId, listingId });
  redirect(`/job/${jobId}`);
}

export async function rejectDiscoveredListingAction(
  listingId: string,
): Promise<void> {
  const userId = await requireSessionUserId();
  const profileId = await updateListingStatusForUser({
    userId,
    listingId,
    status: "rejected",
  });
  redirect(`/jobs/discover?profile=${profileId}`);
}

export async function restoreDiscoveredListingAction(
  listingId: string,
): Promise<void> {
  const userId = await requireSessionUserId();
  const profileId = await updateListingStatusForUser({
    userId,
    listingId,
    status: "discovered",
  });
  redirect(`/jobs/discover?profile=${profileId}&status=rejected`);
}

export async function runResumeJobFitAction(
  jobId: string,
  resumeId: string,
): Promise<void> {
  try {
    await runResumeJobFit({ jobId, resumeId });
  } catch (error) {
    if (
      !(error instanceof Error) ||
      error.message !== FIT_CHECK_FAILURE_MESSAGE
    ) {
      throw error;
    }
    // The service persists a safe failed result for the selected resume.
  }
  redirect(`/job/${jobId}?resume=${resumeId}`);
}

export async function createTailoredResumeCopyAction(
  jobId: string,
  resumeId: string,
  acceptedChanges: TailoredBulletChange[],
): Promise<string> {
  return createTailoredResumeCopy({ jobId, resumeId, acceptedChanges });
}

export async function markJobAppliedAction(jobId: string): Promise<void> {
  await markJobApplied({ jobId });
  redirect(`/job/${jobId}`);
}
