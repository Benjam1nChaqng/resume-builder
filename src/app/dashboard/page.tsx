import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SignOutButton } from "@/components/sign-out-button";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/sign-in");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center dark:bg-neutral-950">
      <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl dark:text-neutral-50">
        Welcome, {session.user.name}
      </h1>
      <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
        {session.user.email}
      </p>
      <div className="mt-8">
        <SignOutButton />
      </div>
      <p className="mt-12 text-xs uppercase tracking-[0.2em] text-neutral-400 dark:text-neutral-600">
        Day 1 — Dashboard placeholder
      </p>
    </main>
  );
}
