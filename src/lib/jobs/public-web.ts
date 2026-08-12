import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BYTES = 2_000_000;
const MAX_REDIRECTS = 5;

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.internal",
]);

export type HostResolver = (hostname: string) => Promise<string[]>;

export type FetchPublicResourceOptions = {
  fetchImpl?: typeof fetch;
  resolver?: HostResolver;
  timeoutMs?: number;
  maxBytes?: number;
};

export type FetchPublicHtmlOptions = FetchPublicResourceOptions;

export type PublicHtmlResult = {
  html: string;
  finalUrl: string;
};

export type PublicJsonResult = {
  data: unknown;
  finalUrl: string;
};

export function normalizeHttpUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS URLs are supported.");
  }
  if (url.username || url.password) {
    throw new Error("URLs with embedded credentials are not supported.");
  }

  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  if (url.pathname !== "/" && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }
  return url.toString();
}

function isBlockedIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return true;
  }

  const [a, b, c] = parts as [number, number, number, number];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

function expandIpv6(address: string): number[] | null {
  let normalized = address.toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];
  const ipv4Match = normalized.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (ipv4Match) {
    if (isIP(ipv4Match[1]) !== 4) return null;
    const octets = ipv4Match[1].split(".").map(Number);
    normalized = normalized.replace(
      ipv4Match[1],
      `${((octets[0] << 8) | octets[1]).toString(16)}:${(
        (octets[2] << 8) |
        octets[3]
      ).toString(16)}`,
    );
  }

  const halves = normalized.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || missing < 0) return null;

  const groups = [
    ...left,
    ...Array.from({ length: missing }, () => "0"),
    ...right,
  ].map((group) => Number.parseInt(group || "0", 16));
  if (
    groups.length !== 8 ||
    groups.some((group) => !Number.isInteger(group) || group < 0 || group > 0xffff)
  ) {
    return null;
  }
  return groups;
}

function isBlockedIpv6(address: string): boolean {
  const groups = expandIpv6(address);
  if (!groups) return true;

  const first = groups[0];
  const allZeroBeforeTail = groups.slice(0, 6).every((group) => group === 0);
  if (allZeroBeforeTail) {
    const ipv4 = `${groups[6] >> 8}.${groups[6] & 255}.${groups[7] >> 8}.${groups[7] & 255}`;
    return isBlockedIpv4(ipv4);
  }

  const ipv4Mapped =
    groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff;
  if (ipv4Mapped) {
    const ipv4 = `${groups[6] >> 8}.${groups[6] & 255}.${groups[7] >> 8}.${groups[7] & 255}`;
    return isBlockedIpv4(ipv4);
  }

  return (
    (first & 0xfe00) === 0xfc00 ||
    (first & 0xffc0) === 0xfe80 ||
    (first & 0xff00) === 0xff00 ||
    (first === 0x2001 && groups[1] === 0x0db8)
  );
}

export function isBlockedIpAddress(address: string): boolean {
  const normalized = address.replace(/^\[|\]$/g, "");
  const version = isIP(normalized);
  if (version === 4) return isBlockedIpv4(normalized);
  if (version === 6) return isBlockedIpv6(normalized);
  return true;
}

async function defaultResolver(hostname: string): Promise<string[]> {
  const rows = await lookup(hostname, { all: true, verbatim: true });
  return rows.map((row) => row.address);
}

export async function assertPublicHttpUrl(
  rawUrl: string,
  resolver: HostResolver = defaultResolver,
): Promise<URL> {
  const url = new URL(normalizeHttpUrl(rawUrl));
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new Error("Private or local network URLs are not allowed.");
  }

  const addresses = isIP(hostname) ? [hostname] : await resolver(hostname);
  if (addresses.length === 0 || addresses.some(isBlockedIpAddress)) {
    throw new Error("Private or local network URLs are not allowed.");
  }
  return url;
}

async function readLimitedText(response: Response, maxBytes: number): Promise<string> {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error(`Response exceeds the ${maxBytes}-byte limit.`);
  }
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(`Response exceeds the ${maxBytes}-byte limit.`);
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

type PublicTextResult = {
  text: string;
  finalUrl: string;
};

type PublicTextRequest = {
  method: "GET" | "POST";
  body?: string;
};

async function fetchPublicText(
  rawUrl: string,
  options: FetchPublicResourceOptions,
  responseType: {
    accept: string;
    acceptsContentType: (contentType: string) => boolean;
    invalidContentMessage: string;
  },
  request: PublicTextRequest = { method: "GET" },
): Promise<PublicTextResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const resolver = options.resolver ?? defaultResolver;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  let currentUrl = rawUrl;
  let method = request.method;
  let body = request.body;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const safeUrl = await assertPublicHttpUrl(currentUrl, resolver);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetchImpl(safeUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; ResumeBuilderBot/0.1; +https://github.com/Benjam1nChaqng/resume-builder)",
          Accept: responseType.accept,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        method,
        body,
        redirect: "manual",
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error(`Request timed out after ${timeoutMs}ms.`);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Redirect response did not include a location.");
      currentUrl = new URL(location, safeUrl).toString();
      if (response.status === 303 || ([301, 302].includes(response.status) && method === "POST")) {
        method = "GET";
        body = undefined;
      }
      await response.body?.cancel();
      continue;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!responseType.acceptsContentType(contentType)) {
      throw new Error(responseType.invalidContentMessage);
    }

    return {
      text: await readLimitedText(response, maxBytes),
      finalUrl: safeUrl.toString(),
    };
  }

  throw new Error(`Source exceeded ${MAX_REDIRECTS} redirects.`);
}

export async function fetchPublicHtml(
  rawUrl: string,
  options: FetchPublicHtmlOptions = {},
): Promise<PublicHtmlResult> {
  const result = await fetchPublicText(rawUrl, options, {
    accept: "text/html,application/xhtml+xml",
    acceptsContentType: (contentType) =>
      contentType.includes("text/html") ||
      contentType.includes("application/xhtml+xml"),
    invalidContentMessage: "Source did not return HTML content.",
  });
  return { html: result.text, finalUrl: result.finalUrl };
}

export async function fetchPublicJson(
  rawUrl: string,
  options: FetchPublicResourceOptions = {},
): Promise<PublicJsonResult> {
  const result = await fetchPublicText(rawUrl, options, {
    accept: "application/json",
    acceptsContentType: (contentType) =>
      contentType.includes("application/json") ||
      /application\/[^;]+\+json/.test(contentType),
    invalidContentMessage: "Source did not return JSON content.",
  });

  try {
    return { data: JSON.parse(result.text), finalUrl: result.finalUrl };
  } catch {
    throw new Error("Source returned invalid JSON content.");
  }
}

export async function postPublicJson(
  rawUrl: string,
  body: unknown,
  options: FetchPublicResourceOptions = {},
): Promise<PublicJsonResult> {
  const result = await fetchPublicText(
    rawUrl,
    options,
    {
      accept: "application/json",
      acceptsContentType: (contentType) =>
        contentType.includes("application/json") ||
        /application\/[^;]+\+json/.test(contentType),
      invalidContentMessage: "Source did not return JSON content.",
    },
    { method: "POST", body: JSON.stringify(body) },
  );

  try {
    return { data: JSON.parse(result.text), finalUrl: result.finalUrl };
  } catch {
    throw new Error("Source returned invalid JSON content.");
  }
}
