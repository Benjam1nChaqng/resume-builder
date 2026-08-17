import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AgentAccessManager } from "@/components/agent-access-manager";
import { buttonVariants } from "@/components/ui/button";
import { listAgentAccessTokens } from "@/lib/agent/access";
import { auth } from "@/lib/auth";

export const metadata = { title: "Agent access" };

export default async function AgentAccessPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const tokens = await listAgentAccessTokens(session.user.id);

  return (
    <main className="min-h-screen bg-white px-6 py-12 dark:bg-neutral-950">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/dashboard"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          <ArrowLeft data-icon="inline-start" />
          Dashboard
        </Link>
        <header className="mt-8 border-b border-neutral-200 pb-8 dark:border-neutral-800">
          <h1 className="text-3xl font-semibold text-neutral-950 dark:text-neutral-50">
            Agent access
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600 dark:text-neutral-400">
            Revocable keys connect private job research and resume automation to
            this account. Keys cannot send email or submit applications.
          </p>
        </header>
        <div className="mt-10">
          <AgentAccessManager
            tokens={tokens.map((token) => ({
              ...token,
              createdAt: token.createdAt.toISOString(),
              lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
              revokedAt: token.revokedAt?.toISOString() ?? null,
            }))}
          />
        </div>
      </div>
    </main>
  );
}
