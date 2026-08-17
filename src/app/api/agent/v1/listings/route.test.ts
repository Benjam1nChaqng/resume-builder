import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireAgentRequest, mockIngestAgentListings } = vi.hoisted(() => ({
  mockRequireAgentRequest: vi.fn(),
  mockIngestAgentListings: vi.fn(),
}));

vi.mock("@/lib/agent/http", () => ({
  requireAgentRequest: mockRequireAgentRequest,
  isAgentErrorResponse: (value: unknown) => value instanceof Response,
  agentJson: (data: unknown, init?: ResponseInit) => Response.json(data, init),
}));
vi.mock("@/lib/agent/listings", async () => {
  const { z } = await import("zod");
  return {
    AgentListingBatchSchema: z.object({
      profileId: z.string().min(1),
      listings: z
        .array(
          z.object({
            url: z.string().url(),
            title: z.string().min(1),
          }),
        )
        .min(1),
    }),
    ingestAgentListings: mockIngestAgentListings,
  };
});

beforeEach(() => {
  mockRequireAgentRequest.mockReset();
  mockIngestAgentListings.mockReset();
});

describe("POST /api/agent/v1/listings", () => {
  it("rejects invalid batches before writing listings", async () => {
    mockRequireAgentRequest.mockResolvedValueOnce({
      tokenId: "token-1",
      userId: "user-1",
    });
    const { POST } = await import("./route");
    const response = await POST(
      new Request("https://app.test/api/agent/v1/listings", {
        method: "POST",
        body: JSON.stringify({ profileId: "profile-1", listings: [] }),
      }),
    );

    expect(response.status).toBe(400);
    expect(mockIngestAgentListings).not.toHaveBeenCalled();
  });

  it("binds ingestion to the authenticated token owner", async () => {
    mockRequireAgentRequest.mockResolvedValueOnce({
      tokenId: "token-1",
      userId: "user-1",
    });
    mockIngestAgentListings.mockResolvedValueOnce({ inserted: 1 });
    const { POST } = await import("./route");
    const response = await POST(
      new Request("https://app.test/api/agent/v1/listings", {
        method: "POST",
        body: JSON.stringify({
          profileId: "profile-1",
          listings: [
            { url: "https://example.com/jobs/1", title: "Technician" },
          ],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mockIngestAgentListings).toHaveBeenCalledWith({
      userId: "user-1",
      input: expect.objectContaining({ profileId: "profile-1" }),
    });
  });
});
