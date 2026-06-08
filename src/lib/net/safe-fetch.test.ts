import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SsrfError,
  fetchExternalHtml,
  isBlockedIp,
  parseAllowedUrl,
} from "./safe-fetch";

describe("isBlockedIp", () => {
  it("blocks loopback, private, link-local, and metadata addresses", () => {
    for (const ip of [
      "127.0.0.1",
      "127.1.2.3",
      "10.0.0.5",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254", // cloud metadata
      "100.64.0.1", // CGNAT
      "0.0.0.0",
      "::1",
      "::",
      "fc00::1",
      "fd12:3456::1",
      "fe80::1",
      "::ffff:127.0.0.1", // IPv4-mapped loopback
      "::ffff:169.254.169.254",
    ]) {
      expect(isBlockedIp(ip), `${ip} should be blocked`).toBe(true);
    }
  });

  it("allows public addresses", () => {
    for (const ip of [
      "8.8.8.8",
      "1.1.1.1",
      "93.184.216.34", // example.com
      "172.32.0.1", // just outside 172.16/12
      "2606:4700:4700::1111", // public IPv6 (Cloudflare)
    ]) {
      expect(isBlockedIp(ip), `${ip} should be allowed`).toBe(false);
    }
  });
});

describe("parseAllowedUrl", () => {
  it("rejects non-http(s) schemes", () => {
    expect(() => parseAllowedUrl("file:///etc/passwd")).toThrow(SsrfError);
    expect(() => parseAllowedUrl("ftp://example.com")).toThrow(SsrfError);
    expect(() => parseAllowedUrl("gopher://example.com")).toThrow(SsrfError);
  });

  it("rejects embedded credentials", () => {
    expect(() => parseAllowedUrl("https://user:pass@example.com")).toThrow(
      /credentials/,
    );
  });

  it("rejects localhost and internal suffixes", () => {
    expect(() => parseAllowedUrl("http://localhost/admin")).toThrow(SsrfError);
    expect(() => parseAllowedUrl("http://db.internal/")).toThrow(SsrfError);
    expect(() => parseAllowedUrl("http://printer.local/")).toThrow(SsrfError);
  });

  it("rejects literal private/metadata IPs", () => {
    expect(() => parseAllowedUrl("http://169.254.169.254/latest/meta-data")).toThrow(
      /private|reserved/i,
    );
    expect(() => parseAllowedUrl("http://127.0.0.1:6379/")).toThrow(SsrfError);
    expect(() => parseAllowedUrl("http://[::1]:8080/")).toThrow(SsrfError);
  });

  it("accepts public http(s) URLs", () => {
    expect(parseAllowedUrl("https://example.com/jobs/1").hostname).toBe(
      "example.com",
    );
  });
});

describe("fetchExternalHtml", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  it("never calls fetch for a blocked literal IP", async () => {
    await expect(
      fetchExternalHtml("http://169.254.169.254/latest/meta-data/"),
    ).rejects.toThrow(SsrfError);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("blocks a public hostname that resolves to a private IP (DNS rebinding)", async () => {
    await expect(
      fetchExternalHtml("https://evil.example/", {
        resolveHost: async () => ["169.254.169.254"],
      }),
    ).rejects.toThrow(/private IP/);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("fetches and returns html when the host resolves to a public IP", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response("<html>ok</html>", { status: 200 }),
    );
    const result = await fetchExternalHtml("https://example.com/jobs/1", {
      resolveHost: async () => ["93.184.216.34"],
    });
    expect(result).toEqual({ ok: true, status: 200, html: "<html>ok</html>" });
    expect(globalThis.fetch).toHaveBeenCalledOnce();
  });

  it("reports ok:false with the status on a non-200 response", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response("nope", { status: 404 }),
    );
    const result = await fetchExternalHtml("https://example.com/missing", {
      resolveHost: async () => ["93.184.216.34"],
    });
    expect(result).toEqual({ ok: false, status: 404, html: "" });
  });
});
