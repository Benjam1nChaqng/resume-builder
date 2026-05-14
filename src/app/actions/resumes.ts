"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createResumeForUser } from "@/lib/resumes/create";
import { requireResumeAccess } from "@/lib/resumes/access";
import {
  addBulletRow,
  addEducationRow,
  addExperienceRow,
  addProjectRow,
  addSkillRow,
  deleteBulletRow,
  deleteEducationRow,
  deleteExperienceRow,
  deleteProjectRow,
  deleteSkillRow,
  reorderBulletsRow,
  reorderEducationsRow,
  reorderExperiencesRow,
  reorderProjectsRow,
  reorderSkillsRow,
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

// ─────────────────────────────────────────────────────────────────────────────
// Add — appends a new row at the end of the list, returns its id
// ─────────────────────────────────────────────────────────────────────────────

export async function addBulletAction(
  resumeId: string,
  experienceId: string,
): Promise<string> {
  await requireResumeAccess(resumeId);
  return addBulletRow(resumeId, experienceId);
}

export async function addExperienceAction(resumeId: string): Promise<string> {
  await requireResumeAccess(resumeId);
  return addExperienceRow(resumeId);
}

export async function addEducationAction(resumeId: string): Promise<string> {
  await requireResumeAccess(resumeId);
  return addEducationRow(resumeId);
}

export async function addSkillAction(resumeId: string): Promise<string> {
  await requireResumeAccess(resumeId);
  return addSkillRow(resumeId);
}

export async function addProjectAction(resumeId: string): Promise<string> {
  await requireResumeAccess(resumeId);
  return addProjectRow(resumeId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete — FK cascade handles children
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteBulletAction(
  resumeId: string,
  bulletId: string,
): Promise<void> {
  await requireResumeAccess(resumeId);
  await deleteBulletRow(resumeId, bulletId);
}

export async function deleteExperienceAction(
  resumeId: string,
  experienceId: string,
): Promise<void> {
  await requireResumeAccess(resumeId);
  await deleteExperienceRow(resumeId, experienceId);
}

export async function deleteEducationAction(
  resumeId: string,
  educationId: string,
): Promise<void> {
  await requireResumeAccess(resumeId);
  await deleteEducationRow(resumeId, educationId);
}

export async function deleteSkillAction(
  resumeId: string,
  skillId: string,
): Promise<void> {
  await requireResumeAccess(resumeId);
  await deleteSkillRow(resumeId, skillId);
}

export async function deleteProjectAction(
  resumeId: string,
  projectId: string,
): Promise<void> {
  await requireResumeAccess(resumeId);
  await deleteProjectRow(resumeId, projectId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Reorder — orderedIds must be a permutation of existing children
// ─────────────────────────────────────────────────────────────────────────────

export async function reorderBulletsAction(
  resumeId: string,
  experienceId: string,
  orderedIds: string[],
): Promise<void> {
  await requireResumeAccess(resumeId);
  await reorderBulletsRow(resumeId, experienceId, orderedIds);
}

export async function reorderExperiencesAction(
  resumeId: string,
  orderedIds: string[],
): Promise<void> {
  await requireResumeAccess(resumeId);
  await reorderExperiencesRow(resumeId, orderedIds);
}

export async function reorderEducationsAction(
  resumeId: string,
  orderedIds: string[],
): Promise<void> {
  await requireResumeAccess(resumeId);
  await reorderEducationsRow(resumeId, orderedIds);
}

export async function reorderSkillsAction(
  resumeId: string,
  orderedIds: string[],
): Promise<void> {
  await requireResumeAccess(resumeId);
  await reorderSkillsRow(resumeId, orderedIds);
}

export async function reorderProjectsAction(
  resumeId: string,
  orderedIds: string[],
): Promise<void> {
  await requireResumeAccess(resumeId);
  await reorderProjectsRow(resumeId, orderedIds);
}
