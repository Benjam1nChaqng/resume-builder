import { describe, expect, it } from "vitest";
import {
  AGENT_TOKEN_PREFIX,
  agentTokenDisplayPrefix,
  generateAgentToken,
  hashAgentToken,
  readBearerToken,
} from "./token";

describe("agent access tokens", () => {
  it("generates high-entropy prefixed tokens and stores only a stable hash", () => {
    const first = generateAgentToken();
    const second = generateAgentToken();

    expect(first).toMatch(/^rb_agent_[A-Za-z0-9_-]{43}$/);
    expect(second).not.toBe(first);
    expect(hashAgentToken(first)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashAgentToken(first)).toBe(hashAgentToken(first));
    expect(agentTokenDisplayPrefix(first)).toBe(
      `${first.slice(0, AGENT_TOKEN_PREFIX.length + 8)}...`,
    );
  });

  it("accepts one bearer token and rejects malformed authorization headers", () => {
    const token = `${AGENT_TOKEN_PREFIX}${"a".repeat(43)}`;
    expect(
      readBearerToken(
        new Request("https://app.test", {
          headers: { authorization: `Bearer ${token}` },
        }),
      ),
    ).toBe(token);
    expect(
      readBearerToken(
        new Request("https://app.test", {
          headers: { authorization: `Basic ${token}` },
        }),
      ),
    ).toBeNull();
    expect(
      readBearerToken(
        new Request("https://app.test", {
          headers: { authorization: "Bearer unrelated-token" },
        }),
      ),
    ).toBeNull();
  });
});
