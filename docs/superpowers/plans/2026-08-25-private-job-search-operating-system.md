# Private Job Search Operating System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the existing resume builder as a verified private system that finds current qualifying jobs, prepares one evidence-backed application package with minimal user interaction, and produces portfolio-ready proof of the implementation.

**Architecture:** Keep Next.js and Neon as the system of record. Deterministic services perform broad discovery, compensation qualification, expiry, ranking, and safety checks; narrow owner-scoped APIs give Codex only the records needed for the current job; model calls are measured and limited to top candidates. Every task below leaves production behavior deployable and supplies explicit interfaces used by later tasks.

**Tech Stack:** Next.js 16, React 19, TypeScript, Drizzle ORM, Neon Postgres, Better Auth, OpenAI Responses API, Zod, Vitest, React PDF, Playwright, Vercel.

**Spec:** `docs/superpowers/specs/2026-08-25-private-job-search-operating-system-design.md`

## Global Constraints

- Regular roles require confirmed annualized base compensation of at least `$80,000` for the main queue.
- Contract roles require confirmed compensation of at least `$50/hour` for the main queue.
- Unknown compensation stays in `needs_verification` and never ranks above confirmed qualifying compensation.
- The source resume is immutable; tailoring always creates a copy with explicit lineage.
- Never invent employers, technologies, credentials, metrics, dates, degree facts, or application answers.
- No external email or application submission occurs without action-time confirmation.
- Default agent reads must be owner-scoped, paginated, and must not contain account-wide resume or artifact history.
- No public accounts, friend management, billing, LinkedIn scraping, blind auto-submit, MCP server, or browser extension.
- Use test-first implementation and one logical commit per task.
- Do not push or deploy a task until its targeted tests and `pnpm typecheck` pass.

---

## File Map

### Data And Domain

- `src/lib/db/resume-schema.ts`: base/tailored resume lineage.
- `src/lib/db/jobs-schema.ts`: role-track default resume, compensation status, source health, listing freshness, model runs, and daily pipeline runs.
- `src/lib/jobs/compensation.ts`: pure compensation parsing, annualization, and qualification.
- `src/lib/jobs/listing-freshness.ts`: source-success miss counting and expiry decisions.
- `src/lib/jobs/source-presets.ts`: private curated employer-source presets.
- `src/lib/jobs/daily-pipeline.ts`: bounded daily orchestration.
- `src/lib/jobs/application-package.ts`: automatic, idempotent package preparation.
- `src/lib/jobs/tailoring-safety.ts`: deterministic rejection of unsupported automatic edits.
- `src/lib/jobs/dashboard.ts`: compact dashboard and pipeline queries.
- `src/lib/resumes/lineage-backfill.ts`: audited one-time classification of proven legacy tailored copies.

### Agent And Model Boundaries

- `src/lib/agent/today.ts`: bounded daily summary DTO and query.
- `src/lib/agent/job-context.ts`: one-job, one-base-resume context DTO and query.
- `src/lib/ai/model-run.ts`: usage extraction, cost estimation, and model-run persistence.
- `src/app/api/agent/v1/today/route.ts`: owner-scoped daily summary.
- `src/app/api/agent/v1/jobs/[id]/context/route.ts`: owner-scoped job context.
- `src/app/api/agent/v1/listings/[id]/save/route.ts`: idempotent discovered-listing conversion.
- `src/app/api/agent/v1/application-packages/route.ts`: package preparation.
- `src/app/api/agent/v1/daily-runs/route.ts`: bounded daily pipeline entrypoint.
- `scripts/job-agent.mjs`: compact CLI commands used by the heartbeat.

### Product And Verification

- `src/app/dashboard/page.tsx`: daily operations dashboard.
- `src/app/jobs/discover/page.tsx`: qualifying inbox.
- `src/app/jobs/pipeline/page.tsx`: compact application pipeline.
- `src/components/daily-job-queue.tsx`: qualifying and salary-verification rows.
- `src/components/application-pipeline.tsx`: application stages and follow-ups.
- `evals/job-fit-gold.json`: anonymized truthfulness cases.
- `src/lib/ai/evals/truthfulness.ts`: deterministic eval graders.
- `playwright.config.ts`, `e2e/auth.setup.ts`, `e2e/private-job-os.spec.ts`: authenticated browser journey.
- `README.md`, `docs/architecture.md`, `docs/portfolio-case-study.md`, `CHANGELOG.md`: accurate release and portfolio evidence.

---

### Task 1: Add Canonical Resume Lineage And Role-Track Defaults

**Files:**
- Modify: `src/lib/db/resume-schema.ts`
- Modify: `src/lib/db/jobs-schema.ts`
- Modify: `src/lib/jobs/tailored-resume.ts`
- Modify: `src/lib/resumes/create.ts`
- Create: `src/lib/resumes/lineage-backfill.ts`
- Create: `src/lib/resumes/lineage-backfill.test.ts`
- Modify: `src/lib/agent/resumes.ts`
- Create: `scripts/backfill-resume-lineage.mjs`
- Test: `src/lib/jobs/tailored-resume.test.ts`
- Test: `src/lib/agent/resumes.test.ts`
- Create: `src/lib/db/migrations/0017_private_job_os_lineage.sql`
- Create: `src/lib/db/migrations/meta/0017_snapshot.json`

**Interfaces:**
- Produces: `ResumeKind = "base" | "tailored"`.
- Produces: `resume.kind`, `resume.sourceResumeId`, and `jobSearchProfile.defaultResumeId`.
- Preserves: `createTailoredResumeCopyForUser(...) => Promise<string>`.

- [ ] **Step 1: Write failing lineage tests**

Add assertions that a newly imported resume writes `kind: "base"` and `sourceResumeId: null`, while a tailored copy writes `kind: "tailored"` and the selected base ID.

```ts
expect(mockTransaction.insertedResume).toMatchObject({
  kind: "tailored",
  sourceResumeId: "base-resume-1",
});
expect(mockSourceResumeUpdate).not.toHaveBeenCalled();
```

Add an agent-resume schema test that rejects attempts to ingest a tailored resume without `sourceResumeId`.

Add lineage-backfill tests proving that a legacy copy is eligible only when it is non-default, belongs to the same owner as the selected base, is linked to an application, starts with the base title plus `" - "`, and has matching contact and education fingerprints. Assert that a mismatched or unlinked resume remains `base`.

- [ ] **Step 2: Run the targeted tests and verify failure**

Run:

```powershell
pnpm vitest run src/lib/jobs/tailored-resume.test.ts src/lib/resumes/lineage-backfill.test.ts src/lib/agent/resumes.test.ts
```

Expected: FAIL because lineage columns and validation do not exist.

- [ ] **Step 3: Add schema fields and constraints**

In `resume-schema.ts`, import `AnyPgColumn` and `check`, then add:

```ts
export type ResumeKind = "base" | "tailored";

kind: text("kind").$type<ResumeKind>().default("base").notNull(),
sourceResumeId: text("source_resume_id").references(
  (): AnyPgColumn => resume.id,
  { onDelete: "restrict" },
),
```

Add a check requiring base resumes to have no source and tailored resumes to have a source. Restrict deletion of a source resume while tailored descendants exist so the check cannot be invalidated. Add `defaultResumeId` to `jobSearchProfile` with `onDelete: "set null"`.

- [ ] **Step 4: Generate and inspect the migration**

Run:

```powershell
pnpm exec drizzle-kit generate --name private_job_os_lineage
```

Rename only if Drizzle does not produce `0017_private_job_os_lineage.sql`. Confirm the SQL backfills every existing resume as `base` with a null source before adding the check constraint. Do not classify legacy copies inside the migration because the old schema did not record trustworthy lineage.

- [ ] **Step 5: Implement the audited legacy backfill**

Implement `planLegacyResumeLineageBackfill({ userId, baseResumeId, profileId })`. It returns eligible IDs and rejection reasons without writing. Eligibility requires the same owner, a default base resume, a non-default candidate linked to an application, the expected title prefix, and matching contact and education fingerprints. `applyLegacyResumeLineageBackfill(...)` rechecks the plan inside a transaction, marks only eligible rows as `tailored`, writes `sourceResumeId`, and sets the profile's `defaultResumeId` to the selected base.

Create a local script with dry-run as the default and an explicit `--apply` flag:

```powershell
pnpm exec node scripts/backfill-resume-lineage.mjs --profile-id 373784c8-173c-4d04-9d57-027cc930fc91 --base-resume-id 45b902de-c0e3-41be-bd77-5771ba9abca2
```

The script must print counts and rejection reasons, never contact data or resume contents. Production application waits until Task 10, after the dry-run report is reviewed against current production state.

- [ ] **Step 6: Write lineage during creation and tailoring**

Set imported and agent-ingested resumes to `base`. Set automatic and user-created tailored copies to:

```ts
{
  kind: "tailored",
  sourceResumeId: resumeId,
  isDefault: false,
}
```

Validate that `defaultResumeId`, when present, is a base resume owned by the same user.

- [ ] **Step 7: Run migration and service tests**

Run:

```powershell
pnpm vitest run src/lib/jobs/tailored-resume.test.ts src/lib/resumes/lineage-backfill.test.ts src/lib/agent/resumes.test.ts src/lib/db/migrations/application-workflow-migration.test.ts
pnpm typecheck
```

Expected: all pass.

- [ ] **Step 8: Commit**

```powershell
git add src/lib/db src/lib/jobs/tailored-resume.ts src/lib/jobs/tailored-resume.test.ts src/lib/resumes/create.ts src/lib/resumes/lineage-backfill.ts src/lib/resumes/lineage-backfill.test.ts src/lib/agent/resumes.ts src/lib/agent/resumes.test.ts scripts/backfill-resume-lineage.mjs
git commit -m "feat(resumes): track canonical and tailored lineage"
```

---

### Task 2: Replace The Unbounded Agent Context With Compact Reads

**Files:**
- Create: `src/lib/agent/today.ts`
- Create: `src/lib/agent/today.test.ts`
- Create: `src/lib/agent/job-context.ts`
- Create: `src/lib/agent/job-context.test.ts`
- Create: `src/app/api/agent/v1/today/route.ts`
- Create: `src/app/api/agent/v1/today/route.test.ts`
- Create: `src/app/api/agent/v1/jobs/[id]/context/route.ts`
- Create: `src/app/api/agent/v1/jobs/[id]/context/route.test.ts`
- Modify: `src/lib/agent/context.ts`
- Modify: `src/app/api/agent/v1/context/route.test.ts`
- Modify: `scripts/job-agent.mjs`
- Modify: `docs/agent-api.md`

**Interfaces:**
- Produces: `loadAgentToday(userId, { limit }): Promise<AgentToday>`.
- Produces: `loadAgentJobContext({ userId, jobId, resumeId }): Promise<AgentJobContext | null>`.
- Produces CLI: `pnpm agent today [output.json]` and `pnpm agent job-context <job-id> <resume-id> [output.json]`.

- [ ] **Step 1: Write failing service tests**

Define the bounded response contract:

```ts
type AgentToday = {
  generatedAt: string;
  counts: {
    qualifying: number;
    needsSalaryVerification: number;
    readyToApply: number;
    followUpsDue: number;
  };
  latestRun: { id: string; status: string; completedAt: Date | null } | null;
  jobs: Array<{
    listingId: string;
    jobId: string | null;
    title: string;
    company: string | null;
    compensationStatus: string;
    matchScore: number;
    status: string;
  }>;
  pendingActions: Array<{ id: string; jobId: string; action: string; summary: string }>;
};
```

Assert `jobs.length <= limit`, no contact information is present, and tailored resumes are absent from the one-job context unless their ID is explicitly requested.

- [ ] **Step 2: Run targeted tests and verify failure**

```powershell
pnpm vitest run src/lib/agent/today.test.ts src/lib/agent/job-context.test.ts
```

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement bounded queries**

Use owner-scoped joins and explicit selects. Clamp `limit` to `1..50`, defaulting to `20`. `loadAgentJobContext` must select one job, one owned resume with children, the newest fit for that exact pair, current application data, and current artifacts for that job with a maximum of `20`.

- [ ] **Step 4: Add authenticated routes**

Follow the existing `requireAgentRequest` pattern. Parse IDs and limit with Zod. Return `404` for missing or unauthorized job/resume combinations without disclosing ownership.

- [ ] **Step 5: Deprecate and cap broad context**

Change `loadAgentContext` to return `deprecated: true`, at most five canonical resume summaries selected from profile `defaultResumeId` values plus the user's `isDefault` base resume, at most 20 jobs, 50 listings, 20 artifacts, and 20 action requests. Remove child resume rows and full job descriptions from this response. Include `replacementEndpoints` listing `today` and `job-context`.

- [ ] **Step 6: Add compact CLI commands**

Extend usage and dispatch:

```js
if (command === "today") {
  const data = await (await request("/api/agent/v1/today")).json();
  if (first) await writeJson(first, data);
  else console.log(JSON.stringify(data, null, 2));
  return;
}
```

Implement `job-context` with three positional arguments and URL-encode both IDs.

- [ ] **Step 7: Prove payload reduction**

Run the local tests, then against production after deployment save both responses and compare byte counts. The compact `today` response must be under 25 KB for the current account and at least 90 percent smaller than the pre-change context snapshot.

```powershell
pnpm vitest run src/lib/agent src/app/api/agent/v1/context src/app/api/agent/v1/today "src/app/api/agent/v1/jobs/[id]/context"
pnpm typecheck
```

- [ ] **Step 8: Commit**

```powershell
git add src/lib/agent src/app/api/agent scripts/job-agent.mjs docs/agent-api.md
git commit -m "feat(agent): add compact daily and job context"
```

---

### Task 3: Normalize And Persist Compensation Qualification

**Files:**
- Create: `src/lib/jobs/compensation.ts`
- Create: `src/lib/jobs/compensation.test.ts`
- Modify: `src/lib/jobs/discovery-ranking.ts`
- Modify: `src/lib/jobs/discovery-ranking.test.ts`
- Modify: `src/lib/db/jobs-schema.ts`
- Modify: `src/lib/jobs/discovery-repo.ts`
- Modify: `src/lib/jobs/listing-view.ts`
- Create: `src/lib/db/migrations/0018_private_job_os_compensation.sql`
- Create: `src/lib/db/migrations/meta/0018_snapshot.json`

**Interfaces:**
- Produces: `parseCompensationRange(text): CompensationRange | null`.
- Produces: `classifyCompensation({ text, employmentType, minAnnualSalary, minContractHourly }): CompensationQualification`.

- [ ] **Step 1: Write failing compensation tests**

Cover these exact cases:

```ts
expect(classify("$90,000-$110,000", "Full time")).toMatchObject({
  status: "confirmed_qualifying",
  minimumAnnualized: 90_000,
});
expect(classify("$45-$60/hour", "Contract").status).toBe("partial_range");
expect(classify("$45/hour", "Contract").status).toBe("below_floor");
expect(classify("$40-$45/hour", "Full time").status).toBe("confirmed_qualifying");
expect(classify(null, "Full time").status).toBe("needs_verification");
expect(classify("CAD 120,000", "Full time").status).toBe("needs_verification");
```

Hourly regular employment annualizes at 2,080 hours. Contract compensation is compared directly with `$50/hour`.

- [ ] **Step 2: Verify tests fail**

```powershell
pnpm vitest run src/lib/jobs/compensation.test.ts
```

- [ ] **Step 3: Extract the existing parser and implement classification**

Export:

```ts
export type CompensationStatus =
  | "confirmed_qualifying"
  | "partial_range"
  | "needs_verification"
  | "below_floor";

export type CompensationQualification = {
  status: CompensationStatus;
  interval: "annual" | "hourly" | null;
  minimum: number | null;
  maximum: number | null;
  minimumAnnualized: number | null;
  maximumAnnualized: number | null;
};
```

Move the tested regex behavior from `discovery-ranking.ts` without changing accepted formats.

- [ ] **Step 4: Persist normalized fields**

Add to `jobListing`: `compensationStatus`, `compensationInterval`, `compensationMin`, `compensationMax`, `compensationMinAnnualized`, and `compensationMaxAnnualized`. Add a status check constraint. Populate them in both standard and agent listing ingestion paths.

- [ ] **Step 5: Generate migration and backfill**

```powershell
pnpm exec drizzle-kit generate --name private_job_os_compensation
```

Backfill existing rows to `needs_verification`; do not attempt SQL regex inference. The next discovery refresh writes normalized values from the tested TypeScript parser.

- [ ] **Step 6: Update ranking and listing projections**

Sort tiers in this order: confirmed qualifying, partial range, needs verification. Filter below-floor roles from the main queue. Keep `partial_range` visible with an explicit warning that the low end misses the floor.

- [ ] **Step 7: Run tests and typecheck**

```powershell
pnpm vitest run src/lib/jobs/compensation.test.ts src/lib/jobs/discovery-ranking.test.ts src/lib/jobs/discovery-repo.test.ts src/lib/jobs/listing-view.test.ts
pnpm typecheck
```

- [ ] **Step 8: Commit**

```powershell
git add src/lib/jobs src/lib/db
git commit -m "feat(discovery): persist salary qualification"
```

---

### Task 4: Add Curated Sources, Source Health, And Listing Expiry

**Files:**
- Create: `src/lib/jobs/source-presets.ts`
- Create: `src/lib/jobs/source-presets.test.ts`
- Create: `src/lib/jobs/listing-freshness.ts`
- Create: `src/lib/jobs/listing-freshness.test.ts`
- Modify: `src/lib/db/jobs-schema.ts`
- Modify: `src/lib/jobs/discovery-repo.ts`
- Modify: `src/lib/jobs/run-discovery.ts`
- Modify: `src/lib/jobs/run-discovery.test.ts`
- Modify: `src/app/actions/jobs.ts`
- Create: `src/app/api/agent/v1/sources/install/route.ts`
- Create: `src/app/api/agent/v1/sources/install/route.test.ts`
- Create: `src/lib/db/migrations/0019_private_job_os_freshness.sql`
- Create: `src/lib/db/migrations/meta/0019_snapshot.json`

**Interfaces:**
- Produces: `installPrivateSourcePresets({ userId, profileId }): Promise<{ inserted: number; existing: number }>`.
- Produces: `recordSuccessfulSourceRefresh({ sourceId, seenCanonicalUrls, runStartedAt }): Promise<{ expired: number }>`.

- [ ] **Step 1: Write preset and freshness tests**

The preset test must canonicalize and deduplicate this initial board-root set:

```ts
[
  ["OpenAI", "https://jobs.ashbyhq.com/openai"],
  ["Harvey", "https://jobs.ashbyhq.com/harvey"],
  ["Pylon", "https://jobs.ashbyhq.com/pylon-labs"],
  ["Clay", "https://jobs.ashbyhq.com/claylabs"],
  ["LiveKit", "https://jobs.ashbyhq.com/livekit"],
  ["Reducto", "https://jobs.ashbyhq.com/reducto"],
  ["Flex", "https://jobs.ashbyhq.com/withflex"],
  ["E2B", "https://jobs.ashbyhq.com/e2b"],
  ["Hercules", "https://jobs.ashbyhq.com/hercules"],
  ["Socure", "https://jobs.ashbyhq.com/socure"],
]
```

Freshness tests must prove one successful miss does not expire a listing, two consecutive successful misses do, a failed source run does not increment misses, and applied listings are never invalidated.

- [ ] **Step 2: Verify tests fail**

```powershell
pnpm vitest run src/lib/jobs/source-presets.test.ts src/lib/jobs/listing-freshness.test.ts
```

- [ ] **Step 3: Add source and listing health columns**

Add `jobSource.lastCheckedAt`, `lastSuccessAt`, `consecutiveFailures`, and `lastErrorSummary`. Add `jobListing.lastSeenAt`, `consecutiveMisses`, and `expiredAt`. Extend listing status with `expired`.

- [ ] **Step 4: Generate and inspect migration**

```powershell
pnpm exec drizzle-kit generate --name private_job_os_freshness
```

Backfill `lastSeenAt = discoveredAt`, `consecutiveMisses = 0`, and source counters to zero before adding non-null constraints.

- [ ] **Step 5: Implement presets and installation route**

Validate every preset with `detectSupportedJobSource` and `assertPublicHttpUrl`. Use `onConflictDoNothing` so installation is idempotent. The route accepts only `{ profileId }` and derives the owner from the bearer token.

- [ ] **Step 6: Update discovery health atomically**

On a successful source run, reset source failures, reset seen listings to zero misses, increment unseen rows for that source, and expire only rows reaching two misses whose status is not `applied`. On failure, increment the source failure counter but do not touch listing misses.

- [ ] **Step 7: Invalidate unsent packages for expired listings**

For expired rows linked to applications in `researched`, `needs_answers`, `tailored`, `ready_to_apply`, or `approved`, move the application to `closed` and fail pending action requests with `errorSummary = "The source listing is no longer active."`. Preserve resumes and artifacts for audit.

- [ ] **Step 8: Run tests and typecheck**

```powershell
pnpm vitest run src/lib/jobs/source-presets.test.ts src/lib/jobs/listing-freshness.test.ts src/lib/jobs/run-discovery.test.ts src/lib/jobs/discovery-repo.test.ts src/app/api/agent/v1/sources/install/route.test.ts
pnpm typecheck
```

- [ ] **Step 9: Commit**

```powershell
git add src/lib/jobs src/lib/db src/app/actions/jobs.ts src/app/api/agent/v1/sources
git commit -m "feat(discovery): add source health and expiry"
```

---

### Task 5: Record Model Usage, Cost, And Version Metadata

**Files:**
- Create: `src/lib/ai/model-run.ts`
- Create: `src/lib/ai/model-run.test.ts`
- Modify: `src/lib/ai/models.ts`
- Modify: `src/lib/ai/openai.ts`
- Modify: `src/lib/ai/openai.test.ts`
- Modify: `src/lib/ai/resume-importer/index.ts`
- Modify: `src/lib/ai/jd-scraper/index.ts`
- Modify: `src/lib/ai/resume-fit/index.ts`
- Modify: `src/lib/ai/bullet-tailorer/index.ts`
- Modify: `src/lib/ai/email-writer/index.ts`
- Modify: `src/lib/db/jobs-schema.ts`
- Modify: production service callers under `src/lib/resumes` and `src/lib/jobs`
- Create: `src/lib/db/migrations/0020_private_job_os_model_runs.sql`
- Create: `src/lib/db/migrations/meta/0020_snapshot.json`

**Interfaces:**
- Produces: `ModelRunContext`, `ModelUsage`, and `estimateModelCostMicros(usage)`.
- Changes: `generateStructured(...)` accepts `runContext?: ModelRunContext` and persists one success or failure record.

- [ ] **Step 1: Write failing usage and cost tests**

```ts
expect(extractModelUsage({
  input_tokens: 1_000,
  input_tokens_details: { cached_tokens: 400 },
  output_tokens: 200,
})).toEqual({ inputTokens: 1_000, cachedInputTokens: 400, outputTokens: 200 });

expect(estimateModelCostMicros({
  model: "gpt-5.6-luna",
  inputTokens: 1_000,
  cachedInputTokens: 400,
  outputTokens: 200,
})).toBeGreaterThan(0);
```

Assert unknown models return `estimatedCostMicros: null`, not a fabricated estimate.

- [ ] **Step 2: Verify tests fail**

```powershell
pnpm vitest run src/lib/ai/model-run.test.ts src/lib/ai/openai.test.ts
```

- [ ] **Step 3: Add model-run schema**

Create `model_run` with user ID, optional job and resume IDs, operation, status, model, prompt version, schema version, input hash, response ID, input tokens, cached input tokens, output tokens, estimated cost micros, error summary, and created time. Never store prompts or resume text in this table.

- [ ] **Step 4: Add versioned pricing and input hashing**

In `models.ts`, define a dated pricing map for the currently selected models. Hash dynamic inputs with SHA-256. Keep the pricing map isolated so a price update changes one file and one test.

- [ ] **Step 5: Instrument structured generation**

Add:

```ts
export type ModelRunContext = {
  userId: string;
  operation: "resume_import" | "job_extract" | "fit" | "tailor" | "email" | "application_answers";
  promptVersion: string;
  schemaVersion: string;
  jobId?: string;
  resumeId?: string;
};
```

Use `prompt_cache_key` based on operation and prompt version. Record usage after Zod validation and record a safe failure row when the API or validation fails. Telemetry failure must be logged but must not replace the original model error.

- [ ] **Step 6: Pass context from production callers**

Thread user, job, and resume IDs from `createResumeForUser`, `createJobForUser`, `runResumeJobFitForUser`, tailoring, and email services. Add explicit prompt and schema version constants beside each AI module.

- [ ] **Step 7: Generate migration and run tests**

```powershell
pnpm exec drizzle-kit generate --name private_job_os_model_runs
pnpm vitest run src/lib/ai src/lib/jobs/fit.test.ts src/lib/jobs/tailor.test.ts src/lib/resumes/create.test.ts
pnpm typecheck
```

- [ ] **Step 8: Commit**

```powershell
git add src/lib/ai src/lib/jobs src/lib/resumes src/lib/db
git commit -m "feat(ai): record model usage and cost"
```

---

### Task 6: Prepare A Truth-Safe Application Package Automatically

**Files:**
- Create: `src/lib/jobs/tailoring-safety.ts`
- Create: `src/lib/jobs/tailoring-safety.test.ts`
- Create: `src/lib/jobs/application-package.ts`
- Create: `src/lib/jobs/application-package.test.ts`
- Create: `src/app/api/agent/v1/application-packages/route.ts`
- Create: `src/app/api/agent/v1/application-packages/route.test.ts`
- Modify: `src/lib/jobs/tailored-resume.ts`
- Modify: `src/lib/jobs/application-workflow.ts`
- Modify: `src/lib/db/jobs-schema.ts`
- Modify: `src/components/application-workspace.tsx`

**Interfaces:**
- Produces: `evaluateAutomaticBulletChange({ original, proposed }): TailoringSafetyDecision`.
- Produces: `prepareApplicationPackageForUser(input): Promise<PackagePreparationResult>`.

- [ ] **Step 1: Write failing safety tests**

Accept a close rewrite that reorders supported language. Reject changed numbers, new capitalized products, new credentials, added negation, low lexical overlap, and any technology appearing in the job description but not the source resume.

```ts
expect(evaluateAutomaticBulletChange({
  original: "Administer Microsoft 365 and Entra ID accounts and MFA.",
  proposed: "Administer Entra ID, Microsoft 365, and MFA for client accounts.",
}).safe).toBe(true);

expect(evaluateAutomaticBulletChange({
  original: "Migrated 126 Windows endpoints.",
  proposed: "Migrated 500 Windows and Linux endpoints with Jamf.",
}).safe).toBe(false);
```

- [ ] **Step 2: Write failing package service tests**

Prove the service:

- holds scores below `70`
- reuses an existing package by idempotency key
- substitutes the original bullet for every unsafe proposal
- creates a tailored copy without touching the source
- writes `application_answers` and `research` artifacts
- links the exact resume to the application
- moves the application to `ready_to_apply`
- creates one pending `submit_application` request

- [ ] **Step 3: Implement deterministic safety decisions**

Return:

```ts
type TailoringSafetyDecision = {
  safe: boolean;
  reasons: Array<
    | "changed_number"
    | "new_proper_noun"
    | "new_credential"
    | "new_job_only_skill"
    | "negation_changed"
    | "low_overlap"
  >;
};
```

Normalize case and punctuation, compare number sets exactly, maintain a small credential pattern list, derive job-only skill tokens from requirements, and require token-set Jaccard overlap of at least `0.55`.

- [ ] **Step 4: Implement the package transaction**

Define:

```ts
type PrepareApplicationPackageInput = {
  userId: string;
  jobId: string;
  baseResumeId: string;
  idempotencyKey: string;
  minimumFitScore?: number;
};

type PackagePreparationResult =
  | { status: "ready"; applicationId: string; tailoredResumeId: string; actionRequestId: string }
  | { status: "held"; reason: "low_fit" | "missing_fit" | "expired_listing" };
```

Load the newest completed fit for the exact job and base resume. Generate proposals, keep only safe changes, create the copy and artifacts, and write application/action state in one transaction or compensate every generated row on failure.

- [ ] **Step 5: Add owner-scoped package route**

Accept only `jobId`, `baseResumeId`, and `idempotencyKey`. Derive `userId` from bearer access. Return `201` for a new ready package, `200` for an idempotent reuse or held result, `404` for inaccessible records, and `409` for an expired listing.

- [ ] **Step 6: Show one package-level review**

In `application-workspace.tsx`, show the source-backed diff and omitted unsafe-edit count, but do not require checkbox approval for every safe bullet. Keep the original detailed comparison available.

- [ ] **Step 7: Run tests and typecheck**

```powershell
pnpm vitest run src/lib/jobs/tailoring-safety.test.ts src/lib/jobs/application-package.test.ts src/app/api/agent/v1/application-packages/route.test.ts src/lib/jobs/tailored-resume.test.ts src/lib/jobs/application-workflow.test.ts
pnpm typecheck
```

- [ ] **Step 8: Commit**

```powershell
git add src/lib/jobs src/app/api/agent/v1/application-packages src/components/application-workspace.tsx
git commit -m "feat(applications): prepare truth-safe packages"
```

---

### Task 7: Add Bounded Daily Pipeline Orchestration

**Files:**
- Create: `src/lib/jobs/daily-pipeline.ts`
- Create: `src/lib/jobs/daily-pipeline.test.ts`
- Create: `src/app/api/agent/v1/daily-runs/route.ts`
- Create: `src/app/api/agent/v1/daily-runs/route.test.ts`
- Create: `src/app/api/agent/v1/listings/[id]/save/route.ts`
- Create: `src/app/api/agent/v1/listings/[id]/save/route.test.ts`
- Modify: `src/lib/db/jobs-schema.ts`
- Modify: `scripts/job-agent.mjs`
- Modify: `package.json`
- Create: `src/lib/db/migrations/0021_private_job_os_daily_runs.sql`
- Create: `src/lib/db/migrations/meta/0021_snapshot.json`

**Interfaces:**
- Produces: `runPrivateDailyPipeline(input, dependencies?): Promise<DailyPipelineResult>`.
- Produces CLI: `pnpm agent daily <profile-id> [base-resume-id]`.

- [ ] **Step 1: Write failing orchestration tests**

Prove that a daily run installs presets when the profile has no enabled source, executes discovery once per idempotency key, researches no more than five confirmed qualifying listings, prepares no more than one package, skips below-floor and expired rows, and returns a summary even when one source fails.

- [ ] **Step 2: Define daily-run schema**

Add `daily_pipeline_run` with `userId`, `profileId`, `idempotencyKey`, status, counts for discovered/researched/packaged/held, estimated cost micros, error summary, started/completed timestamps, and a unique `(userId, idempotencyKey)` constraint.

- [ ] **Step 3: Implement bounded orchestration**

```ts
type DailyPipelineLimits = {
  maxResearchJobs: number;
  maxPackages: number;
  maxEstimatedCostMicros: number;
};

type DailyPipelineResult = {
  runId: string;
  status: "completed" | "partial" | "failed";
  discovered: number;
  researched: number;
  packaged: number;
  held: number;
  errors: string[];
};
```

Validate limits with Zod using `maxResearchJobs.max(5)` and `maxPackages.max(1)`, with defaults of five and one. Select `defaultResumeId` or the user's default base resume. Stop model work when the cost cap is reached. Store partial progress after each durable stage so a retry resumes rather than duplicates work.

- [ ] **Step 4: Add listing-save and daily-run routes**

The listing-save route calls `saveDiscoveredListingForUser` and returns the existing job ID on retries. The daily route accepts `profileId`, optional `baseResumeId`, and an idempotency key matching `daily:YYYY-MM-DD:<profileId>`.

- [ ] **Step 5: Add CLI orchestration command**

Extend `scripts/job-agent.mjs` so:

```powershell
pnpm agent daily 373784c8-173c-4d04-9d57-027cc930fc91
```

posts the date-keyed request and prints only the compact result. Do not call the deprecated context endpoint.

- [ ] **Step 6: Generate migration and run tests**

```powershell
pnpm exec drizzle-kit generate --name private_job_os_daily_runs
pnpm vitest run src/lib/jobs/daily-pipeline.test.ts src/app/api/agent/v1/daily-runs/route.test.ts "src/app/api/agent/v1/listings/[id]/save/route.test.ts"
pnpm typecheck
```

- [ ] **Step 7: Update the existing heartbeat**

After production deployment, update `daily-job-search-pipeline` to call `pnpm agent daily <profile-id>` first, then use `pnpm agent today` and `pnpm agent job-context` only when the runner returns a ready or held candidate. Preserve all action-time confirmation boundaries.

- [ ] **Step 8: Commit**

```powershell
git add src/lib/jobs/daily-pipeline.ts src/lib/jobs/daily-pipeline.test.ts src/app/api/agent/v1/daily-runs src/app/api/agent/v1/listings scripts/job-agent.mjs package.json src/lib/db
git commit -m "feat(agent): orchestrate the bounded daily pipeline"
```

---

### Task 8: Build The Daily Dashboard, Qualifying Inbox, And Pipeline

**Files:**
- Create: `src/lib/jobs/dashboard.ts`
- Create: `src/lib/jobs/dashboard.test.ts`
- Create: `src/components/daily-job-queue.tsx`
- Create: `src/components/application-pipeline.tsx`
- Create: `src/app/jobs/pipeline/page.tsx`
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/app/jobs/discover/page.tsx`
- Modify: `src/app/job/[id]/page.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: `loadDashboardData(userId, now): Promise<DashboardData>`.
- Consumes: compensation, freshness, application status, pending actions, and latest daily-run contracts from Tasks 3 through 7.

- [ ] **Step 1: Write failing dashboard query tests**

Assert separate arrays for confirmed qualifying, salary verification, ready to apply, and follow-ups due. Assert `nextAction` priority is: missing sensitive answer, ready package, due follow-up, highest-ranked unresearched listing.

- [ ] **Step 2: Implement one bounded dashboard query service**

Return no more than 10 rows per section and select only fields rendered by the UI. Do not load resume children, job descriptions, or full artifacts on the dashboard.

- [ ] **Step 3: Replace the current dashboard list UI**

Use a compact full-width layout with:

- top header and agent-access control
- one next-action band
- small count strip
- qualifying queue table
- ready/follow-up table
- latest-run status
- secondary links to resumes, discovery settings, and pipeline

Use Lucide icons for commands. Keep cards at 8px radius or less, avoid nested cards, and keep table rows usable at 375px width.

- [ ] **Step 4: Refocus discovery on listings**

Default to `confirmed_qualifying`; add tabs for `needs_verification`, `partial_range`, and history. Move source/profile forms below the listing workflow in a settings disclosure or separate settings band.

- [ ] **Step 5: Add pipeline page**

Render compact columns or grouped tables for researched, needs answers, ready, applied, interviewing, offered, and closed. Each item links to its job workspace and shows follow-up state. Do not add drag and drop.

- [ ] **Step 6: Tighten the job workspace**

Order sections as source and compensation, next action, fit evidence, resume/package, approvals, notes/history. Preserve detailed evidence and PDF download.

- [ ] **Step 7: Run query, component, lint, and type checks**

```powershell
pnpm vitest run src/lib/jobs/dashboard.test.ts src/lib/jobs/listing-view.test.ts
pnpm lint
pnpm typecheck
```

- [ ] **Step 8: Commit**

```powershell
git add src/lib/jobs/dashboard.ts src/lib/jobs/dashboard.test.ts src/components src/app/dashboard src/app/jobs src/app/job src/app/globals.css
git commit -m "feat(ui): add daily job operations dashboard"
```

---

### Task 9: Add Truthfulness Evals And Authenticated Browser Coverage

**Files:**
- Create: `evals/job-fit-gold.json`
- Create: `src/lib/ai/evals/truthfulness.ts`
- Create: `src/lib/ai/evals/truthfulness.test.ts`
- Create: `scripts/run-model-evals.mjs`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `playwright.config.ts`
- Create: `e2e/auth.setup.ts`
- Create: `e2e/private-job-os.spec.ts`
- Create: `.env.e2e.example`
- Modify: `.gitignore`

**Interfaces:**
- Produces scripts: `pnpm evals:deterministic`, `pnpm evals:model`, and `pnpm test:e2e`.

- [ ] **Step 1: Create the anonymized gold dataset**

Add at least 12 synthetic cases spanning IT support, IT operations, technical support engineering, junior software, AI evaluation, sparse evidence, career change, and stretch roles. Each case contains `resume`, `job`, `expectedEvidenceTerms`, `expectedMissingTerms`, and `forbiddenClaims`.

- [ ] **Step 2: Write deterministic grader tests**

Implement and test:

```ts
gradeFitEvidence(caseData, fit): {
  inventedClaimCount: number;
  groundedEvidenceRate: number;
  missingRequirementRecall: number;
}

gradeTailoring(caseData, changes): {
  inventedClaimCount: number;
  safeChangeRate: number;
}
```

The deterministic release gate is `inventedClaimCount === 0` for every case.

- [ ] **Step 3: Add optional live model eval runner**

`pnpm evals:model` runs fit and tailoring against the gold cases only when `RUN_LIVE_MODEL_EVALS=true`. It writes timestamped JSON to ignored `artifacts/evals/`, includes token/cost totals, and exits nonzero for invented claims or grounded evidence below 0.95.

- [ ] **Step 4: Install and configure Playwright**

```powershell
pnpm add -D @playwright/test
pnpm exec playwright install chromium
```

Configure one Chromium project plus an authentication setup project. Read `E2E_BASE_URL`, `E2E_EMAIL`, and `E2E_PASSWORD`; never commit their values. Use a dedicated test account and a disposable database for destructive journey tests.

- [ ] **Step 5: Write authenticated journey**

Cover:

```ts
test("discovery to package to PDF without external submission", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: /job search/i })).toBeVisible();
  await page.goto("/jobs/discover");
  await page.getByRole("link", { name: /qualifying/i }).click();
  await page.getByRole("link", { name: /view job/i }).first().click();
  await expect(page.getByText(/fit evidence/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /download pdf/i })).toBeVisible();
  await expect(page.getByText(/approval required/i)).toBeVisible();
  await expect(page).toHaveURL(/\/job\//);
});
```

The journey may open an employer application only through an explicit approval control, but it must not post an external form or navigate away during package preparation. Add 1440x900 and 390x844 screenshot assertions for dashboard, discovery, job, and pipeline pages. Assert no horizontal document overflow and no clipped button text.

- [ ] **Step 6: Run evals and browser tests**

```powershell
pnpm evals:deterministic
pnpm test:e2e
pnpm typecheck
pnpm lint
```

- [ ] **Step 7: Commit**

```powershell
git add evals src/lib/ai/evals scripts/run-model-evals.mjs package.json pnpm-lock.yaml playwright.config.ts e2e .env.e2e.example .gitignore
git commit -m "test: add job pipeline evals and browser coverage"
```

---

### Task 10: Verify Production And Package The Flagship Portfolio Project

**Files:**
- Modify: `scripts/verify.mjs`
- Modify: `scripts/preflight-mvp.mjs`
- Modify: `README.md`
- Create: `docs/architecture.md`
- Create: `docs/portfolio-case-study.md`
- Modify: `docs/agent-api.md`
- Modify: `PRODUCT.md`
- Modify: `BACKLOG.md`
- Modify: `CHANGELOG.md`
- Create: `artifacts/portfolio/.gitkeep`

**Interfaces:**
- Produces release command: `pnpm verify:production`.
- Produces portfolio evidence paths documented in `docs/portfolio-case-study.md`.

- [ ] **Step 1: Extend verification scripts**

Add `verify:production` to run runtime preflight, typecheck, lint, unit tests, deterministic evals, build, and authenticated Playwright when E2E credentials are present. Missing E2E credentials must fail `verify:production`, not silently skip browser verification.

- [ ] **Step 2: Replace stale product documentation**

Rewrite README and PRODUCT to describe OpenAI, the private role-track workflow, supported source adapters, truthfulness rules, agent endpoints, and the external-action boundary. Remove Claude Agent SDK, MCP, Day 1, and public-launch claims.

- [ ] **Step 3: Add architecture and case-study documents**

`docs/architecture.md` includes a Mermaid data-flow diagram and table ownership. `docs/portfolio-case-study.md` records the problem, constraints, decisions, safety design, validation, and measured results with fields filled from actual command output only.

- [ ] **Step 4: Run the full local release gate**

```powershell
pnpm verify:production
git diff --check
git status --short
```

Expected: all commands pass and only intended documentation or generated evidence remains uncommitted.

- [ ] **Step 5: Verify migrations on a disposable Neon branch**

Point `DATABASE_URL` at the disposable branch, run:

```powershell
pnpm db:migrate
pnpm verify:mvp
```

Confirm migrations 0017 through 0021 apply in order, existing resumes remain readable, and a second migration run is a no-op.

- [ ] **Step 6: Commit the release candidate**

```powershell
git add scripts README.md docs PRODUCT.md BACKLOG.md CHANGELOG.md artifacts/portfolio/.gitkeep package.json
git commit -m "docs: package private job search flagship"
```

- [ ] **Step 7: Apply production migrations and audited lineage backfill**

With the production `DATABASE_URL` loaded from the existing local secret store, record the current migration state and run:

```powershell
pnpm db:migrate
pnpm exec node scripts/backfill-resume-lineage.mjs --profile-id 373784c8-173c-4d04-9d57-027cc930fc91 --base-resume-id 45b902de-c0e3-41be-bd77-5771ba9abca2
```

Inspect the dry-run counts and rejection reasons against the current owner-scoped resume/application data. The script must abort if the supplied base is no longer the user's default or the profile owner differs. Only after those checks pass, run the same command with `--apply`, then rerun dry-run mode and a read-only lineage query to verify the default and tailored classifications. Never print or commit the production connection string.

- [ ] **Step 8: Push, deploy, and smoke-test production**

Push `main`, allow Vercel to deploy, verify the deployment URL, then run the authenticated browser path:

`dashboard -> discover -> qualifying listing -> job evidence -> package -> PDF -> approval queue`

Do not submit an external application or send email during the smoke test.

- [ ] **Step 9: Run one real daily pipeline**

```powershell
pnpm agent daily 373784c8-173c-4d04-9d57-027cc930fc91
pnpm agent today artifacts/portfolio/final-today.json
```

Verify at least one source succeeds, compensation queues are separated, duplicate rows are absent, and any generated package is sourced and downloadable.

- [ ] **Step 10: Capture measured portfolio evidence**

Record:

- old versus new agent payload bytes and reduction percentage
- number of healthy sources
- listings received, qualifying, salary unknown, and deduplicated
- model input, cached input, output tokens, and estimated workflow cost
- time from daily-run start to ready package
- deterministic eval and live eval pass rates
- unit, integration, build, and Playwright results

Use private or synthetic screenshots. Do not expose contact details, bearer tokens, or application answers.

- [ ] **Step 11: Update the daily automation and final commit**

Update `daily-job-search-pipeline` to use the new compact commands and one-package limit. Add the final one-line changelog entry, commit any resulting documentation metric updates, and confirm `git status --short --branch` is clean and synchronized.
