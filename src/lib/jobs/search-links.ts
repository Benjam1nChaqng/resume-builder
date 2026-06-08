import type { SearchCriteria } from "./discovery";

/**
 * Builds ready-to-click search URLs for the major job sites from a user's
 * criteria. This is the "you find the URL, not me" piece: the user describes
 * what they want (role, location, full/part-time, pay) and we generate the
 * exact searches so they never have to hunt for a link.
 *
 * Pure string building — no network — so it always works and is easy to test.
 */
export type JobSite = "indeed" | "google" | "linkedin" | "ziprecruiter" | "snagajob";

export type SearchScope = "any" | "local" | "professional";

export type SearchLink = {
  id: JobSite;
  label: string;
  url: string;
  scope: SearchScope;
};

function rolesQuery(criteria: SearchCriteria): string {
  const roles = criteria.roles.filter(Boolean);
  const base = roles.length > 0 ? roles.join(" ") : "jobs";
  if (criteria.salaryMin && criteria.salaryMin > 0) {
    return `${base} $${criteria.salaryMin.toLocaleString("en-US")}`;
  }
  return base;
}

function indeedJobType(criteria: SearchCriteria): string | null {
  if (criteria.employmentType === "full_time") return "fulltime";
  if (criteria.employmentType === "part_time") return "parttime";
  return null;
}

function linkedinJobType(criteria: SearchCriteria): string | null {
  if (criteria.employmentType === "full_time") return "F";
  if (criteria.employmentType === "part_time") return "P";
  return null;
}

/** Returns every site link, tagged with the scope it's best suited for. */
export function buildAllSearchLinks(criteria: SearchCriteria): SearchLink[] {
  const q = rolesQuery(criteria);
  const location = criteria.location?.trim() ?? "";
  const links: SearchLink[] = [];

  // Indeed — broadest coverage (local + professional).
  {
    const params = new URLSearchParams({ q, fromage: "7" });
    if (location) params.set("l", location);
    const jt = indeedJobType(criteria);
    if (jt) params.set("sc", `0kf:jt(${jt});`);
    links.push({
      id: "indeed",
      label: "Indeed",
      url: `https://www.indeed.com/jobs?${params.toString()}`,
      scope: "any",
    });
  }

  // Google Jobs — opens the jobs widget.
  {
    const text = [q, location && `in ${location}`].filter(Boolean).join(" ");
    const params = new URLSearchParams({ q: `${text} jobs`, ibp: "htl;jobs" });
    links.push({
      id: "google",
      label: "Google Jobs",
      url: `https://www.google.com/search?${params.toString()}`,
      scope: "any",
    });
  }

  // LinkedIn — strong for professional roles.
  {
    const params = new URLSearchParams({ keywords: rolesQuery(criteria) });
    if (location) params.set("location", location);
    const jt = linkedinJobType(criteria);
    if (jt) params.set("f_JT", jt);
    links.push({
      id: "linkedin",
      label: "LinkedIn",
      url: `https://www.linkedin.com/jobs/search/?${params.toString()}`,
      scope: "professional",
    });
  }

  // ZipRecruiter — broad US coverage.
  {
    const params = new URLSearchParams({ search: q });
    if (location) params.set("location", location);
    links.push({
      id: "ziprecruiter",
      label: "ZipRecruiter",
      url: `https://www.ziprecruiter.com/jobs-search?${params.toString()}`,
      scope: "any",
    });
  }

  // Snagajob — local hourly / shift work (coffee shops, retail, etc.).
  {
    const params = new URLSearchParams({ q });
    if (location) params.set("w", location);
    links.push({
      id: "snagajob",
      label: "Snagajob (local/hourly)",
      url: `https://www.snagajob.com/search?${params.toString()}`,
      scope: "local",
    });
  }

  return links;
}

/** Filters the site links down to the ones that fit the user's job focus. */
export function buildSearchLinks(criteria: SearchCriteria): SearchLink[] {
  const all = buildAllSearchLinks(criteria);
  if (criteria.jobFocus === "local") {
    return all.filter((l) => l.scope === "local" || l.scope === "any");
  }
  if (criteria.jobFocus === "professional") {
    return all.filter((l) => l.scope === "professional" || l.scope === "any");
  }
  return all;
}
