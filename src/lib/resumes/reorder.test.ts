import { describe, expect, it } from "vitest";
import { validateOrderedIds } from "./reorder";

describe("validateOrderedIds", () => {
  it("returns true when proposed is the same set as existing", () => {
    expect(validateOrderedIds(["a", "b", "c"], ["c", "a", "b"])).toBe(true);
  });

  it("returns true when both are empty", () => {
    expect(validateOrderedIds([], [])).toBe(true);
  });

  it("returns false on length mismatch (missing id)", () => {
    expect(validateOrderedIds(["a", "b", "c"], ["a", "b"])).toBe(false);
  });

  it("returns false on length mismatch (extra id)", () => {
    expect(validateOrderedIds(["a", "b"], ["a", "b", "c"])).toBe(false);
  });

  it("returns false when proposed contains a foreign id (security)", () => {
    expect(validateOrderedIds(["a", "b", "c"], ["a", "b", "FOREIGN"])).toBe(false);
  });

  it("returns false when proposed has a duplicate (same length, but bad set)", () => {
    expect(validateOrderedIds(["a", "b", "c"], ["a", "a", "b"])).toBe(false);
  });
});
