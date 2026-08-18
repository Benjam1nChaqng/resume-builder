# Private Job Agent Bridge

The agent bridge lets an account-scoped Codex workflow use the resume builder as
its private system of record. Raw access keys are shown once and are never stored
by the app. The database stores only a SHA-256 hash and a short display prefix.

## Setup

1. Sign in and open `/settings/agent-access`.
2. Create a key and place it in the local, gitignored `.env.local` file.
3. Set the deployed app URL as the API base URL.

```dotenv
AGENT_API_BASE_URL=https://your-resume-builder.example
AGENT_API_TOKEN=rb_agent_replace_with_the_generated_value
```

The local client loads `.env.local` without echoing the key:

```powershell
pnpm agent context artifacts/agent-context.json
pnpm agent save-resume artifacts/resume.json
pnpm agent ingest-listings artifacts/listings.json
pnpm agent save-job artifacts/job.json
pnpm agent tailor artifacts/tailoring.json
pnpm agent create-artifact artifacts/research.json
pnpm agent request-action artifacts/application-request.json
pnpm agent claim-action ACTION_REQUEST_ID
pnpm agent complete-action ACTION_REQUEST_ID
pnpm agent fail-action ACTION_REQUEST_ID artifacts/action-failure.json
pnpm agent download-pdf RESUME_ID
```

## API

Every route requires `Authorization: Bearer <agent-key>`.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/agent/v1/context` | Owned resumes, search profiles, queue, and listings |
| `POST` | `/api/agent/v1/listings` | Canonicalize, filter, rank, deduplicate, and store listings |
| `POST` | `/api/agent/v1/jobs` | Save a verified structured job without an app-side LLM call |
| `POST` | `/api/agent/v1/tailored-resumes` | Create an owned job-specific resume copy from accepted bullet changes |
| `POST` | `/api/agent/v1/application-artifacts` | Store versioned research, writing, answers, or interview preparation |
| `POST` | `/api/agent/v1/action-requests` | Freeze an exact email or application submission for owner review |
| `POST` | `/api/agent/v1/action-requests/:id/claim` | Atomically claim an unexpired owner-approved action |
| `POST` | `/api/agent/v1/action-requests/:id/complete` | Record a claimed external action as completed |
| `POST` | `/api/agent/v1/action-requests/:id/fail` | Record a claimed external action as failed with a safe summary |
| `GET` | `/api/agent/v1/resumes/:id/pdf` | Download an owned ATS PDF |

Claims are bound to the agent key that made the claim. The same key must call
`complete` or `fail`; another active key for the owner cannot take over the
claimed action. Approvals expire after 30 minutes and can only be granted from
the signed-in owner UI.

### Listing Batch

```json
{
  "profileId": "profile-id-from-context",
  "listings": [
    {
      "url": "https://company.example/jobs/123",
      "title": "Help Desk Technician",
      "company": "Example Company",
      "location": "Hayward, CA",
      "employmentType": "Full time",
      "compensationText": "$28 to $34 per hour",
      "postedAt": "2026-08-17T16:00:00.000Z",
      "matchScore": 92
    }
  ]
}
```

### Structured Job

```json
{
  "listingId": "optional-listing-id",
  "sourceUrl": "https://company.example/jobs/123",
  "title": "Help Desk Technician",
  "company": "Example Company",
  "location": "Hayward, CA",
  "description": "Verified job description text",
  "requirements": ["Microsoft 365 support"],
  "niceToHaves": ["MSP experience"],
  "seniority": "Entry level",
  "salaryMin": 58000,
  "salaryMax": 70000,
  "researchNotes": "Source-backed notes and application questions."
}
```

### Tailored Resume

```json
{
  "jobId": "job-id-from-save-job",
  "resumeId": "base-resume-id-from-context",
  "changes": [
    {
      "experienceId": "owned-experience-id",
      "bulletId": "owned-bullet-id",
      "text": "Truthful, job-relevant rewrite grounded in the original bullet."
    }
  ]
}
```

The bridge does not provide email sending or application submission endpoints.
It can prepare exact action requests, but it cannot approve them. Only the signed-in
owner can approve or reject a request. Approval expires after 30 minutes, and an
executor must claim it exactly once before using a browser or connected email tool.

### Saved Artifact

```json
{
  "jobId": "owned-job-id",
  "kind": "research",
  "title": "Company and role research",
  "content": "Source-backed findings and truthful resume guidance.",
  "sourceUrls": ["https://company.example/jobs/123"],
  "metadata": { "researchVersion": 1 },
  "idempotencyKey": "research:job-id:2026-08-18"
}
```

### Application Approval Request

```json
{
  "jobId": "owned-job-id",
  "action": "submit_application",
  "summary": "Submit the reviewed application to Example Company",
  "idempotencyKey": "submit:job-id:resume-id:v1",
  "payload": {
    "applicationUrl": "https://company.example/jobs/123/apply",
    "resumeId": "owned-tailored-resume-id",
    "answerSummary": [
      {
        "question": "Why are you interested in this role?",
        "answer": "The exact reviewed answer that will be submitted."
      }
    ]
  }
}
```
