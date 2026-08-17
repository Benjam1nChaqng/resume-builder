import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { inspectMvpEnvironment } from "./runtime-config.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(repoRoot, ".env.local");
const fileValues = existsSync(envPath)
  ? dotenv.parse(readFileSync(envPath, "utf8"))
  : {};
const result = inspectMvpEnvironment({ ...fileValues, ...process.env });

if (!result.ready) {
  console.error("MVP runtime preflight failed.");
  if (result.missing.length > 0) {
    console.error(`Missing keys: ${result.missing.join(", ")}`);
  }
  if (result.invalid.length > 0) {
    console.error(`Invalid keys: ${result.invalid.join(", ")}`);
  }
  console.error(
    "Add valid values to .env.local or the process environment. No secret values were printed.",
  );
  process.exitCode = 1;
} else {
  console.log("MVP runtime preflight passed. Required values are present and valid.");
}
