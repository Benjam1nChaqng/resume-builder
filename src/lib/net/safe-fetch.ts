import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Guards outbound HTTP fetches against SSRF.
 *
 * Every external URL the server fetches (job-description scraping, discovery
 * source crawling) is attacker-controlled, so without these checks a user could
 * make our serverless function request internal services, cloud metadata
 * (169.254.169.254), or RFC1918 hosts and read the responses back.
 *
 * Defenses:
 *  - scheme allowlist (http/https only) + no embedded credentials
 *  - literal private/reserved IP block (IPv4 incl. alt forms, IPv6 incl. mapped)
 *  - DNS resolution check: every address a hostname resolves to must be public,
 *    which defeats "register evil.com -> A 169.254.169.254" rebinding
 *  - no auto-following redirects (a 30x can bounce to an internal host)
 *  - request timeout + response-size cap (prevents hangs / memory blowups)
 *
 * Known residual risk: a TOCTOU window exists between the DNS check and the
 * actual connection. Fully closing it needs connection-level IP pinning; that is
 * a deliberate future hardening, out of scope for this proportionate fix.
 */
export class SsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SsrfError";
  }
}

const BLOCKED_HOSTNAMES = new Set(["localhost"]);
const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal"];

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BYTES = 2_500_000; // 2.5 MB cap on scraped HTML

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    value = value * 256 + n;
  }
  return value >>> 0;
}

function inV4Range(ip: number, cidrBase: string, bits: number): boolean {
  const base = ipv4ToInt(cidrBase)!;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ip & mask) === (base & mask);
}

export function isBlockedIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return false;
  return (
    inV4Range(n, "0.0.0.0", 8) || // current network / unspecified
    inV4Range(n, "10.0.0.0", 8) || // private
    inV4Range(n, "100.64.0.0", 10) || // carrier-grade NAT
    inV4Range(n, "127.0.0.0", 8) || // loopback
    inV4Range(n, "169.254.0.0", 16) || // link-local incl. cloud metadata
    inV4Range(n, "172.16.0.0", 12) || // private
    inV4Range(n, "192.0.0.0", 24) || // IETF protocol assignments
    inV4Range(n, "192.0.2.0", 24) || // TEST-NET-1
    inV4Range(n, "192.168.0.0", 16) || // private
    inV4Range(n, "198.18.0.0", 15) || // benchmarking
    inV4Range(n, "198.51.100.0", 24) || // TEST-NET-2
    inV4Range(n, "203.0.113.0", 24) || // TEST-NET-3
    inV4Range(n, "224.0.0.0", 4) || // multicast
    inV4Range(n, "240.0.0.0", 4) // reserved + broadcast
  );
}

export function isBlockedIpv6(ip: string): boolean {
  const addr = ip.toLowerCase().split("%")[0].replace(/^\[|\]$/g, ""); // strip zone id + brackets
  if (addr === "::1" || addr === "::") return true;
  // IPv4-mapped (::ffff:a.b.c.d) or -compatible (::a.b.c.d)
  const mapped = addr.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped && addr.startsWith("::")) {
    return isBlockedIpv4(mapped[1]);
  }
  if (/^f[cd][0-9a-f]{0,2}:/.test(addr)) return true; // fc00::/7 unique-local
  if (/^fe[89ab][0-9a-f]?:/.test(addr)) return true; // fe80::/10 link-local
  return false;
}

export function isBlockedIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return isBlockedIpv4(ip);
  if (kind === 6) return isBlockedIpv6(ip);
  return false;
}

function isBlockedHostname(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTNAMES.has(h)) return true;
  return BLOCKED_HOST_SUFFIXES.some((suffix) => h.endsWith(suffix));
}

/** Validate scheme + host without touching the network. Throws SsrfError. */
export function parseAllowedUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SsrfError(`Invalid URL: ${raw}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SsrfError(
      `Blocked URL scheme "${url.protocol}" (only http/https allowed)`,
    );
  }
  if (url.username || url.password) {
    throw new SsrfError("Blocked URL: embedded credentials are not allowed");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isBlockedHostname(host)) {
    throw new SsrfError(`Blocked host: ${host}`);
  }
  if (isIP(host) && isBlockedIp(host)) {
    throw new SsrfError(`Blocked private/reserved IP: ${host}`);
  }
  return url;
}

export type ResolveHost = (hostname: string) => Promise<string[]>;

const defaultResolve: ResolveHost = async (hostname) => {
  const results = await lookup(hostname, { all: true });
  return results.map((r) => r.address);
};

export type FetchExternalHtmlResult = {
  ok: boolean;
  status: number;
  html: string;
};

export async function fetchExternalHtml(
  raw: string,
  opts: {
    headers?: Record<string, string>;
    timeoutMs?: number;
    maxBytes?: number;
    resolveHost?: ResolveHost;
  } = {},
): Promise<FetchExternalHtmlResult> {
  const url = parseAllowedUrl(raw);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const resolve = opts.resolveHost ?? defaultResolve;

  // Defeat DNS-based SSRF: every resolved address must be public.
  if (!isIP(host)) {
    const addresses = await resolve(host);
    if (addresses.length === 0) {
      throw new SsrfError(`Could not resolve host: ${host}`);
    }
    for (const address of addresses) {
      if (isBlockedIp(address)) {
        throw new SsrfError(
          `Blocked host ${host} resolves to private IP ${address}`,
        );
      }
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  try {
    const response = await fetch(url, {
      headers: opts.headers,
      redirect: "error", // never auto-follow: a redirect can bounce to an internal host
      signal: controller.signal,
    });

    if (!response.ok) {
      return { ok: false, status: response.status, html: "" };
    }

    const html = await readCapped(response, opts.maxBytes ?? DEFAULT_MAX_BYTES);
    return { ok: true, status: response.status, html };
  } finally {
    clearTimeout(timer);
  }
}

async function readCapped(response: Response, maxBytes: number): Promise<string> {
  const body = response.body;
  if (!body) return await response.text();

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let out = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      throw new SsrfError(`Response body exceeded ${maxBytes} byte cap`);
    }
    out += decoder.decode(value, { stream: true });
  }
  out += decoder.decode();
  return out;
}
