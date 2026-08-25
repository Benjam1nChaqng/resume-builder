import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireAgentRequest, mockRunJobDiscovery } = vi.hoisted(() => ({
  mockRequireAgentRequest: vi.fn(),
  mockRunJobDiscovery: vi.fn(),
}));

vi.mock("@/lib/agent/http", () => ({
  requireAgentRequest: mockRequireAgentRequest,
  isAgentErrorResponse: (value: unknown) => value instanceof Response,
  agentJson: (data: unknown, init?: ResponseInit) => Response.json(data, init),
}));

vi.mock("@/lib/jobs/run-discovery", () => ({
  runJobDiscovery: mockRunJobDiscovery,
}));

beforeEach(() => {
  mockRequireAgentRequest.mockReset();
  mockRunJobDiscovery.mockReset();
});

describe("POST /api/agent/v1/discovery-runs", () => {
  it("rejects an invalid compensation floor before running discovery", async () => {
    mockRequireAgentRequest.mockResolvedValueOnce({
      tokenId: "token-1",
      userId: "user-1",
    });
    mockRunJobDiscovery.mockResolvedValueOnce({ discovered: 0, errors: [] });
    const { POST } = await import("./route");
    const response = await POST(
      new Request("https://app.test/api/agent/v1/discovery-runs", {
        method: "POST",
        body: JSON.stringify({ profileId: "profile-1", minAnnualSalary: 0 }),
      }),
    );

    expect(response.status).toBe(400);
    expect(mockRunJobDiscovery).not.toHaveBeenCalled();
  });

  it.each([
    ["annual salary", { minAnnualSalary: 79_999 }],
    ["hourly salary", { minHourlySalary: 49.99 }],
    ["posted age", { maxPostedAgeDays: 91 }],
  ])("does not allow the caller to weaken the %s policy", async (_name, override) => {
    mockRequireAgentRequest.mockResolvedValueOnce({
      tokenId: "token-1",
      userId: "user-1",
    });
    mockRunJobDiscovery.mockResolvedValueOnce({ discovered: 0, errors: [] });
    const { POST } = await import("./route");
    const response = await POST(
      new Request("https://app.test/api/agent/v1/discovery-runs", {
        method: "POST",
        body: JSON.stringify({ profileId: "profile-1", ...override }),
      }),
    );

    expect(response.status).toBe(400);
    expect(mockRunJobDiscovery).not.toHaveBeenCalled();
  });

  it("runs the profile as the token owner with the private pipeline defaults", async () => {
    mockRequireAgentRequest.mockResolvedValueOnce({
      tokenId: "token-1",
      userId: "user-1",
    });
    mockRunJobDiscovery.mockResolvedValueOnce({ discovered: 12, errors: [] });
    const { POST } = await import("./route");
    const response = await POST(
      new Request("https://app.test/api/agent/v1/discovery-runs", {
        method: "POST",
        body: JSON.stringify({ profileId: "profile-1" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ discovered: 12, errors: [] });
    expect(mockRunJobDiscovery).toHaveBeenCalledWith(
      { profileId: "profile-1", userId: "user-1" },
      {},
      {
        minAnnualSalary: 80_000,
        minHourlySalary: 50,
        maxPostedAgeDays: 90,
        allowMissingCompensation: true,
      },
    );
  });
});
