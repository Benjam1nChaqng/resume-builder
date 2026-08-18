import { beforeEach, describe, expect, it, vi } from "vitest";
import { AgentResumeJobFitSchema, saveAgentResumeJobFit } from "./fits";

const { mockLimit, mockWhere, mockFrom, mockSelect, mockValues, mockInsert } =
  vi.hoisted(() => {
    const mockLimit = vi.fn();
    const mockWhere = vi.fn(() => ({ limit: mockLimit }));
    const mockFrom = vi.fn(() => ({ where: mockWhere }));
    const mockSelect = vi.fn(() => ({ from: mockFrom }));
    const mockValues = vi.fn();
    return {
      mockLimit,
      mockWhere,
      mockFrom,
      mockSelect,
      mockValues,
      mockInsert: vi.fn(() => ({ values: mockValues })),
    };
  });

vi.mock("@/lib/db", () => ({
  db: { select: mockSelect, insert: mockInsert },
}));

const input = AgentResumeJobFitSchema.parse({
  jobId: "job-1",
  resumeId: "resume-1",
  score: 82,
  matchingEvidence: [
    {
      label: "Endpoint management",
      evidence: "The resume lists Intune and Autopilot endpoint support.",
      sourceSection: "experience",
      confidence: "high",
    },
  ],
  missingRequirements: ["Jamf administration"],
  missingPreferredRequirements: [],
  concerns: [],
  unsupportedClaims: ["Do not claim Jamf."],
  recommendations: ["Lead with Intune and macOS support."],
});

beforeEach(() => {
  mockLimit.mockReset();
  mockWhere.mockClear();
  mockFrom.mockClear();
  mockSelect.mockClear();
  mockValues.mockReset();
  mockInsert.mockClear();
});

describe("AgentResumeJobFitSchema", () => {
  it("rejects scores outside the fit rubric", () => {
    expect(() => AgentResumeJobFitSchema.parse({ ...input, score: 101 })).toThrow();
  });
});

describe("saveAgentResumeJobFit", () => {
  it("rejects an unowned job or resume before inserting", async () => {
    mockLimit.mockResolvedValueOnce([{ id: "job-1" }]);
    mockLimit.mockResolvedValueOnce([]);

    await expect(
      saveAgentResumeJobFit({ userId: "user-1", input }),
    ).rejects.toThrow(/not found/i);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("stores a completed fit for the authenticated owner", async () => {
    mockLimit.mockResolvedValueOnce([{ id: "job-1" }]);
    mockLimit.mockResolvedValueOnce([{ id: "resume-1" }]);
    mockValues.mockResolvedValueOnce(undefined);

    const result = await saveAgentResumeJobFit({ userId: "user-1", input });

    expect(result.fitId).toMatch(/^[0-9a-f-]{36}$/);
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        jobId: "job-1",
        resumeId: "resume-1",
        status: "completed",
        score: 82,
        modelMetadata: expect.objectContaining({
          model: "codex-agent",
          rubricVersion: "resume-fit-v2",
        }),
      }),
    );
  });
});
