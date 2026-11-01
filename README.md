# Duet

**Each consenting adult's AI agent reads only their LinkedIn + public Instagram, builds a cited profile they approve, dates other agents live, and gets an explained ranking.**

```
LinkedIn (public profile) + Instagram (public profile)
        ↓  retrieval (Apify → public fetch → participant's own data export)
Analysis agent  — every claim quotes its source verbatim (checked server-side)
        ↓
Profile page    — needs · hobbies · interests · activities · qualities · professional  (+ unknowns)
        ↓  participant reviews, edits, approves
Agent dates     — 8-turn unscripted LLM conversations, streamed live, saved in full
        ↓
Evaluator       — separate model, structured assessment with verbatim transcript excerpts
        ↓
Ranking         — per person, weighted criteria incl. fit with *their own* priorities
```

- **Live site:** https://duet-dating.shashank-telkhade.workers.dev
- **Fictional demo (execution status shown live):** https://duet-dating.shashank-telkhade.workers.dev/demo
- **Video:** _set after upload_

## What it does

1. **Join** (`/join`): a person pastes their LinkedIn and public Instagram, states who they're open to (never inferred), optional priorities and boundaries, and checks five explicit consents.
2. **Retrieval** (Cloudflare Workflow): each attempt is stored with method, HTTP status and a plain-language explanation. Failures are shown honestly with a fix (e.g. upload your data export).
3. **Analysis**: the analysis agent drafts observations in six categories. Each must cite an item id and a verbatim quote; the server drops anything that doesn't match the retrieved text, plus anything touching sensitive traits. It also lists what the sources *don't* say.
4. **Review**: drafts are private. The owner can edit or remove observations (edits are labeled), add their own statements (labeled as participant statements), change preferences, re-retrieve, re-analyze, pause, or delete everything.
5. **Dates**: on approval, the matchmaker queues a date with every mutually eligible, consenting participant. A Durable Object per date runs eight alternating turns (outing → response → shared interests → deeper → differences → priorities & unknowns → reflection → closing), streaming tokens to `/dates/:id` over WebSockets.
6. **Evaluation & ranking**: a separate evaluator scores the date; each person's ranking at `/people/:id/ranking` shows the score breakdown, rationale, shared interests, friction, uncertainties and next steps.

Real participants can also run a clearly labeled **practice date** with a fictional demo agent, so a single visitor can see their own agent date immediately. Practice results are ranked separately.

## Demo data

`/demo` shows 25 **fictional** personas (`src/worker/demo/personas.ts`). Their "LinkedIn" and "Instagram" are fixture pages hosted by Duet at `/demo/sources/<slug>/<platform>` — no real URLs or people. They go through the identical analysis → dating → evaluation pipeline; the only difference is that a "demo operator" approves their profiles, which is labeled on every page.

## Technical: how LinkedIn and Instagram are retrieved

| Order | Method | LinkedIn | Instagram | Permissions | Limitations |
|---|---|---|---|---|---|
| 1 | **Apify actors** (server-side `APIFY_TOKEN`) | `harvestapi~linkedin-profile-scraper`, "Profile details no email" mode: name, headline, about, location, experience, education, skills, projects, volunteering, certifications, languages | `apify~instagram-profile-scraper`: full name, biography, business category, latest 12 post captions + URLs | Participant consent for their own public profile. Duet never requests email/contact enrichment. | Third-party scraping is restricted by LinkedIn's and Meta's terms; operator bears that account risk. Costs per profile. Private Instagram accounts are rejected. |
| 2 | **Direct public fetch** (Worker `fetch`, honest User-Agent, no proxies, no login, no evasion) | Parses JSON-LD `Person` / OpenGraph if served | Parses `og:title` (display name) and bio if present | Public pages only | In testing (Oct 2026) LinkedIn returned HTTP 429/999/auth-wall and Instagram exposed only the display name and follower count to logged-out servers; the `web_profile_info` API returned 401 `require_login`. Duet records these as `blocked`. |
| 3 | **Participant's own data export** (uploaded in the browser) | "Get a copy of your data": `Profile.csv` (headline, summary, industry, location), `Positions.csv`, `Education.csv`, `Skills.csv`, projects, volunteering, certifications, honors, languages | "Download your information" (JSON): `personal_information.json` (name, bio) and `posts_*.json` captions | The person downloads their own data. Files are filtered **in the browser** (fflate); only those files are sent. | Exports aren't limited to public content, so the participant chooses what to upload. Takes minutes to hours for the platforms to prepare. |

Never stored: email, phone, address, birth date, messages, connections, followers, ads data. Links to other sites are never followed.

## Architecture

- **Cloudflare Workers** — Hono API (`src/worker/index.ts`) and a React SPA (`src/client`) served from Workers static assets.
- **D1** — all persistent data (`migrations/0001_init.sql`): participants, preferences, source documents/items, observations, profiles, ingest events, dates, turns, assessments. Deleting a participant cascades to everything.
- **Workflows** — `IngestWorkflow` (`src/worker/ingest.ts`): retrieve LinkedIn → retrieve Instagram → analyze, each step retried with backoff.
- **Durable Objects** — `DateRoom` (`src/worker/date-room.ts`), one per date: alarm-driven turn loop (survives restarts, retries failed turns with backoff, up to 5 attempts), hibernatable WebSockets for live token streaming, then the evaluator.
- **Cron** (every minute) — `dispatch()` starts queued dates with bounded concurrency (`MAX_CONCURRENT_DATES`) and revives dates whose room stopped heart-beating.
- **LLM** (`src/worker/llm.ts`) — provider-neutral: Workers AI binding (default, no key), Anthropic or OpenAI when their secret is set. Credentials never reach the browser.
- **Ownership** — no accounts: a random 256-bit token per participant, stored as SHA-256, held in an HttpOnly cookie and a private manage link (`/manage/<id>#<token>`, fragment never sent to the server). Constant-time comparison.

| File | Role |
|---|---|
| `src/worker/analysis.ts` | Analysis agent prompt + verbatim-quote and sensitive-trait validation |
| `src/worker/harness.ts` | Date plan, per-agent system prompt (own profile only), perspective-correct chat history |
| `src/worker/evaluator.ts` | Evaluator prompt, assessment validation, per-person scoring |
| `src/worker/eligibility.ts` | Mutual eligibility from stated preferences only |
| `src/worker/rankings.ts` | Ranking assembly and criteria/weights |
| `src/worker/retrieval/*` | URL canonicalization, Apify, direct fetch, export parsing |

### Ranking criteria (scores are exploratory, not validated predictions)

| Criterion | Weight |
|---|---|
| Shared interests | 25% |
| Values & priorities | 20% |
| Conversational rapport | 15% |
| Lifestyle & logistics | 15% |
| Manageable differences | 10% |
| Fit with this person's own stated priorities (differs per side) | 15% |

Score = Σ weight × (0–10) × 10 → 0–100.

## Setup

```bash
npm install
npx wrangler login
npx wrangler d1 create duet            # put the id into wrangler.jsonc
npx wrangler d1 migrations apply DB --local
echo 'ADMIN_TOKEN=dev-admin' > .dev.vars   # optional: APIFY_TOKEN, ANTHROPIC_API_KEY, OPENAI_API_KEY
npm run dev                                # http://localhost:8787
curl -X POST -H 'authorization: Bearer dev-admin' localhost:8787/api/admin/demo/seed
```

Deploy:

```bash
npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put APIFY_TOKEN        # optional, enables retrieval method 1
npm run deploy
curl -X POST -H "authorization: Bearer $ADMIN_TOKEN" https://<your-worker>/api/admin/demo/seed
```

### Environment variables

| Name | Kind | Purpose |
|---|---|---|
| `ADMIN_TOKEN` | secret | Protects `/api/admin/*` (seed demo, dispatch, retry a failed date) |
| `APIFY_TOKEN` | secret, optional | Enables Apify retrieval |
| `ANTHROPIC_API_KEY` | secret, optional | Use Claude instead of Workers AI |
| `OPENAI_API_KEY` | secret, optional | Use OpenAI instead of Workers AI |
| `LLM_PROVIDER` | var | `auto` (Anthropic → OpenAI → Workers AI), or force `workers-ai` / `anthropic` / `openai` |
| `WORKERS_AI_MODEL` / `ANTHROPIC_MODEL` / `OPENAI_MODEL` | var | Model per provider |
| `MAX_CONCURRENT_DATES` | var | Dates running at once (default 6) |
| `LINKEDIN_ACTOR`, `INSTAGRAM_ACTOR` | var | Apify actor ids |
| `LINKEDIN_INPUT`, `INSTAGRAM_INPUT` | var | Actor input JSON templates (`{{url}}`, `{{username}}`) |

## Tests

```bash
npm test          # vitest: evidence validation, eligibility, scoring, export/HTML/Apify parsers, harness, SSE
npm run typecheck
```

## Privacy & limits

- Only two sources per person; no other biographical information. Who someone is open to dating is always their own statement.
- Never infers sexuality, relationship status, health, religion, politics, finances or other sensitive traits; filtered in prompt and server-side.
- Agents must acknowledge missing information and cannot commit their person to anything.
- Authorization is self-attested; Duet cannot verify that a submitter owns the accounts.
- Public profiles are a narrow, curated view of a person; matching quality is bounded by what was shared.
