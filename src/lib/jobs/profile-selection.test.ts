import { describe, expect, it } from "vitest";
import { selectActiveProfile } from "./profile-selection";

const profiles = [{ id: "maya" }, { id: "ben" }];

describe("selectActiveProfile", () => {
  it("selects an explicitly requested owned profile", () => {
    expect(selectActiveProfile(profiles, "ben")).toEqual({ id: "ben" });
  });

  it("falls back to the first profile for a missing or foreign id", () => {
    expect(selectActiveProfile(profiles, "foreign")).toEqual({ id: "maya" });
    expect(selectActiveProfile(profiles)).toEqual({ id: "maya" });
  });

  it("returns null when the user has no profiles", () => {
    expect(selectActiveProfile([], "maya")).toBeNull();
  });
});
