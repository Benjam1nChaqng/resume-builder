# Private Job Search Operating System Design

**Date:** 2026-08-25
**Status:** Approved direction, pending written-spec review
**Owner:** Benjamin Chang

## Summary

Finish the existing resume builder as a private, daily job-search operating system for Benjamin. The system must find current roles that meet his compensation floor, rank them from verified evidence, prepare truthful job-specific application packages, and reduce his normal daily work to a short review and final submission.

The existing application remains the system of record. Deterministic services perform broad discovery, filtering, normalization, and deduplication. Model calls are reserved for a small number of high-value fit, writing, and review tasks. Codex may orchestrate the daily workflow through narrow agent endpoints, but it must never receive the entire account history by default.

This is the first flagship portfolio project. A second portfolio project does not begin until this product reaches the acceptance criteria in this document.

## Product Goal

Each daily run should produce:

1. A fresh queue of first-party or otherwise reputable job listings.
2. A main queue containing only regular roles with confirmed annual base compensation of at least $80,000, or contract roles with confirmed compensation of at least $50 per hour.
3. A separate salary-verification queue for otherwise strong roles without posted compensation.
4. Evidence-backed research for no more than the five strongest qualifying roles.
5. One automatically prepared application package for the strongest actionable role, unless no role passes the quality threshold.
6. A short review surface where Benjamin can apply, skip, answer missing sensitive questions, or defer.

## Non-Goals

- Public accounts, friend-managed profiles, collaboration, billing, or product-launch work.
- Unrestricted crawling of the open web.
- LinkedIn scraping or prohibited browser automation.
- Universal application submission APIs or blind application volume.
- Automatic answers to work authorization, sponsorship, EEO, salary, relocation, background-check, or certification questions.
- Automatic email sending or final application submission.
- A multi-agent framework, MCP server, or browser extension before the core workflow is proven.
- A second major portfolio application before this project is verified and packaged.

## Selected Approach

Use the existing Next.js application as a private operations console and persistent system of record. Keep the current deterministic domain services and agent bridge, then improve their boundaries, automation, evaluation, and user experience.

Rejected alternatives:

- A CLI-only agent would be quicker to extend but harder to inspect, more expensive in context usage, less reliable, and weaker as portfolio evidence.
- A public job-search SaaS would redirect effort into onboarding, multi-user security, browser extensions, billing, and platform-specific application forms without improving Benjamin's immediate job outcomes.

## System Architecture

The workflow has five independently testable layers.

### 1. Source Registry And Discovery

The application maintains user-owned role tracks and enabled sources. Role tracks replace the friend-profile concept in the UI. Initial tracks cover technical support engineering, IT operations and systems, junior software and AI, and AI evaluation and quality.

A curated source library supplies validated first-party Greenhouse, Lever, Ashby, Workday, and employer career URLs for relevant Bay Area and remote employers. Sources retain health information so broken or stale feeds can be identified without blocking healthy sources.

Discovery uses structured public ATS feeds where available and the existing guarded HTML fallback otherwise. It canonicalizes URLs, normalizes fields, deduplicates listings, records the source and last-seen time, and never invokes a model simply to parse a supported feed.

### 2. Qualification And Ranking

Every listing receives deterministic classification before any model call:

- compensation status: confirmed qualifying, needs verification, or below floor
- employment type: regular, contract, internship, or unknown
- freshness and last-seen status
- location and onsite, hybrid, or remote fit
- title and keyword fit to the role track
- exclusion and seniority checks

The main queue never places unknown-compensation roles above confirmed qualifying roles. Roles below the compensation floor do not enter the main queue. Ranking favors compensation, freshness, location, evidence-backed fit, and growth potential.

### 3. Evidence And Model Services

Model inputs are job-specific and minimal. A fit request receives one structured job, one canonical base resume, role-track preferences, and no unrelated application history or contact data.

Deterministic scoring runs for every candidate selected for review. Model-based fit analysis runs only for the strongest qualifying roles. Full research is limited to five roles per daily run, and automatic tailoring is limited to one role by default.

Every model result uses structured output and records model, prompt, schema, rubric, input hash, token usage, estimated cost, and creation time. The system rejects any unsupported employer, tool, technology, credential, number, date, degree claim, or work result. Invalid output retries once, then falls back to deterministic analysis.

Stable prompt content is placed before dynamic content and uses prompt caching where the selected model supports it. Routine extraction and rewriting use the least expensive model that passes the evaluation threshold. Higher-cost review is allowed only when evaluation demonstrates a material quality improvement.

### 4. Application Package Service

Tailoring always creates a new resume copy. The resume model distinguishes canonical base resumes from tailored copies and records `sourceResumeId` lineage. Agent summaries return base resumes only unless tailored history is explicitly requested.

The service may automatically apply a proposed bullet change only when it:

- preserves the source meaning
- introduces no new proper noun, technology, credential, date, or number
- is supported by an identified source resume section
- passes schema and faithfulness checks

Unsafe or low-confidence edits are omitted rather than shown as questions. The source resume is never modified.

The resulting package contains the tailored resume, ATS-safe PDF, fit evidence, missing requirements, application-answer draft, optional outreach draft, source links, and unresolved user-confirmation items. The application record freezes the exact resume and artifact versions used for submission.

### 5. Approval And Tracking

The application can prepare every reversible internal artifact without interrupting Benjamin. Human confirmation is required only for an external transmission, final submission, email send, or unresolved sensitive answer.

The application lifecycle is:

`discovered -> saved -> researched -> needs_answers -> tailored -> ready_to_apply -> approved -> applied -> interviewing -> offered/closed`

Transitions are idempotent and recorded in history. Follow-up dates, contacts, notes, and interview activity remain attached to the application.

## Product Surfaces

### Daily Dashboard

The dashboard is the main working screen and displays:

- new confirmed qualifying roles
- salary-verification roles
- one recommended next action
- packages ready to apply
- missing-answer items
- follow-ups due
- applications and interviews in progress
- the latest automation-run status

The layout is dense, restrained, and optimized for scanning. Source administration is secondary to the daily queue.

### Discovery Inbox

The inbox defaults to current confirmed qualifying listings. It supports role-track selection, status, compensation status, freshness, and location filters. Source health and source editing are available in settings rather than dominating the review workflow.

### Job Workspace

One job page contains the verified description, source URL, compensation and freshness evidence, fit results, missing requirements, resume diff, PDF, application answers, approval state, notes, follow-up, and history. The page should make the next available action unambiguous.

### Pipeline

A compact pipeline view groups applications by researched, needs answers, ready to apply, applied, interviewing, offered, and closed. It is an operational view rather than a decorative kanban board.

## Agent Interfaces

Replace the unbounded context response with narrow, paginated interfaces:

- `GET /api/agent/v1/today`: counts, run status, and top-ranked IDs
- `GET /api/agent/v1/jobs/:id/context?resumeId=...`: one job, one base resume, current fit, and package status
- `GET /api/agent/v1/action-requests?status=pending`: pending approval items only
- paginated listing, job, resume, artifact, and history reads with explicit limits

The existing broad context route may remain temporarily for migration, but it must be deprecated, capped, and excluded from the daily automation. No default agent read may return every resume copy, 200 jobs, 500 listings, and 500 artifacts in one response.

Mutation endpoints remain owner-scoped, versioned, idempotent, and least privilege. External-action requests remain frozen, expiring, and single claim.

## Automation

The daily pipeline performs these steps without user input:

1. Validate configuration and acquire an idempotency lock.
2. Run enabled sources with bounded concurrency.
3. Normalize, deduplicate, update last-seen timestamps, and archive expired listings.
4. Apply salary, employment, location, exclusion, and freshness rules.
5. Rank qualifying listings deterministically.
6. Research and fit-check at most five roles.
7. Prepare at most one application package when confidence exceeds the threshold.
8. Publish one concise daily summary and any ready-to-apply package.

The existing Codex heartbeat may orchestrate model-backed research and package preparation, but it must use the compact endpoints. Deterministic discovery remains callable from the app and CLI so the workflow does not depend on one interactive conversation.

## Error Handling And Limits

- One failed source produces a partial run, not a failed day.
- Transient source failures use bounded retry and backoff.
- Duplicate scheduled invocations do not create duplicate listings, fits, resumes, artifacts, or action requests.
- An expired or unavailable listing invalidates any unsent package and removes it from ready-to-apply.
- A failed model call records a safe error and never leaves a partially linked tailored resume.
- Low-confidence roles move to hold with a reason instead of prompting Benjamin.
- Per-run limits cap source count, researched jobs, tailoring jobs, tokens, and estimated cost.
- Logs exclude API keys, bearer tokens, resume contact details, and application answers.

## Evaluation And Testing

### Deterministic Tests

Maintain the existing unit and integration coverage and add tests for:

- salary normalization for annual and hourly compensation
- contract and regular compensation thresholds
- last-seen and expired-listing behavior
- role-track ranking and base-resume selection
- compact endpoint pagination and authorization
- resume lineage and exclusion of tailored copies from default context
- daily-run idempotency and partial-source failures
- package invalidation when a listing expires
- usage and cost metadata persistence

### Truthfulness Evaluation

Create a small anonymized gold dataset containing representative resumes, job descriptions, supported evidence, expected missing requirements, and forbidden claims. Evaluation must cover support roles, IT operations, software-adjacent roles, sparse evidence, and stretch roles.

Release thresholds:

- zero invented employers, credentials, technologies, metrics, or dates
- every positive fit finding points to a valid resume section
- every automatic bullet edit is semantically supported by source text
- low-confidence cases are held rather than auto-tailored
- model quality meets or beats the deterministic baseline on the gold set

### Browser And Production Verification

Add authenticated Playwright coverage for:

`sign in -> dashboard -> discover -> save -> fit -> package -> PDF -> approval queue -> applied -> follow-up`

Verify desktop and mobile layouts, keyboard navigation, loading and empty states, PDF download and visual rendering, and production authorization boundaries. The release gate remains:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test:run`
- `pnpm build`
- database migration against a disposable database
- authenticated production smoke test
- one real first-party discovery run
- one real package generated and downloaded without submission

## Portfolio Finish Line

The project is portfolio-ready only when the production workflow passes the release gate and the repository includes:

- an accurate product README
- an architecture and data-flow diagram
- a short demo recording or scripted demo path
- screenshots using private or synthetic data
- evaluation results and truthfulness methodology
- measured context reduction, workflow cost, discovery yield, and package preparation time
- a concise case study covering constraints, tradeoffs, safety boundaries, and outcomes

The portfolio description must distinguish what is automated, what requires approval, and what was measured. It must not claim interview or hiring improvements without collected outcome data.

## Implementation Sequence

1. Context and lineage: compact agent reads, base/tailored resume lineage, migration, and usage metadata.
2. Discovery quality: normalized salary qualification, source health, last-seen expiry, and curated source presets.
3. Daily automation: bounded orchestration, idempotency, cost caps, and concise run summaries.
4. Product workflow: daily dashboard, qualifying inbox, job workspace, pipeline, and low-interaction package generation.
5. Evaluation and reliability: gold dataset, truthfulness graders, structured logs, and failure recovery.
6. Verification and portfolio packaging: Playwright, production smoke test, documentation, metrics, screenshots, and demo.

Each sequence item is independently deployable. No later item may weaken ownership checks, truthfulness invariants, or external-action approval boundaries.

## Acceptance Criteria

The design is complete when current production evidence proves all of the following:

1. A scheduled or explicitly triggered daily run finds and deduplicates current jobs from healthy first-party sources.
2. The main queue excludes confirmed compensation below $80,000 annually or $50 per hour for contracts.
3. Unknown compensation is separated from confirmed qualifying roles.
4. The agent can obtain the daily queue and one job package without loading account-wide history.
5. No automatic tailored edit introduces an unsupported fact on the gold dataset or production smoke case.
6. One qualifying job can move from discovery through a downloadable package with no human interaction before review.
7. No email or application is sent without action-time confirmation.
8. The critical browser journey, full verification suite, migration check, and production smoke test pass.
9. The repository and portfolio materials accurately explain the system and include measured results.

