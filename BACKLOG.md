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
- [x] Verify migration `0003` against a disposable Postgres or Neon branch.
- [x] Add database constraints for status fields and fit score range where practical.
- [x] Keep immutable repeated fit history and deterministically select the newest result per resume.
- [x] Make tailored resume creation atomic or fully compensate every partial write.

### Search profiles and sources

- [x] Add profile update and delete actions with ownership checks.
- [x] Add source enable, disable, and delete actions with ownership checks.
- [x] Add source label and URL editing with ownership checks.
- [x] Normalize and canonicalize source URLs before uniqueness checks.
- [x] Reject non-HTTP source protocols.
- [x] Block localhost, link-local, private-network, and metadata-service targets to prevent SSRF.
- [x] Revalidate resolved redirects before fetching source content.
- [x] Add request timeout, response-size limit, and content-type validation.
- [x] Surface duplicate-source, invalid-source, and ownership errors in the UI.
- [x] Add a profile selector that does not silently choose only the newest profile.
- [x] Persist a selected or default search profile per user.

### Discovery quality

- [x] Parse `JobPosting` JSON-LD before falling back to anchor extraction.
- [x] Add dedicated adapters for public Greenhouse and global/EU Lever job boards.
- [x] Add a dedicated adapter for public Ashby job boards.
- [x] Add a stable supported adapter for Workday tenant search pages.
- [x] Extract location, employment type, compensation, and posted date when available.
- [x] Resolve company names from trusted source metadata when ATS feeds omit them.
- [x] Apply exclusions, remote, and basic-job filters, then rank by target roles, keywords, and location.
- [x] Deduplicate by canonical URL and normalized company/title/location fingerprint.
- [x] Return the number of rows actually inserted, not the number attempted.
- [x] Run independent source fetches with bounded concurrency.
- [x] Record per-source results and partial failures for each discovery run.
- [x] Show last-run status, duration, inserted count, and error summary.
- [x] Add retry behavior for transient source failures without duplicating listings.
- [x] Add fixture tests for each supported parser and malformed HTML.
- [x] Add tests for redirects, timeouts, oversized responses, and blocked hosts.

### Listing review and jobs

- [x] Add discovered-listing status filters and explicit profile scoping.
- [x] Add listing sorting and pagination for large result sets.
- [x] Allow rejected listings to be restored.
- [x] Prevent saving a listing URL supplied independently of the authorized listing row.
- [x] Convert a saved listing into one structured `job` record idempotently.
- [x] Preserve the discovery source row and canonical listing link on the structured job.
- [x] Move listing status to tailored when a tailored resume is created.
- [x] Add an applied action with application date.
- [x] Add optional application notes.
- [x] Show the full listing/application state history on the job page.
- [x] Add integration tests for duplicate discovery and every state transition.

### Fit and tailoring

- [x] Verify job and resume ownership belong to the same authenticated user in one service boundary.
- [x] Persist fit-check failure state and safe retry messaging.
- [x] Include requirement-level source evidence, resume section, and confidence in the fit contract.
- [x] Separate hard requirements, preferred requirements, concerns, and unsupported claims.
- [x] Add a deterministic non-LLM baseline score for testing and comparison.
- [x] Show fit results for the selected resume instead of only the latest job-wide result.
- [x] Let users accept or reject individual proposed bullet changes.
- [x] Apply only accepted changes to the tailored copy.
- [x] Preserve every source resume row and original bullet exactly.
- [x] Reuse the application record while creating explicit tailored resume versions.
- [x] Add service tests proving source rows are unchanged after tailoring.
- [x] Submit resume, child rows, application link, and listing state as one Neon HTTP transaction.

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

- [x] Add pending states that prevent duplicate profile, source, discovery, fit, and tailor submissions.
- [x] Add useful empty states for no profile, no source, no listing, no resume, and no fit result.
- [x] Add field-level validation messages instead of uncaught server-action errors.
- [x] Add success feedback after discovery, save, reject, fit, tailor, and download actions.
- [ ] Make profile/source management usable on mobile and desktop.
- [ ] Verify import resume to discover job to fit check to tailored copy to PDF in a real browser.
- [x] Run `pnpm typecheck`, `pnpm lint`, `pnpm test:run`, and `pnpm build` cleanly.
- [x] Update the changelog and commit each logical unit.
- [ ] Push the verified branch and smoke-test the production deployment when authorized.

## P1: Dependable Private Beta

### Evaluation and truthfulness

- [ ] Define a versioned fit-scoring rubric with recruiter, ATS, and hiring-manager dimensions.
- [ ] Create a small anonymized gold dataset of resumes, jobs, expected evidence, and forbidden claims.
- [ ] Add Braintrust evals for extraction accuracy, fit ranking, and tailoring faithfulness.
- [ ] Add hallucination checks that fail any invented employer, metric, credential, or tool.
- [x] Compare model scores with the deterministic baseline and flag large disagreement.
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

- [ ] Add saved-search duplication for quickly testing another role or location.
- [x] Keep saved searches private to the authenticated account with no friend-managed profiles or collaboration.
- [ ] Add a job pipeline board for saved, tailored, applied, interviewing, offered, and closed.
- [x] Add application notes, contacts, follow-up dates, and source attribution.
- [x] Add job-specific outreach drafts and a user-approved email handoff.
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

- [x] Add revocable hash-only account keys and a versioned least-privilege agent bridge for context, listings, structured jobs, tailored copies, and PDFs.
- [ ] Introduce the Codex Agent SDK orchestration layer after the deterministic services are stable.
- [ ] Separate planner, executor, reviewer, and policy-check roles with explicit contracts.
- [ ] Add resumable workflow state and step-level idempotency.
- [ ] Build a career-data MCP server with least-privilege tools.
- [x] Add dry-run and approval gates for external side effects.
- [x] Persist versioned research and writing artifacts plus frozen, expiring, single-claim email and application action requests.
- [ ] Add trace replay for failed or low-scoring agent runs.
- [ ] Add prompt and tool contract tests to CI.

## P3: Production And Business Readiness

- [ ] Define data retention, account deletion, and user data export policies.
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
