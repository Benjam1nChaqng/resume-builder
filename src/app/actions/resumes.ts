"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createResumeForUser } from "@/lib/resumes/create";
import { requireResumeAccess } from "@/lib/resumes/access";
import {
  updateBulletRow,
  updateContactInfoRow,
  updateEducationRow,
  updateExperienceRow,
  updateProjectRow,
  updateResumeRow,
  updateSkillRow,
} from "@/lib/resumes/repo";
import {
  BulletPatchSchema,
  ContactInfoPatchSchema,
  EducationPatchSchema,
  ExperiencePatchSchema,
  ProjectPatchSchema,
  ResumePatchSchema,
  SkillPatchSchema,
  type BulletPatch,
  type ContactInfoPatch,
  type EducationPatch,
  type ExperiencePatch,
  type ProjectPatch,
  type ResumePatch,
  type SkillPatch,
} from "@/lib/resumes/schemas";

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

export async function updateResumeAction(
  resumeId: string,
  patch: ResumePatch,
): Promise<void> {
  await requireResumeAccess(resumeId);
  const validated = ResumePatchSchema.parse(patch);
  await updateResumeRow(resumeId, validated);
}

export async function updateContactInfoAction(
  resumeId: string,
  patch: ContactInfoPatch,
): Promise<void> {
  await requireResumeAccess(resumeId);
  const validated = ContactInfoPatchSchema.parse(patch);
  await updateContactInfoRow(resumeId, validated);
}

export async function updateExperienceAction(
  resumeId: string,
  experienceId: string,
  patch: ExperiencePatch,
): Promise<void> {
  await requireResumeAccess(resumeId);
  const validated = ExperiencePatchSchema.parse(patch);
  await updateExperienceRow(resumeId, experienceId, validated);
}

export async function updateBulletAction(
  resumeId: string,
  bulletId: string,
  patch: BulletPatch,
): Promise<void> {
  await requireResumeAccess(resumeId);
  const validated = BulletPatchSchema.parse(patch);
  await updateBulletRow(resumeId, bulletId, validated);
}

export async function updateEducationAction(
  resumeId: string,
  educationId: string,
  patch: EducationPatch,
): Promise<void> {
  await requireResumeAccess(resumeId);
  const validated = EducationPatchSchema.parse(patch);
  await updateEducationRow(resumeId, educationId, validated);
}

export async function updateSkillAction(
  resumeId: string,
  skillId: string,
  patch: SkillPatch,
): Promise<void> {
  await requireResumeAccess(resumeId);
  const validated = SkillPatchSchema.parse(patch);
  await updateSkillRow(resumeId, skillId, validated);
}

export async function updateProjectAction(
  resumeId: string,
  projectId: string,
  patch: ProjectPatch,
): Promise<void> {
  await requireResumeAccess(resumeId);
  const validated = ProjectPatchSchema.parse(patch);
  await updateProjectRow(resumeId, projectId, validated);
}
