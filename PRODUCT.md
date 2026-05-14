# Resume Builder — Product Spec v0.1

## Vision
An agentic resume builder. Not a form with GPT calls — a system that imports a user's existing career data, lets them paste a job URL, and produces a tailored resume scored by rubric-based LLM-as-judge critique. "Cursor for your job search."

## v0.1 User Journey (Phase 2 deliverable)
1. User signs up (already built — Better Auth)
2. User lands on /dashboard, sees "No resume yet — import one"
3. User clicks "Import resume" → modal with PDF upload OR plain text paste
4. On submit, Claude extracts structured data (Opus 4.7 with vision for PDFs, Sonnet 4.6 for text)
5. User is redirected to /resume/[id] showing their parsed resume
6. User can edit any field inline. Field edits save on blur (no debounced autosave in v0.1 — keeps the UX state machine simple).
7. User can create additional resumes (different versions)

Out of scope for v0.1: AI tailoring, JD scraping, rubric critique, ATS scoring, MCP server, browser auto-apply, voice intake, multi-user collaboration.

## Roadmap
- v0.1 (Phase 2 — now): Import + view + edit
- v0.2 (Phase 3): JD scraping + bullet tailoring agent
- v0.3 (Phase 4): 3-subagent rubric critique loop (Recruiter/ATS/HiringManager) + score display
- v0.4: ATS compatibility scoring + export to PDF
- v0.5: career-data MCP server (THE portfolio differentiator)
- v0.6: Browser auto-apply via Claude computer use
- v1.0: Public launch on Product Hunt + Hacker News

## Data Model (high-level — Drizzle implementation in Chunk 2)

### v0.1 tables
- user (from Better Auth — already exists)
- resume: id, userId, title, isDefault, sourcePdfUrl (nullable — set when import path was PDF upload), createdAt, updatedAt
- contact_info: resumeId, fullName, email, phone, location, links (jsonb)
- experience: id, resumeId, company, role, location, startDate, endDate, current, sortOrder
- bullet: id, experienceId, text, sortOrder, originalText (for tracking edits)
- education: id, resumeId, school, degree, field, startDate, endDate, gpa, sortOrder
- skill: id, resumeId, category, name, sortOrder
- project: id, resumeId, name, description, link, sortOrder

### v0.2 schema additions (created later — not in the v0.1 migration)
- job: id, userId, sourceUrl, title, company, description, requirements (jsonb), scrapedAt
- application: id, userId, jobId, resumeId, status, appliedAt

### Conventions
- **Primary keys:** all IDs are `text` (nanoid-generated). `user.id` is text from Better Auth — every other table follows the same convention so foreign keys match without casting. No UUIDs.
- **Timestamps:** Postgres `TIMESTAMP WITH TIME ZONE` everywhere. In Drizzle that's `timestamp({ withTimezone: true })` — `timestamp()` alone defaults to *without* time zone.

## Agent Architecture (high-level)
- ResumeImporter agent (Chunk 3): takes PDF or text → returns structured resume JSON matching the data model. Uses Opus 4.7 with vision for PDFs, Sonnet 4.6 for text. Validates output with Zod.
- JDScraperAgent (v0.2): URL → structured JobDescription
- BulletTailorer (v0.2): (Experience + JD) → tailored bullets
- RubricCritic (v0.3): 3 parallel subagents (Recruiter, ATS, HiringManager) → 5-dim scored critique

## Tech principles
- Server Components by default. Client only for interactivity.
- Server Actions for all mutations. No tRPC, no REST.
- All AI calls go through src/lib/ai/anthropic.ts (Helicone-proxied).
- All AI outputs validated via Zod before persisting.
- TDD: every server action and agent has a test before it's considered done.
- Uploaded PDFs are stored in **Vercel Blob**. The blob URL is persisted on `resume.sourcePdfUrl` so the raw PDF can be re-parsed without re-asking the user, and so we can show provenance ("imported from X.pdf").

## Owner
GitHub: Benjam1nChaqng
Live URL: https://resume-builder-benjaminchang918-7029s-projects.vercel.app
