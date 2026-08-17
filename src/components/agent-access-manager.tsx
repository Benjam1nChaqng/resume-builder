"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, Trash2 } from "lucide-react";
import {
  createAgentTokenAction,
  revokeAgentTokenAction,
} from "@/app/actions/agent-access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type TokenRow = {
  id: string;
  name: string;
  tokenPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

export function AgentAccessManager({ tokens }: { tokens: TokenRow[] }) {
  const router = useRouter();
  const [name, setName] = useState("Codex job agent");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function createToken(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createAgentTokenAction(name);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNewToken(result.token);
      setCopied(false);
      router.refresh();
    });
  }

  function revokeToken(tokenId: string) {
    setError(null);
    startTransition(async () => {
      await revokeAgentTokenAction(tokenId);
      router.refresh();
    });
  }

  async function copyToken() {
    if (!newToken) return;
    await navigator.clipboard.writeText(newToken);
    setCopied(true);
  }

  return (
    <div className="space-y-10">
      <section className="border-b border-neutral-200 pb-10 dark:border-neutral-800">
        <h2 className="text-base font-medium text-neutral-950 dark:text-neutral-50">
          Create access key
        </h2>
        <form onSubmit={createToken} className="mt-4 flex max-w-xl gap-2">
          <div className="min-w-0 flex-1">
            <Label htmlFor="agent-key-name" className="sr-only">
              Key name
            </Label>
            <Input
              id="agent-key-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              required
            />
          </div>
          <Button type="submit" disabled={pending}>
            <KeyRound data-icon="inline-start" />
            {pending ? "Creating" : "Create key"}
          </Button>
        </form>
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        {newToken && (
          <div className="mt-5 max-w-xl border-l-2 border-emerald-500 pl-4">
            <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
              New key
            </p>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              This value is shown once. Revoking it immediately stops agent access.
            </p>
            <div className="mt-3 flex gap-2">
              <Input
                readOnly
                value={newToken}
                aria-label="New agent access key"
                className="font-mono text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={copyToken}
                title="Copy key"
                aria-label="Copy key"
              >
                {copied ? <Check /> : <Copy />}
              </Button>
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-base font-medium text-neutral-950 dark:text-neutral-50">
          Access keys
        </h2>
        {tokens.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
            No agent access keys.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-neutral-200 border-y border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {tokens.map((token) => (
              <li
                key={token.id}
                className="flex min-h-16 items-center justify-between gap-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-neutral-950 dark:text-neutral-50">
                      {token.name}
                    </span>
                    <code className="text-xs text-neutral-500 dark:text-neutral-400">
                      {token.tokenPrefix}
                    </code>
                    {token.revokedAt && (
                      <span className="text-xs text-red-600 dark:text-red-400">
                        Revoked
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    Created {new Date(token.createdAt).toLocaleDateString()}
                    {token.lastUsedAt
                      ? ` | Last used ${new Date(token.lastUsedAt).toLocaleString()}`
                      : " | Never used"}
                  </p>
                </div>
                {!token.revokedAt && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    onClick={() => revokeToken(token.id)}
                    disabled={pending}
                    title="Revoke key"
                    aria-label={`Revoke ${token.name}`}
                  >
                    <Trash2 />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
