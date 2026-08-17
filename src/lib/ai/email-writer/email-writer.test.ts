import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGenerateStructured = vi.fn();

vi.mock("@/lib/ai/openai", () => ({
  generateStructured: mockGenerateStructured,
}));

const input = {
  job: {
    title: "AV Technician",
    company: "Acme",
    description: "Install AV systems.",
    requirements: ["IP cameras", "Cabling"],
  },
  resumeText: "Benjamin Chang\nExperience\nTelecom Technician",
  candidateName: "Benjamin Chang",
};

beforeEach(() => mockGenerateStructured.mockReset());

describe("draftJobEmail", () => {
  it("returns a validated subject and body", async () => {
    mockGenerateStructured.mockResolvedValueOnce({
      subject: "Application: AV Technician - Acme",
      body: "Hi,\n\nI'd love to apply. Resume attached.\n\nThanks,\nBenjamin",
    });
    const { draftJobEmail } = await import("./index");
    const result = await draftJobEmail(input);
    expect(result.subject).toContain("AV Technician");
    expect(result.body).toContain("Resume attached.");
  });

  it("uses the GPT planner tier and email schema", async () => {
    mockGenerateStructured.mockResolvedValueOnce({ subject: "s", body: "b" });
    const { draftJobEmail } = await import("./index");
    await draftJobEmail(input);
    expect(mockGenerateStructured.mock.calls[0][0]).toMatchObject({
      model: "gpt-5.6-sol",
      schemaName: "compose_job_email",
      maxOutputTokens: 1024,
    });
  });

  it("propagates a missing structured output error", async () => {
    mockGenerateStructured.mockRejectedValueOnce(
      new Error("OpenAI did not return valid structured output."),
    );
    const { draftJobEmail } = await import("./index");
    await expect(draftJobEmail(input)).rejects.toThrow(/structured output/i);
  });

  it("throws when the structured output fails validation", async () => {
    mockGenerateStructured.mockRejectedValueOnce(new Error("Invalid email output"));
    const { draftJobEmail } = await import("./index");
    await expect(draftJobEmail(input)).rejects.toThrow();
  });
});
