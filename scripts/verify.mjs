import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const full = process.argv.includes("--full");
const requireRuntime = process.argv.includes("--require-runtime");
const packageManagerScript = process.env.npm_execpath;

function runPnpmScript(script, env = process.env) {
  console.log(`\n==> pnpm ${script}`);
  const result = packageManagerScript
    ? spawnSync(process.execPath, [packageManagerScript, "run", script], {
        cwd: repoRoot,
        env,
        stdio: "inherit",
      })
    : spawnSync(
        process.platform === "win32" ? "pnpm.cmd" : "pnpm",
        ["run", script],
        { cwd: repoRoot, env, stdio: "inherit" },
      );

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (requireRuntime) {
  runPnpmScript("preflight:mvp");
}

for (const script of ["typecheck", "lint", "test:run"]) {
  runPnpmScript(script);
}

if (full) {
  const buildEnvironment = requireRuntime
    ? process.env
    : { ...process.env, SKIP_ENV_VALIDATION: "true" };
  runPnpmScript("build", buildEnvironment);
}

console.log(
  requireRuntime
    ? "\nRuntime-aware MVP verification passed."
    : "\nCode verification passed.",
);
