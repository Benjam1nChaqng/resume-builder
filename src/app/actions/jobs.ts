"use server";

import { cookies, headers } from "next/headers";
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
  requireProfileOwner,
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
  parseSelectedProfileCookie,
  SELECTED_JOB_PROFILE_COOKIE,
  serializeSelectedProfileCookie,
} from "@/lib/jobs/profile-selection";
import {
  createTailoredResumeCopy,
  type TailoredBulletChange,
} from "@/lib/jobs/tailored-resume";
import {
  tailorResumeForJob,
  type TailorResumeResult,
} from "@/lib/jobs/tailor";

export type JobDiscoveryFormState = {
  fieldErrors: Partial<Record<string, string[]>>;
  formError: string | null;
  values?: Record<string, string>;
};

const EMPTY_DISCOVERY_FORM_STATE: JobDiscoveryFormState = {
  fieldErrors: {},
  formError: null,
};

async function persistSelectedProfile(
  userId: string,
  profileId: string,
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(
    SELECTED_JOB_PROFILE_COOKIE,
    serializeSelectedProfileCookie(userId, profileId),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    },
  );
}

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

function formStringValues(formData: FormData, names: string[]) {
  return Object.fromEntries(
    names.flatMap((name) => {
      const value = formData.get(name);
      return typeof value === "string" ? [[name, value] as const] : [];
    }),
  );
}

const PROFILE_FORM_FIELDS = [
  "candidateName",
  "targetRoles",
  "locationPreference",
  "remotePreference",
  "experienceLevel",
  "keywords",
  "exclusions",
  "partTime",
  "hourly",
  "entryLevel",
  "retail",
  "admin",
  "service",
  "warehouse",
  "internship",
];

function searchProfileFormValue(formData: FormData) {
  return {
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
  };
}

function parseSearchProfileForm(formData: FormData) {
  return JobSearchProfileInputSchema.parse(searchProfileFormValue(formData));
}

function discoveryPath(
  profileId: string,
  values: Record<string, string> = {},
): string {
  const params = new URLSearchParams({ profile: profileId, ...values });
  return `/jobs/discover?${params.toString()}`;
}

export async function createJobSearchProfileAction(
  _previousState: JobDiscoveryFormState,
  formData: FormData,
): Promise<JobDiscoveryFormState> {
  const userId = await requireSessionUserId();
  const values = formStringValues(formData, PROFILE_FORM_FIELDS);
  const parsed = JobSearchProfileInputSchema.safeParse(
    searchProfileFormValue(formData),
  );
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
      formError: null,
      values,
    };
  }

  let profileId: string;
  try {
    profileId = await createJobSearchProfile(userId, parsed.data);
  } catch {
    return {
      ...EMPTY_DISCOVERY_FORM_STATE,
      formError: "Unable to create this search profile right now.",
      values,
    };
  }
  await persistSelectedProfile(userId, profileId);
  redirect(discoveryPath(profileId, { notice: "profile-created" }));
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
  redirect(discoveryPath(profileId, { notice: "profile-updated" }));
}

export async function deleteJobSearchProfileAction(
  profileId: string,
): Promise<void> {
  const userId = await requireSessionUserId();
  await deleteJobSearchProfileForUser(userId, profileId);
  const cookieStore = await cookies();
  if (
    parseSelectedProfileCookie(
      cookieStore.get(SELECTED_JOB_PROFILE_COOKIE)?.value,
      userId,
    ) === profileId
  ) {
    cookieStore.delete(SELECTED_JOB_PROFILE_COOKIE);
  }
  redirect("/jobs/discover?notice=profile-deleted");
}

export async function selectJobSearchProfileAction(
  profileId: string,
): Promise<void> {
  const userId = await requireSessionUserId();
  await requireProfileOwner(profileId, userId);
  await persistSelectedProfile(userId, profileId);
  redirect(`/jobs/discover?profile=${encodeURIComponent(profileId)}`);
}

export async function createJobSourceAction(
  _previousState: JobDiscoveryFormState,
  formData: FormData,
): Promise<JobDiscoveryFormState> {
  const userId = await requireSessionUserId();
  const values = formStringValues(formData, ["label", "url"]);
  const parsed = JobSourceInputSchema.safeParse({
    profileId: formData.get("profileId"),
    label: formData.get("label"),
    url: formData.get("url"),
  });
  if (!parsed.success) {
    return {
      fieldErrors: parsed.error.flatten().fieldErrors,
      formError: null,
      values,
    };
  }

  try {
    await createJobSourceForUser(userId, parsed.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("already added")) {
      return {
        ...EMPTY_DISCOVERY_FORM_STATE,
        formError: "This source is already added to the profile.",
        values,
      };
    }
    if (message.includes("Private or local")) {
      return {
        fieldErrors: { url: [message] },
        formError: null,
        values,
      };
    }
    if (message.includes("profile not found")) {
      return {
        ...EMPTY_DISCOVERY_FORM_STATE,
        formError: "The selected search profile is no longer available.",
        values,
      };
    }
    return {
      ...EMPTY_DISCOVERY_FORM_STATE,
      formError: "Unable to verify and add this source right now.",
      values,
    };
  }
  redirect(discoveryPath(parsed.data.profileId, { notice: "source-added" }));
}

export async function setJobSourceEnabledAction(
  sourceId: string,
  enabled: boolean,
): Promise<void> {
  const userId = await requireSessionUserId();
  const profileId = await setJobSourceEnabledForUser(userId, sourceId, enabled);
  redirect(
    discoveryPath(profileId, {
      notice: enabled ? "source-enabled" : "source-paused",
    }),
  );
}

export async function deleteJobSourceAction(sourceId: string): Promise<void> {
  const userId = await requireSessionUserId();
  const profileId = await deleteJobSourceForUser(userId, sourceId);
  redirect(discoveryPath(profileId, { notice: "source-deleted" }));
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
  const result = await runJobDiscovery({ profileId, userId });
  redirect(
    discoveryPath(profileId, {
      notice:
        result.errors.length > 0 ? "discovery-partial" : "discovery-complete",
      count: String(result.discovered),
    }),
  );
}

export async function saveDiscoveredListingAction(
  listingId: string,
): Promise<void> {
  const userId = await requireSessionUserId();
  const jobId = await saveDiscoveredListingForUser({ userId, listingId });
  redirect(`/job/${jobId}?notice=listing-saved`);
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
  redirect(discoveryPath(profileId, { notice: "listing-rejected" }));
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
  redirect(
    discoveryPath(profileId, {
      status: "rejected",
      notice: "listing-restored",
    }),
  );
}

export async function runResumeJobFitAction(
  jobId: string,
  resumeId: string,
): Promise<void> {
  let failed = false;
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
    failed = true;
  }
  const params = new URLSearchParams({
    resume: resumeId,
    notice: failed ? "fit-failed" : "fit-complete",
  });
  redirect(`/job/${jobId}?${params.toString()}`);
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
  redirect(`/job/${jobId}?notice=applied`);
}
