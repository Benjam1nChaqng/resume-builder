import { describe, expect, it } from "vitest";
import { gmailComposeUrl, mailtoUrl } from "./links";

const draft = {
  to: "hiring@acme.com",
  subject: "Application: AV Technician — Acme",
  body: "Hi there,\n\nI'd love to apply. Resume attached.\n\nThanks,\nBen",
};

describe("gmailComposeUrl", () => {
  it("produces a Gmail compose deep link with encoded fields", () => {
    const url = new URL(gmailComposeUrl(draft));
    expect(url.origin + url.pathname).toBe("https://mail.google.com/mail/");
    expect(url.searchParams.get("view")).toBe("cm");
    expect(url.searchParams.get("to")).toBe("hiring@acme.com");
    expect(url.searchParams.get("su")).toBe("Application: AV Technician — Acme");
    expect(url.searchParams.get("body")).toContain("Resume attached.");
  });

  it("omits the recipient when none is given", () => {
    const url = new URL(gmailComposeUrl({ ...draft, to: null }));
    expect(url.searchParams.get("to")).toBeNull();
  });

  it("encodes spaces as %20, not +", () => {
    expect(gmailComposeUrl(draft)).toContain("%20");
    expect(gmailComposeUrl(draft)).not.toMatch(/su=[^&]*\+/);
  });
});

describe("mailtoUrl", () => {
  it("builds a mailto with subject and body", () => {
    const url = mailtoUrl(draft);
    expect(url.startsWith("mailto:hiring%40acme.com?")).toBe(true);
    expect(url).toContain("subject=Application");
    expect(url).toContain("body=Hi%20there");
  });

  it("works with an empty recipient", () => {
    const url = mailtoUrl({ ...draft, to: null });
    expect(url.startsWith("mailto:?")).toBe(true);
  });
});
