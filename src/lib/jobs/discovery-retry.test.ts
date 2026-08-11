import { describe, expect, it, vi } from "vitest";
import {
  DiscoveryRetryError,
  isTransientDiscoveryError,
  retryDiscoveryOperation,
} from "./discovery-retry";

describe("isTransientDiscoveryError", () => {
  it.each([408, 425, 429, 500, 502, 503, 504])(
    "retries HTTP %i responses",
    (status) => {
      expect(isTransientDiscoveryError(new Error(`HTTP ${status}`))).toBe(true);
    },
  );

  it("follows nested fetch causes", () => {
    const error = new TypeError("fetch failed", {
      cause: new Error("ECONNRESET"),
    });

    expect(isTransientDiscoveryError(error)).toBe(true);
  });

  it.each([
    "HTTP 400",
    "HTTP 404",
    "Private URL blocked",
    "Greenhouse returned unexpected job data.",
  ])("does not retry permanent failure: %s", (message) => {
    expect(isTransientDiscoveryError(new Error(message))).toBe(false);
  });
});

describe("retryDiscoveryOperation", () => {
  it("uses exponential delays and returns the successful attempt count", async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("HTTP 503"))
      .mockRejectedValueOnce(new Error("Request timed out after 10000ms."))
      .mockResolvedValueOnce("jobs");
    const sleep = vi.fn<(delayMs: number) => Promise<void>>().mockResolvedValue();

    await expect(
      retryDiscoveryOperation(operation, { sleep }),
    ).resolves.toEqual({ value: "jobs", attempts: 3 });
    expect(sleep).toHaveBeenNthCalledWith(1, 250);
    expect(sleep).toHaveBeenNthCalledWith(2, 500);
  });

  it("fails immediately for permanent errors", async () => {
    const operation = vi.fn().mockRejectedValue(new Error("HTTP 404"));
    const sleep = vi.fn<(delayMs: number) => Promise<void>>().mockResolvedValue();

    const result = retryDiscoveryOperation(operation, { sleep });

    await expect(result).rejects.toMatchObject({
      name: "DiscoveryRetryError",
      message: "HTTP 404",
      attempts: 1,
    });
    expect(operation).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("reports the total attempts after exhausting a transient failure", async () => {
    const operation = vi.fn().mockRejectedValue(new Error("HTTP 503"));
    const sleep = vi.fn<(delayMs: number) => Promise<void>>().mockResolvedValue();

    try {
      await retryDiscoveryOperation(operation, { sleep, maxAttempts: 2 });
      expect.fail("Expected retry exhaustion");
    } catch (error) {
      expect(error).toBeInstanceOf(DiscoveryRetryError);
      expect(error).toMatchObject({ message: "HTTP 503", attempts: 2 });
      expect((error as Error).cause).toMatchObject({ message: "HTTP 503" });
    }
  });
});
