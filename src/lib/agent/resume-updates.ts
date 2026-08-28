import { z } from "zod";
import { ParsedEducationSchema } from "@/lib/ai/resume-importer/schema";
import { loadResumeOwner } from "@/lib/resumes/owner";
import {
  addEducationRow,
  reorderProjectsRow,
  updateEducationRow,
  updateProjectRow,
} from "@/lib/resumes/repo";
import {
  EducationPatchSchema,
  ProjectPatchSchema,
} from "@/lib/resumes/schemas";

const EducationUpdateSchema = z.object({
  educationId: z.string().min(1),
  patch: EducationPatchSchema,
});

const ProjectUpdateSchema = z.object({
  projectId: z.string().min(1),
  patch: ProjectPatchSchema,
});

export const AgentResumeContentUpdateSchema = z
  .object({
    educationUpdates: z.array(EducationUpdateSchema).default([]),
    educationAdds: z.array(ParsedEducationSchema).default([]),
    projectUpdates: z.array(ProjectUpdateSchema).default([]),
    projectOrder: z.array(z.string().min(1)).optional(),
  })
  .strict();

export type AgentResumeContentUpdate = z.infer<
  typeof AgentResumeContentUpdateSchema
>;

export async function updateResumeContentForUser({
  userId,
  resumeId,
  input,
}: {
  userId: string;
  resumeId: string;
  input: AgentResumeContentUpdate;
}): Promise<{ addedEducationIds: string[] }> {
  const ownerUserId = await loadResumeOwner(resumeId);
  if (!ownerUserId || ownerUserId !== userId) {
    throw new Error("Resume not found.");
  }

  for (const update of input.educationUpdates) {
    await updateEducationRow(resumeId, update.educationId, update.patch);
  }

  const addedEducationIds: string[] = [];
  for (const education of input.educationAdds) {
    const educationId = await addEducationRow(resumeId);
    addedEducationIds.push(educationId);
    await updateEducationRow(resumeId, educationId, education);
  }

  for (const update of input.projectUpdates) {
    await updateProjectRow(resumeId, update.projectId, update.patch);
  }

  if (input.projectOrder) {
    await reorderProjectsRow(resumeId, input.projectOrder);
  }

  return { addedEducationIds };
}
