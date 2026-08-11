const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 250;

const TRANSIENT_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const TRANSIENT_MESSAGE_PATTERNS = [
  /\brequest timed out\b/i,
  /\btimed out\b/i,
  /\btimeout\b/i,
  /\bfetch failed\b/i,
  /\bnetwork ?error\b/i,
  /\bsocket hang up\b/i,
  /\beconnreset\b/i,
  /\beconnrefused\b/i,
  /\betimedout\b/i,
  /\beai_again\b/i,
  /\bund_err_/i,
];

export type DiscoveryRetryOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  sleep?: (delayMs: number) => Promise<void>;
};

export class DiscoveryRetryError extends Error {
  readonly attempts: number;

  constructor(error: unknown, attempts: number) {
    super(error instanceof Error ? error.message : "Unknown discovery error", {
      cause: error,
    });
    this.name = "DiscoveryRetryError";
    this.attempts = attempts;
  }
}

function errorChain(error: unknown): Error[] {
  const errors: Error[] = [];
  const seen = new Set<Error>();
  let current = error;

  while (current instanceof Error && !seen.has(current)) {
    errors.push(current);
    seen.add(current);
    current = current.cause;
  }

  return errors;
}

export function isTransientDiscoveryError(error: unknown): boolean {
  return errorChain(error).some((candidate) => {
    if (candidate.name === "AbortError") return true;

    const httpMatch = candidate.message.match(/\bHTTP\s+(\d{3})\b/i);
    if (httpMatch && TRANSIENT_HTTP_STATUSES.has(Number(httpMatch[1]))) {
      return true;
    }

    return TRANSIENT_MESSAGE_PATTERNS.some((pattern) =>
      pattern.test(`${candidate.name}: ${candidate.message}`),
    );
  });
}

export async function retryDiscoveryOperation<T>(
  operation: () => Promise<T>,
  options: DiscoveryRetryOptions = {},
): Promise<{ value: T; attempts: number }> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const sleep =
    options.sleep ??
    ((delayMs: number) =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, delayMs);
      }));

  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error("Discovery retry attempts must be a positive integer.");
  }
  if (!Number.isFinite(baseDelayMs) || baseDelayMs < 0) {
    throw new Error("Discovery retry delay must be nonnegative.");
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return { value: await operation(), attempts: attempt };
    } catch (error) {
      if (attempt === maxAttempts || !isTransientDiscoveryError(error)) {
        throw new DiscoveryRetryError(error, attempt);
      }
      await sleep(baseDelayMs * 2 ** (attempt - 1));
    }
  }

  throw new Error("Discovery retry loop exited unexpectedly.");
}
