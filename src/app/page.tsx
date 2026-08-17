import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { buttonVariants } from "@/components/ui/button";

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center dark:bg-neutral-950">
      <h1 className="text-5xl font-semibold tracking-tight text-neutral-900 sm:text-7xl dark:text-neutral-50">
        Resume Builder
      </h1>
      <p className="mt-4 text-lg text-neutral-600 sm:text-xl dark:text-neutral-400">
        Find jobs, tailor your resume, and track every application.
      </p>
      <div className="mt-10 flex gap-3">
        {session ? (
          <Link href="/dashboard" className={buttonVariants()}>
            Go to dashboard
          </Link>
        ) : (
          <>
            <Link href="/sign-up" className={buttonVariants()}>
              Get started
            </Link>
            <Link href="/sign-in" className={buttonVariants({ variant: "outline" })}>
              Sign in
            </Link>
          </>
        )}
      </div>
      <p className="mt-16 text-xs uppercase tracking-[0.2em] text-neutral-400 dark:text-neutral-600">
        Your private job search workspace
      </p>
    </main>
  );
}
