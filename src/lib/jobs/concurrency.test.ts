import { describe, expect, it } from "vitest";
import { mapWithConcurrency } from "./concurrency";

describe("mapWithConcurrency", () => {
  it("preserves input order while enforcing the concurrency limit", async () => {
    let active = 0;
    let maxActive = 0;
    const result = await mapWithConcurrency([30, 5, 15, 1], 2, async (delay) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, delay));
      active -= 1;
      return delay * 2;
    });

    expect(result).toEqual([60, 10, 30, 2]);
    expect(maxActive).toBe(2);
  });

  it("rejects invalid concurrency limits", async () => {
    await expect(mapWithConcurrency([1], 0, async (value) => value)).rejects.toThrow(
      /positive integer/,
    );
  });
});
