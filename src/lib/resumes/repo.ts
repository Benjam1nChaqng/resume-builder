import { and, asc, count, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  bullet,
  contactInfo,
  education,
  experience,
  project,
  resume,
  skill,
} from "@/lib/db/resume-schema";
import type { ParsedResume } from "@/lib/ai/resume-importer/schema";
import type {
  BulletPatch,
  ContactInfoPatch,
  EducationPatch,
  ExperiencePatch,
  ProjectPatch,
  ResumePatch,
  SkillPatch,
} from "./schemas";
import { validateOrderedIds } from "./reorder";

async function touchResume(resumeId: string): Promise<void> {
  await db
    .update(resume)
    .set({ updatedAt: new Date() })
    .where(eq(resume.id, resumeId));
}

export async function updateResumeRow(
  resumeId: string,
  patch: ResumePatch,
): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  await db
    .update(resume)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(resume.id, resumeId));
}

export async function updateContactInfoRow(
  resumeId: string,
  patch: ContactInfoPatch,
): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  await db
    .update(contactInfo)
    .set(patch)
    .where(eq(contactInfo.resumeId, resumeId));
  await touchResume(resumeId);
}

export async function updateExperienceRow(
  resumeId: string,
  experienceId: string,
  patch: ExperiencePatch,
): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  await db
    .update(experience)
    .set(patch)
    .where(and(eq(experience.id, experienceId), eq(experience.resumeId, resumeId)));
  await touchResume(resumeId);
}

export async function updateBulletRow(
  resumeId: string,
  bulletId: string,
  patch: BulletPatch,
): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  await db
    .update(bullet)
    .set(patch)
    .where(
      and(
        eq(bullet.id, bulletId),
        inArray(
          bullet.experienceId,
          db
            .select({ id: experience.id })
            .from(experience)
            .where(eq(experience.resumeId, resumeId)),
        ),
      ),
    );
  await touchResume(resumeId);
}

export async function updateEducationRow(
  resumeId: string,
  educationId: string,
  patch: EducationPatch,
): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  const { gpa, ...rest } = patch;
  const dbPatch = {
    ...rest,
    ...(gpa !== undefined && { gpa: gpa === null ? null : String(gpa) }),
  };
  await db
    .update(education)
    .set(dbPatch)
    .where(and(eq(education.id, educationId), eq(education.resumeId, resumeId)));
  await touchResume(resumeId);
}

export async function updateSkillRow(
  resumeId: string,
  skillId: string,
  patch: SkillPatch,
): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  await db
    .update(skill)
    .set(patch)
    .where(and(eq(skill.id, skillId), eq(skill.resumeId, resumeId)));
  await touchResume(resumeId);
}

export async function updateProjectRow(
  resumeId: string,
  projectId: string,
  patch: ProjectPatch,
): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  await db
    .update(project)
    .set(patch)
    .where(and(eq(project.id, projectId), eq(project.resumeId, resumeId)));
  await touchResume(resumeId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Add operations — append at end of list
// ─────────────────────────────────────────────────────────────────────────────

async function assertExperienceInResume(
  resumeId: string,
  experienceId: string,
): Promise<void> {
  const rows = await db
    .select({ id: experience.id })
    .from(experience)
    .where(and(eq(experience.id, experienceId), eq(experience.resumeId, resumeId)))
    .limit(1);
  if (rows.length === 0) {
    throw new Error("Experience does not belong to this resume.");
  }
}

export async function addBulletRow(
  resumeId: string,
  experienceId: string,
): Promise<string> {
  await assertExperienceInResume(resumeId, experienceId);
  const [c] = await db
    .select({ c: count() })
    .from(bullet)
    .where(eq(bullet.experienceId, experienceId));
  const sortOrder = c?.c ?? 0;
  const [row] = await db
    .insert(bullet)
    .values({ experienceId, text: "New bullet", sortOrder })
    .returning({ id: bullet.id });
  if (!row) throw new Error("addBulletRow: insert returned no rows");
  await touchResume(resumeId);
  return row.id;
}

export async function addExperienceRow(resumeId: string): Promise<string> {
  const [c] = await db
    .select({ c: count() })
    .from(experience)
    .where(eq(experience.resumeId, resumeId));
  const sortOrder = c?.c ?? 0;
  const [row] = await db
    .insert(experience)
    .values({
      resumeId,
      company: "New company",
      role: "Role",
      current: false,
      sortOrder,
    })
    .returning({ id: experience.id });
  if (!row) throw new Error("addExperienceRow: insert returned no rows");
  await touchResume(resumeId);
  return row.id;
}

export async function addEducationRow(resumeId: string): Promise<string> {
  const [c] = await db
    .select({ c: count() })
    .from(education)
    .where(eq(education.resumeId, resumeId));
  const sortOrder = c?.c ?? 0;
  const [row] = await db
    .insert(education)
    .values({ resumeId, school: "New school", sortOrder })
    .returning({ id: education.id });
  if (!row) throw new Error("addEducationRow: insert returned no rows");
  await touchResume(resumeId);
  return row.id;
}

export async function addSkillRow(resumeId: string): Promise<string> {
  const [c] = await db
    .select({ c: count() })
    .from(skill)
    .where(eq(skill.resumeId, resumeId));
  const sortOrder = c?.c ?? 0;
  const [row] = await db
    .insert(skill)
    .values({ resumeId, name: "New skill", sortOrder })
    .returning({ id: skill.id });
  if (!row) throw new Error("addSkillRow: insert returned no rows");
  await touchResume(resumeId);
  return row.id;
}

export async function addProjectRow(resumeId: string): Promise<string> {
  const [c] = await db
    .select({ c: count() })
    .from(project)
    .where(eq(project.resumeId, resumeId));
  const sortOrder = c?.c ?? 0;
  const [row] = await db
    .insert(project)
    .values({ resumeId, name: "New project", sortOrder })
    .returning({ id: project.id });
  if (!row) throw new Error("addProjectRow: insert returned no rows");
  await touchResume(resumeId);
  return row.id;
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete operations — FK cascade handles children
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteBulletRow(
  resumeId: string,
  bulletId: string,
): Promise<void> {
  await db
    .delete(bullet)
    .where(
      and(
        eq(bullet.id, bulletId),
        inArray(
          bullet.experienceId,
          db
            .select({ id: experience.id })
            .from(experience)
            .where(eq(experience.resumeId, resumeId)),
        ),
      ),
    );
  await touchResume(resumeId);
}

export async function deleteExperienceRow(
  resumeId: string,
  experienceId: string,
): Promise<void> {
  await db
    .delete(experience)
    .where(and(eq(experience.id, experienceId), eq(experience.resumeId, resumeId)));
  await touchResume(resumeId);
}

export async function deleteEducationRow(
  resumeId: string,
  educationId: string,
): Promise<void> {
  await db
    .delete(education)
    .where(and(eq(education.id, educationId), eq(education.resumeId, resumeId)));
  await touchResume(resumeId);
}

export async function deleteSkillRow(
  resumeId: string,
  skillId: string,
): Promise<void> {
  await db
    .delete(skill)
    .where(and(eq(skill.id, skillId), eq(skill.resumeId, resumeId)));
  await touchResume(resumeId);
}

export async function deleteProjectRow(
  resumeId: string,
  projectId: string,
): Promise<void> {
  await db
    .delete(project)
    .where(and(eq(project.id, projectId), eq(project.resumeId, resumeId)));
  await touchResume(resumeId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Reorder operations — permutation check, then N sortOrder updates
// ─────────────────────────────────────────────────────────────────────────────

export async function reorderBulletsRow(
  resumeId: string,
  experienceId: string,
  orderedIds: string[],
): Promise<void> {
  await assertExperienceInResume(resumeId, experienceId);
  const existing = await db
    .select({ id: bullet.id })
    .from(bullet)
    .where(eq(bullet.experienceId, experienceId))
    .orderBy(asc(bullet.sortOrder));
  if (!validateOrderedIds(existing.map((r) => r.id), orderedIds)) {
    throw new Error("reorderBulletsRow: orderedIds is not a permutation of existing children.");
  }
  for (let i = 0; i < orderedIds.length; i++) {
    await db.update(bullet).set({ sortOrder: i }).where(eq(bullet.id, orderedIds[i]!));
  }
  await touchResume(resumeId);
}

async function reorderChildren(
  resumeId: string,
  table: typeof experience | typeof education | typeof skill | typeof project,
  orderedIds: string[],
): Promise<void> {
  const existing = await db
    .select({ id: table.id })
    .from(table)
    .where(eq(table.resumeId, resumeId))
    .orderBy(asc(table.sortOrder));
  if (!validateOrderedIds(existing.map((r) => r.id), orderedIds)) {
    throw new Error("reorderChildren: orderedIds is not a permutation of existing children.");
  }
  for (let i = 0; i < orderedIds.length; i++) {
    await db.update(table).set({ sortOrder: i }).where(eq(table.id, orderedIds[i]!));
  }
  await touchResume(resumeId);
}

export async function reorderExperiencesRow(
  resumeId: string,
  orderedIds: string[],
): Promise<void> {
  await reorderChildren(resumeId, experience, orderedIds);
}

export async function reorderEducationsRow(
  resumeId: string,
  orderedIds: string[],
): Promise<void> {
  await reorderChildren(resumeId, education, orderedIds);
}

export async function reorderSkillsRow(
  resumeId: string,
  orderedIds: string[],
): Promise<void> {
  await reorderChildren(resumeId, skill, orderedIds);
}

export async function reorderProjectsRow(
  resumeId: string,
  orderedIds: string[],
): Promise<void> {
  await reorderChildren(resumeId, project, orderedIds);
}

export async function insertResumeWithRelations({
  userId,
  parsed,
  sourcePdfUrl,
}: {
  userId: string;
  parsed: ParsedResume;
  sourcePdfUrl: string | null;
}): Promise<string> {
  const existing = await db
    .select({ id: resume.id })
    .from(resume)
    .where(eq(resume.userId, userId))
    .limit(1);
  const isDefault = existing.length === 0;

  const [newResume] = await db
    .insert(resume)
    .values({
      userId,
      title: parsed.title,
      isDefault,
      sourcePdfUrl,
    })
    .returning({ id: resume.id });

  if (!newResume) {
    throw new Error("insertResumeWithRelations: insert returned no rows");
  }

  try {
    await db.insert(contactInfo).values({
      resumeId: newResume.id,
      fullName: parsed.contactInfo.fullName,
      email: parsed.contactInfo.email,
      phone: parsed.contactInfo.phone,
      location: parsed.contactInfo.location,
      links: parsed.contactInfo.links,
    });

    for (const [i, exp] of parsed.experiences.entries()) {
      const [newExp] = await db
        .insert(experience)
        .values({
          resumeId: newResume.id,
          company: exp.company,
          role: exp.role,
          location: exp.location,
          startDate: exp.startDate,
          endDate: exp.endDate,
          current: exp.current,
          sortOrder: i,
        })
        .returning({ id: experience.id });

      if (newExp && exp.bullets.length > 0) {
        await db.insert(bullet).values(
          exp.bullets.map((b, j) => ({
            experienceId: newExp.id,
            text: b.text,
            sortOrder: j,
          })),
        );
      }
    }

    if (parsed.educations.length > 0) {
      await db.insert(education).values(
        parsed.educations.map((e, i) => ({
          resumeId: newResume.id,
          school: e.school,
          degree: e.degree,
          field: e.field,
          startDate: e.startDate,
          endDate: e.endDate,
          gpa: e.gpa !== null ? String(e.gpa) : null,
          sortOrder: i,
        })),
      );
    }

    if (parsed.skills.length > 0) {
      await db.insert(skill).values(
        parsed.skills.map((s, i) => ({
          resumeId: newResume.id,
          category: s.category,
          name: s.name,
          sortOrder: i,
        })),
      );
    }

    if (parsed.projects.length > 0) {
      await db.insert(project).values(
        parsed.projects.map((p, i) => ({
          resumeId: newResume.id,
          name: p.name,
          description: p.description,
          link: p.link,
          sortOrder: i,
        })),
      );
    }

    return newResume.id;
  } catch (err) {
    // neon-http doesn't support transactions; best-effort cleanup via FK cascade.
    await db.delete(resume).where(eq(resume.id, newResume.id)).catch(() => {});
    throw err;
  }
}
