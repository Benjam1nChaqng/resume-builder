import { describe, expect, it } from "vitest";
import { getJobNotice } from "./notices";

describe("getJobNotice", () => {
  it("formats bounded discovery counts", () => {
    expect(getJobNotice("discovery-complete", "1")?.message).toContain(
      "1 new listing.",
    );
    expect(getJobNotice("discovery-complete", "not-a-number")?.message).toContain(
      "0 new listings.",
    );
    expect(getJobNotice("discovery-complete", "999999")?.message).toContain(
      "10000 new listings.",
    );
  });

  it("classifies partial and failed work as warnings", () => {
    expect(getJobNotice("discovery-partial", "2")?.tone).toBe("warning");
    expect(getJobNotice("fit-failed")?.tone).toBe("warning");
  });

  it("never reflects unknown query text", () => {
    expect(getJobNotice("<script>alert(1)</script>")).toBeNull();
    expect(getJobNotice(undefined)).toBeNull();
  });
});
