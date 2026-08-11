import { describe, expect, it } from "vitest";
import {
  parseSelectedProfileCookie,
  selectActiveProfile,
  serializeSelectedProfileCookie,
} from "./profile-selection";

const profiles = [{ id: "maya" }, { id: "ben" }];

describe("selectActiveProfile", () => {
  it("selects an explicitly requested owned profile", () => {
    expect(selectActiveProfile(profiles, "ben")).toEqual({ id: "ben" });
  });

  it("falls back to the first profile for a missing or foreign id", () => {
    expect(selectActiveProfile(profiles, "foreign")).toEqual({ id: "maya" });
    expect(selectActiveProfile(profiles)).toEqual({ id: "maya" });
  });

  it("uses a saved owned profile when no valid explicit profile is requested", () => {
    expect(selectActiveProfile(profiles, undefined, "ben")).toEqual({ id: "ben" });
    expect(selectActiveProfile(profiles, "foreign", "ben")).toEqual({ id: "ben" });
    expect(selectActiveProfile(profiles, "maya", "ben")).toEqual({ id: "maya" });
  });

  it("returns null when the user has no profiles", () => {
    expect(selectActiveProfile([], "maya")).toBeNull();
  });
});

describe("selected profile cookie", () => {
  it("round-trips a selection only for the matching authenticated user", () => {
    const value = serializeSelectedProfileCookie("user:1", "profile/2");

    expect(parseSelectedProfileCookie(value, "user:1")).toBe("profile/2");
    expect(parseSelectedProfileCookie(value, "user:2")).toBeUndefined();
  });

  it("rejects malformed values", () => {
    expect(parseSelectedProfileCookie("missing-separator", "user-1")).toBeUndefined();
    expect(parseSelectedProfileCookie("%ZZ:profile-1", "user-1")).toBeUndefined();
    expect(parseSelectedProfileCookie("user-1:", "user-1")).toBeUndefined();
  });
});
