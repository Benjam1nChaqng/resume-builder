import { describe, expect, it, vi } from "vitest";
import {
  assertPublicHttpUrl,
  fetchPublicHtml,
  isBlockedIpAddress,
  normalizeHttpUrl,
  type HostResolver,
} from "./public-web";

const publicResolver: HostResolver = async () => ["93.184.216.34"];

describe("public web URL safety", () => {
  it("normalizes supported URLs and rejects unsafe URL forms", () => {
    expect(normalizeHttpUrl("HTTPS://Example.COM/jobs/#openings")).toBe(
      "https://example.com/jobs",
    );
    expect(() => normalizeHttpUrl("file:///etc/passwd")).toThrow(/HTTP/);
    expect(() => normalizeHttpUrl("https://user:pass@example.com/jobs")).toThrow(
      /credentials/,
    );
  });

  it.each([
    "127.0.0.1",
    "10.0.0.2",
    "169.254.169.254",
    "192.168.1.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
  ])("blocks private or local address %s", (address) => {
    expect(isBlockedIpAddress(address)).toBe(true);
  });

  it("allows public IPv4 and IPv6 addresses", () => {
    expect(isBlockedIpAddress("93.184.216.34")).toBe(false);
    expect(isBlockedIpAddress("2001:4860:4860::8888")).toBe(false);
  });

  it("blocks local hostnames and hostnames resolving to private addresses", async () => {
    await expect(assertPublicHttpUrl("http://localhost/jobs")).rejects.toThrow(
      /private|local/i,
    );
    await expect(
      assertPublicHttpUrl("https://jobs.example.com", async () => ["10.1.2.3"]),
    ).rejects.toThrow(/private|local/i);
  });

  it("revalidates redirect targets before following them", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: "http://169.254.169.254/latest/meta-data" },
      }),
    );

    await expect(
      fetchPublicHtml("https://example.com/jobs", {
        fetchImpl,
        resolver: publicResolver,
      }),
    ).rejects.toThrow(/private|local/i);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("rejects non-HTML and oversized responses", async () => {
    const jsonFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("{}", { headers: { "content-type": "application/json" } }),
      );
    await expect(
      fetchPublicHtml("https://example.com/jobs", {
        fetchImpl: jsonFetch,
        resolver: publicResolver,
      }),
    ).rejects.toThrow(/HTML/);

    const largeFetch = vi.fn().mockResolvedValueOnce(
      new Response("123456", {
        headers: { "content-type": "text/html", "content-length": "6" },
      }),
    );
    await expect(
      fetchPublicHtml("https://example.com/jobs", {
        fetchImpl: largeFetch,
        resolver: publicResolver,
        maxBytes: 5,
      }),
    ).rejects.toThrow(/limit/);
  });

  it("aborts requests that exceed the timeout", async () => {
    const fetchImpl = vi.fn(
      (_input: URL | RequestInfo, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );

    await expect(
      fetchPublicHtml("https://example.com/jobs", {
        fetchImpl,
        resolver: publicResolver,
        timeoutMs: 1,
      }),
    ).rejects.toThrow(/timed out/);
  });
});
