import { describe, expect, it } from "vitest";
import { normalizeRemotiveJobs } from "./job-feed";

const payload = {
  jobs: [
    {
      url: "https://remotive.com/remote-jobs/software-dev/senior-engineer-123",
      title: "Senior Software Engineer",
      company_name: "Acme",
      job_type: "full_time",
      candidate_required_location: "USA",
      salary: "$120,000 - $150,000",
      publication_date: "2026-08-20T14:30:00Z",
    },
    {
      url: "https://remotive.com/remote-jobs/support/part-time-rep-456",
      title: "Part-Time Support Rep",
      company_name: "Helply",
      job_type: "part_time",
      candidate_required_location: "Worldwide",
      salary: "",
    },
    {
      // Missing URL should be dropped.
      title: "Ghost Job",
      company_name: "Nowhere",
      job_type: "full_time",
    },
  ],
};

describe("normalizeRemotiveJobs", () => {
  it("maps valid jobs and drops ones without a url/title", () => {
    const listings = normalizeRemotiveJobs(payload, { employmentType: "any" });
    expect(listings).toHaveLength(2);
    expect(listings[0]).toMatchObject({
      title: "Senior Software Engineer",
      company: "Acme",
    });
  });

  it("keeps salary separate from location so compensation can be ranked", () => {
    const [first] = normalizeRemotiveJobs(payload, { employmentType: "any" });
    expect(first.location).toBe("USA | Full-time");
    expect(first.compensationText).toBe("$120,000 - $150,000");
    expect(first.postedAt).toEqual(new Date("2026-08-20T14:30:00Z"));
  });

  it("filters by employment type when not 'any'", () => {
    const fullTime = normalizeRemotiveJobs(payload, {
      employmentType: "full_time",
    });
    expect(fullTime).toHaveLength(1);
    expect(fullTime[0].title).toBe("Senior Software Engineer");
  });

  it("returns an empty array for a malformed payload", () => {
    expect(normalizeRemotiveJobs(null, { employmentType: "any" })).toEqual([]);
    expect(normalizeRemotiveJobs({}, { employmentType: "any" })).toEqual([]);
    expect(
      normalizeRemotiveJobs({ jobs: "nope" }, { employmentType: "any" }),
    ).toEqual([]);
  });
});
