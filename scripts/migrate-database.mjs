import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const migrationsFolder = resolve("src/lib/db/migrations");

export function redactDatabaseSecrets(value, databaseUrl = "") {
  let redacted = String(value);

  if (databaseUrl) {
    redacted = redacted.replaceAll(databaseUrl, "[REDACTED_DATABASE_URL]");
  }

  return redacted.replace(
    /postgres(?:ql)?:\/\/[^\s'"`]+/gi,
    "[REDACTED_DATABASE_URL]",
  );
}

export function validateDatabaseUrl(databaseUrl) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is missing.");
  }

  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL.");
  }

  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error("DATABASE_URL must use the postgres or postgresql protocol.");
  }
}

export async function runMigrations(databaseUrl = process.env.DATABASE_URL) {
  validateDatabaseUrl(databaseUrl);

  const sql = neon(databaseUrl);
  const db = drizzle(sql);
  await migrate(db, { migrationsFolder });
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL ?? "";

  try {
    await runMigrations(databaseUrl);
    console.log("Database migrations applied successfully.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(redactDatabaseSecrets(message, databaseUrl));

    if (error instanceof Error && error.cause) {
      console.error(redactDatabaseSecrets(error.cause, databaseUrl));
    }

    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await main();
}
