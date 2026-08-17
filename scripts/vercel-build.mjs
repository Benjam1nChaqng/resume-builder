import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function vercelBuildScripts(vercelEnvironment) {
  return vercelEnvironment === "production"
    ? ["db:migrate", "build"]
    : ["build"];
}

function runPnpmScript(script) {
  console.log(`\n==> pnpm ${script}`);
  const packageManagerScript = process.env.npm_execpath;
  const result = packageManagerScript
    ? spawnSync(process.execPath, [packageManagerScript, "run", script], {
        cwd: repoRoot,
        env: process.env,
        stdio: "inherit",
      })
    : spawnSync(
        process.platform === "win32" ? "pnpm.cmd" : "pnpm",
        ["run", script],
        { cwd: repoRoot, env: process.env, stdio: "inherit" },
      );

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  for (const script of vercelBuildScripts(process.env.VERCEL_ENV)) {
    runPnpmScript(script);
  }
}
