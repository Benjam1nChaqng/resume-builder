import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  application,
  job,
  jobListing,
  jobSearchProfile,
} from "@/lib/db/jobs-schema";
import { resume } from "@/lib/db/resume-schema";

export async function loadAgentContext(userId: string) {
  const [resumes, profiles, jobs, listings] = await Promise.all([
    db.query.resume.findMany({
      where: eq(resume.userId, userId),
      orderBy: (cols, { desc }) => [desc(cols.updatedAt)],
      with: {
        contactInfo: true,
        experiences: {
          orderBy: (cols, { asc }) => [asc(cols.sortOrder)],
          with: {
            bullets: {
              orderBy: (cols, { asc }) => [asc(cols.sortOrder)],
            },
          },
        },
        educations: { orderBy: (cols, { asc }) => [asc(cols.sortOrder)] },
        skills: { orderBy: (cols, { asc }) => [asc(cols.sortOrder)] },
        projects: { orderBy: (cols, { asc }) => [asc(cols.sortOrder)] },
      },
    }),
    db.query.jobSearchProfile.findMany({
      where: eq(jobSearchProfile.userId, userId),
      orderBy: (cols, { desc }) => [desc(cols.updatedAt)],
      with: {
        sources: { orderBy: (cols, { asc }) => [asc(cols.createdAt)] },
      },
    }),
    db
      .select({
        id: job.id,
        sourceUrl: job.sourceUrl,
        title: job.title,
        company: job.company,
        location: job.location,
        description: job.description,
        requirements: job.requirements,
        niceToHaves: job.niceToHaves,
        seniority: job.seniority,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        scrapedAt: job.scrapedAt,
        applicationId: application.id,
        resumeId: application.resumeId,
        applicationStatus: application.status,
        applicationNotes: application.notes,
        appliedAt: application.appliedAt,
      })
      .from(job)
      .leftJoin(
        application,
        and(eq(application.jobId, job.id), eq(application.userId, userId)),
      )
      .where(eq(job.userId, userId))
      .orderBy(desc(job.scrapedAt))
      .limit(200),
    db
      .select({
        id: jobListing.id,
        profileId: jobListing.profileId,
        jobId: jobListing.jobId,
        canonicalUrl: jobListing.canonicalUrl,
        title: jobListing.title,
        company: jobListing.company,
        location: jobListing.location,
        employmentType: jobListing.employmentType,
        compensationText: jobListing.compensationText,
        postedAt: jobListing.postedAt,
        matchScore: jobListing.matchScore,
        status: jobListing.status,
        discoveredAt: jobListing.discoveredAt,
      })
      .from(jobListing)
      .innerJoin(
        jobSearchProfile,
        eq(jobListing.profileId, jobSearchProfile.id),
      )
      .where(eq(jobSearchProfile.userId, userId))
      .orderBy(desc(jobListing.discoveredAt))
      .limit(500),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    resumes: resumes.map((item) => ({
      id: item.id,
      title: item.title,
      isDefault: item.isDefault,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      contactInfo: item.contactInfo,
      experiences: item.experiences,
      educations: item.educations,
      skills: item.skills,
      projects: item.projects,
    })),
    searchProfiles: profiles.map((item) => ({
      id: item.id,
      candidateName: item.candidateName,
      targetRoles: item.targetRoles,
      locationPreference: item.locationPreference,
      remotePreference: item.remotePreference,
      experienceLevel: item.experienceLevel,
      employmentType: item.employmentType,
      salaryMin: item.salaryMin,
      jobFocus: item.jobFocus,
      keywords: item.keywords,
      exclusions: item.exclusions,
      basicJobFilters: item.basicJobFilters,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      sources: item.sources,
    })),
    jobs,
    listings,
  };
}
