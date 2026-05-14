export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center dark:bg-neutral-950">
      <h1 className="text-5xl font-semibold tracking-tight text-neutral-900 sm:text-7xl dark:text-neutral-50">
        Resume Builder
      </h1>
      <p className="mt-4 text-lg text-neutral-600 sm:text-xl dark:text-neutral-400">
        Built with Claude Agent SDK + MCP
      </p>
      <p className="mt-10 text-xs uppercase tracking-[0.2em] text-neutral-400 dark:text-neutral-600">
        Day 1 — Scaffolded
      </p>
    </main>
  );
}
