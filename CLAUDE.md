# resume-builder

## Mission
An AI-powered, agentic resume builder. Not just a form with GPT calls — a system that scrapes job descriptions, scores resumes via rubric-based LLM-as-judge ensembles, and tailors resumes per listing. Think "Cursor for your job search."

This project serves three purposes:
1. A real SaaS product
2. A portfolio showpiece for AI Trainer / agentic dev roles
3. The owner's personal job-search tool

## Tech stack (locked unless I explicitly approve a change)
- Next.js 15+ (App Router, React 19, Server Components, Server Actions)
- TypeScript (strict mode)
- Tailwind CSS v4
- shadcn/ui for components
- Better Auth for authentication
- Neon (Postgres + pgvector) for database
- Drizzle ORM
- Claude Agent SDK (TypeScript) for the agentic backbone
- Anthropic SDK: Claude Opus 4.7 (planner/reviewer) + Sonnet 4.6 (executor)
- MCP servers (TypeScript SDK) for custom integrations
- Vercel for deployment, Cloudflare Workers for MCP servers
- Helicone proxy for LLM observability
- Braintrust for evals

## Conventions
- Server Components by default. Only use 'use client' when interactivity, hooks, or browser APIs require it.
- UI: shadcn primitives in components/ui/. App-specific components in components/.
- Server actions in app/actions/. DB queries in lib/db/.
- Env vars in .env.local (gitignored). Validated with t3-env.
- File names: kebab-case. Component names: PascalCase.
- Package manager: pnpm.

## Rules for you (Claude Code)
- ALWAYS run code after changes to verify it works. Don't just write and stop.
- ASK before installing dependencies not in the tech stack above.
- ASK before changing architectural decisions.
- TEST non-trivial logic. Use Vitest.
- COMMIT in logical units with clear messages.
- NEVER commit secrets or API keys.
- After every meaningful change, add a one-line entry to CHANGELOG.md with the date.

## Current phase
Day 1 — initial scaffolding. No business logic, no database, no AI yet. Goal: Next.js running locally, pushed to GitHub.

## Owner
GitHub: Benjam1nChaqng
