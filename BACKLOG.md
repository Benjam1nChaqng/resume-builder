# Resume Builder Backlog

This backlog is ordered by user value and implementation risk. Work top to bottom unless a dependency or explicit user direction changes the order.

Priority meanings:

- P0: required for the current discovery-to-tailored-PDF MVP.
- P1: required before a dependable private beta.
- P2: scale, differentiation, and stronger job-search outcomes.
- P3: production operations and business readiness.

## P0: Discovery To Tailored PDF

### Delivery foundation

- [x] Add job search profile, source, discovery run, listing, and resume fit tables.
- [x] Add initial curated-source discovery, URL canonicalization, and deduplication helpers.
- [x] Add discovered, saved, rejected, tailored, and applied listing states.
- [x] Add source-backed resume fit analysis and persistence.
- [x] Add non-destructive tailored resume copies with `originalText` provenance.
- [x] Generate and commit Drizzle snapshot metadata for migration `0003`.
- [ ] Verify migration `0003` against a disposable Postgres or Neon branch.
- [ ] Add database constraints for status fields and fit score range where practical.
- [ ] Add a unique or replacement policy for repeated fit checks for one job/resume pair.
- [ ] Make tailored resume creation atomic or fully compensate every partial write.

### Search profiles and sources

- [ ] Add profile update and delete actions with ownership checks.
- [ ] Add source enable, disable, edit, and delete actions with ownership checks.
- [x] Normalize and canonicalize source URLs before uniqueness checks.
- [x] Reject non-HTTP source protocols.
- [x] Block localhost, link-local, private-network, and metadata-service targets to prevent SSRF.
- [x] Revalidate resolved redirects before fetching source content.
- [x] Add request timeout, response-size limit, and content-type validation.
- [ ] Surface duplicate-source, invalid-source, and ownership errors in the UI.
- [ ] Add a profile selector that does not silently choose only the newest profile.
- [ ] Persist a selected or default search profile per user.

### Discovery quality

- [ ] Parse `JobPosting` JSON-LD before falling back to anchor extraction.
- [ ] Add dedicated adapters for Greenhouse, Lever, Ashby, and Workday search pages.
- [ ] Extract company, location, employment type, compensation, and posted date when available.
- [ ] Apply profile target roles, keywords, exclusions, location, remote, and basic-job filters.
- [ ] Deduplicate by canonical URL and normalized company/title fingerprint.
- [x] Return the number of rows actually inserted, not the number attempted.
- [ ] Run independent source fetches with bounded concurrency.
- [ ] Record per-source results and partial failures for each discovery run.
- [ ] Show last-run status, duration, inserted count, and error summary.
- [ ] Add retry behavior for transient source failures without duplicating listings.
- [ ] Add fixture tests for each supported parser and malformed HTML.
- [x] Add tests for redirects, timeouts, oversized responses, and blocked hosts.

### Listing review and jobs

- [ ] Add discovered-listing filters, sorting, pagination, and profile scoping.
- [ ] Allow rejected listings to be restored.
- [ ] Prevent saving a listing URL supplied independently of the authorized listing row.
- [ ] Convert a saved listing into one structured `job` record idempotently.
- [ ] Preserve the discovery source and listing link on the structured job.
- [ ] Move listing status to tailored when a tailored resume is created.
- [ ] Add an applied action with application date and optional notes.
- [ ] Show the full listing/application state history on the job page.
- [ ] Add integration tests for duplicate discovery and every state transition.

### Fit and tailoring

- [ ] Verify job and resume ownership belong to the same authenticated user in one service boundary.
- [ ] Persist fit-check failure state and safe retry messaging.
- [ ] Include requirement-level source evidence and confidence in the fit contract.
- [ ] Separate hard requirements, preferred requirements, concerns, and unsupported claims.
- [ ] Add a deterministic non-LLM baseline score for testing and comparison.
- [ ] Show fit results for the selected resume instead of only the latest job-wide result.
- [ ] Let users accept or reject individual proposed bullet changes.
- [ ] Apply only accepted changes to the tailored copy.
- [ ] Preserve every source resume row and original bullet exactly.
- [ ] Prevent duplicate tailored applications or define an explicit versioning policy.
- [ ] Add service tests proving source rows are unchanged after tailoring.
- [ ] Add failure-injection tests proving partial tailored copies are cleaned up.

### Real PDF download

- [x] Add the approved PDF rendering dependency and lockfile update.
- [x] Build one ATS-safe PDF document component from structured resume data.
- [x] Add an authenticated route handler that returns `application/pdf` bytes.
- [x] Return `404` or `403` without leaking whether another user's resume exists.
- [x] Generate a sanitized filename from candidate, company, and role when linked to a job.
- [x] Keep the print preview as an optional preview, not the download implementation.
- [x] Add export tests for authorization, headers, filename, and non-empty PDF bytes.
- [x] Render representative one-page and two-page fixtures and visually inspect them.

### End-to-end user experience

- [ ] Add pending states that prevent duplicate profile, source, discovery, fit, and tailor submissions.
- [ ] Add useful empty states for no profile, no source, no listing, no resume, and no fit result.
- [ ] Add field-level validation messages instead of uncaught server-action errors.
- [ ] Add success feedback after discovery, save, reject, fit, tailor, and download actions.
- [ ] Make profile/source management usable on mobile and desktop.
- [ ] Verify import resume to discover job to fit check to tailored copy to PDF in a real browser.
- [ ] Run `pnpm typecheck`, `pnpm lint`, `pnpm test:run`, and `pnpm build` cleanly.
- [ ] Update the changelog and commit each logical unit.
- [ ] Push the verified branch and smoke-test the production deployment when authorized.

## P1: Dependable Private Beta

### Evaluation and truthfulness

- [ ] Define a versioned fit-scoring rubric with recruiter, ATS, and hiring-manager dimensions.
- [ ] Create a small anonymized gold dataset of resumes, jobs, expected evidence, and forbidden claims.
- [ ] Add Braintrust evals for extraction accuracy, fit ranking, and tailoring faithfulness.
- [ ] Add hallucination checks that fail any invented employer, metric, credential, or tool.
- [ ] Compare model scores with the deterministic baseline and flag large disagreement.
- [ ] Track prompt, schema, rubric, and model versions on every fit and tailoring result.
- [ ] Add regression cases for sparse resumes, career changes, entry-level candidates, and hourly roles.
- [ ] Add quality thresholds that block low-confidence auto-tailoring.

### Reliability and observability

- [ ] Route every LLM call through Helicone with user-safe correlation metadata.
- [ ] Add structured logs for discovery runs, fit checks, tailoring, and exports.
- [ ] Add retry and idempotency keys around expensive model operations.
- [ ] Add rate limits per user for scraping and LLM actions.
- [ ] Add cost accounting per workflow and per user.
- [ ] Add Sentry or the approved error-reporting path for server failures.
- [ ] Add health checks for database, Blob, and model connectivity.
- [ ] Add cleanup jobs for abandoned discovery runs and partial artifacts.

### Product completeness

- [ ] Add search-profile duplication for setting up a friend quickly.
- [ ] Add candidate notes and consent/provenance fields for friend-managed profiles.
- [ ] Add a job pipeline board for saved, tailored, applied, interviewing, offered, and closed.
- [ ] Add application notes, contacts, follow-up dates, and source attribution.
- [ ] Add resume version labels and comparison between base and tailored copies.
- [ ] Add DOCX export after the PDF path is stable.
- [ ] Add accessibility checks for forms, focus, labels, contrast, and keyboard workflows.
- [ ] Add Playwright smoke tests for the critical authenticated journey.

## P2: Better Job Outcomes And Scale

### Discovery expansion

- [ ] Add first-party company-career source templates.
- [ ] Add supported public job-board APIs where terms permit.
- [ ] Add scheduled discovery runs per profile with user-controlled cadence.
- [ ] Add email or in-app digests for new high-fit listings.
- [ ] Add freshness detection, expired-listing checks, and automatic archive states.
- [ ] Add semantic deduplication across reposted jobs and staffing mirrors.
- [ ] Add location-radius and commute-aware filtering.
- [ ] Add compensation normalization across hourly, annual, and range formats.
- [ ] Add visa, shift, schedule, clearance, and physical-requirement filters.
- [ ] Rank listings by fit, freshness, compensation, and user preference.

### Research and coaching

- [ ] Add source-cited company research as a separate optional step.
- [ ] Add resume benchmark checks grounded in a versioned evidence library.
- [ ] Add ATS formatting diagnostics independent of job fit.
- [ ] Add quantified-impact coaching that asks for missing facts instead of inventing metrics.
- [ ] Add cover-letter and outreach drafts tied to verified resume evidence.
- [ ] Add interview question generation from fit gaps.
- [ ] Add learning-resource suggestions for genuine skill gaps.
- [ ] Add feedback capture after applications and interviews to improve ranking.

### Agentic architecture

- [ ] Introduce the Codex Agent SDK orchestration layer after the deterministic services are stable.
- [ ] Separate planner, executor, reviewer, and policy-check roles with explicit contracts.
- [ ] Add resumable workflow state and step-level idempotency.
- [ ] Build a career-data MCP server with least-privilege tools.
- [ ] Add dry-run and approval gates for external side effects.
- [ ] Add trace replay for failed or low-scoring agent runs.
- [ ] Add prompt and tool contract tests to CI.

## P3: Production And Business Readiness

- [ ] Define data retention, account deletion, export, and friend-data consent policies.
- [ ] Encrypt or minimize sensitive candidate data beyond baseline platform controls.
- [ ] Complete a threat model for uploads, scraping, prompts, private URLs, and generated files.
- [ ] Add dependency, secret, and code security scanning in CI.
- [ ] Add database backup, restore, and migration rollback procedures.
- [ ] Add Vercel preview checks and production promotion gates.
- [ ] Add feature flags for discovery adapters and model changes.
- [ ] Add usage limits, billing plans, and Stripe only after private-beta usage is understood.
- [ ] Add privacy policy, terms, support path, and user-facing AI limitations.
- [ ] Add product analytics for activation, discovery yield, tailoring completion, and application outcomes.
- [ ] Prepare a portfolio case study with architecture, evals, tradeoffs, and measured results.
- [ ] Prepare launch materials only after the core workflow is reliable and evidence-backed.
