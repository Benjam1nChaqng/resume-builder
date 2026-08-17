export const REQUIRED_MVP_ENV_KEYS = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "ANTHROPIC_API_KEY",
  "HELICONE_API_KEY",
  "BLOB_READ_WRITE_TOKEN",
];

function isUrl(value, allowedProtocols) {
  try {
    const url = new URL(value);
    return allowedProtocols.includes(url.protocol);
  } catch {
    return false;
  }
}

export function inspectMvpEnvironment(values) {
  const missing = REQUIRED_MVP_ENV_KEYS.filter(
    (key) => typeof values[key] !== "string" || values[key].trim() === "",
  );
  const invalid = [];

  if (
    !missing.includes("DATABASE_URL") &&
    !isUrl(values.DATABASE_URL, ["postgres:", "postgresql:"])
  ) {
    invalid.push("DATABASE_URL");
  }

  if (
    !missing.includes("BETTER_AUTH_SECRET") &&
    values.BETTER_AUTH_SECRET.length < 32
  ) {
    invalid.push("BETTER_AUTH_SECRET");
  }

  for (const key of ["BETTER_AUTH_URL", "NEXT_PUBLIC_BETTER_AUTH_URL"]) {
    if (
      typeof values[key] === "string" &&
      values[key].trim() !== "" &&
      !isUrl(values[key], ["http:", "https:"])
    ) {
      invalid.push(key);
    }
  }

  return {
    ready: missing.length === 0 && invalid.length === 0,
    missing,
    invalid,
  };
}
