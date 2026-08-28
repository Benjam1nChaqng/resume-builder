import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";

const baseUrl = process.env.AGENT_API_BASE_URL?.replace(/\/$/, "");
const token = process.env.AGENT_API_TOKEN;

function usage() {
  console.error(`Usage:
  pnpm agent context [output.json]
  pnpm agent save-resume <input.json>
  pnpm agent update-resume <resume-id> <input.json>
  pnpm agent save-fit <input.json>
  pnpm agent run-discovery <input.json>
  pnpm agent run-fit <input.json>
  pnpm agent ingest-listings <input.json>
  pnpm agent save-job <input.json>
  pnpm agent tailor <input.json>
  pnpm agent create-artifact <input.json>
  pnpm agent request-action <input.json>
  pnpm agent claim-action <request-id>
  pnpm agent complete-action <request-id>
  pnpm agent fail-action <request-id> <input.json>
  pnpm agent download-pdf <resume-id> [output.pdf]`);
}

function requireConfig() {
  if (!baseUrl) throw new Error("AGENT_API_BASE_URL is missing from .env.local.");
  if (!token) throw new Error("AGENT_API_TOKEN is missing from .env.local.");
}

async function request(path, init = {}) {
  requireConfig();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Agent API ${response.status}: ${detail.slice(0, 1_000)}`);
  }
  return response;
}

async function jsonFile(path) {
  return JSON.parse(await readFile(resolve(path), "utf8"));
}

async function writeJson(path, value) {
  const output = resolve(path);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  console.log(output);
}

function responseFilename(response, fallback) {
  const disposition = response.headers.get("content-disposition") ?? "";
  const match = /filename="([^"]+)"/i.exec(disposition);
  return match?.[1] ? basename(match[1]) : fallback;
}

async function main() {
  const [command, first, second] = process.argv.slice(2);
  if (!command) {
    usage();
    process.exitCode = 1;
    return;
  }

  if (command === "context") {
    const data = await (await request("/api/agent/v1/context")).json();
    if (first) await writeJson(first, data);
    else console.log(JSON.stringify(data, null, 2));
    return;
  }

  if (command === "update-resume") {
    if (!first || !second) {
      throw new Error("update-resume requires a resume id and input JSON file.");
    }
    const response = await request(
      `/api/agent/v1/resumes/${encodeURIComponent(first)}`,
      {
        method: "PATCH",
        body: JSON.stringify(await jsonFile(second)),
      },
    );
    console.log(JSON.stringify(await response.json(), null, 2));
    return;
  }

  const jsonCommands = {
    "save-resume": "/api/agent/v1/resumes",
    "save-fit": "/api/agent/v1/resume-fits",
    "run-discovery": "/api/agent/v1/discovery-runs",
    "run-fit": "/api/agent/v1/resume-fit-runs",
    "ingest-listings": "/api/agent/v1/listings",
    "save-job": "/api/agent/v1/jobs",
    tailor: "/api/agent/v1/tailored-resumes",
    "create-artifact": "/api/agent/v1/application-artifacts",
    "request-action": "/api/agent/v1/action-requests",
  };
  if (command in jsonCommands) {
    if (!first) throw new Error(`${command} requires an input JSON file.`);
    const response = await request(jsonCommands[command], {
      method: "POST",
      body: JSON.stringify(await jsonFile(first)),
    });
    console.log(JSON.stringify(await response.json(), null, 2));
    return;
  }

  if (command === "claim-action" || command === "complete-action") {
    if (!first) throw new Error(`${command} requires an action request id.`);
    const operation = command === "claim-action" ? "claim" : "complete";
    const response = await request(
      `/api/agent/v1/action-requests/${encodeURIComponent(first)}/${operation}`,
      { method: "POST" },
    );
    console.log(JSON.stringify(await response.json(), null, 2));
    return;
  }

  if (command === "fail-action") {
    if (!first || !second) {
      throw new Error("fail-action requires a request id and input JSON file.");
    }
    const response = await request(
      `/api/agent/v1/action-requests/${encodeURIComponent(first)}/fail`,
      {
        method: "POST",
        body: JSON.stringify(await jsonFile(second)),
      },
    );
    console.log(JSON.stringify(await response.json(), null, 2));
    return;
  }

  if (command === "download-pdf") {
    if (!first) throw new Error("download-pdf requires a resume id.");
    const response = await request(
      `/api/agent/v1/resumes/${encodeURIComponent(first)}/pdf`,
    );
    const fallback = `${first}.pdf`;
    const output = resolve(
      second ?? `artifacts/resumes/${responseFilename(response, fallback)}`,
    );
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, Buffer.from(await response.arrayBuffer()));
    console.log(output);
    return;
  }

  usage();
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
