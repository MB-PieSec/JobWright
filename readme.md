# Jobwright


A self-hosted, open-source CLI tool that parses your resume, matches it against job postings across multiple platforms, and auto-applies to the ones that fit — built for developers who want a real, ownable alternative to manually scrolling job boards.

**Status: V4 — two job platforms (Jobinja, Jobvision), hard filters, auto-apply, SQLite application tracking, expired-posting detection, error-retry, and Telegram notifications.**

> **⚠️ Use at your own risk.** Jobwright automates scraping and submitting real applications on Jobinja and Jobvision — actions that may fall outside those sites' terms of service. During development and testing, no account used with this tool has been suspended or banned, but that's a small sample over a short period, not a guarantee. This is exactly why Jobwright is self-hosted rather than a shared service: you run it with your own credentials, against your own account, and you carry that risk yourself rather than it being pooled across a userbase. If you're not comfortable with the possibility of your account being flagged, limited, or banned, don't run this against an account you can't afford to lose. Use `--live-apply` deliberately, and consider starting with a small `--max-pages`/dry-run pass before trusting it with a real batch.

## What Jobwright does so far

1. Reads a resume from a local Markdown (`.md`) file
2. Sends it to an LLM (via OpenRouter) to extract structured data — name, skills, work history, city/province, and standalone projects
3. Computes total years of experience and a seniority level from that work history in code (not by the LLM — see note below)
4. Validates the result against a strict schema and saves it to `profile.json`
5. Searches your chosen platform (`--platform`, `jobinja` or `jobvision`) for postings matching a configurable keyword (`--keyword`, default `backend`), paging through up to `--max-pages` pages of results using a headless browser
6. Visits each matching posting and extracts its full description and metadata (location, work type, required experience, etc.)
7. **Applies hard filters before scoring:** an opt-in experience filter and an always-on location filter (see Hard Filters below) — jobs that fail a filter are recorded and skipped, saving an LLM call
8. Scores each remaining job posting against your resume using an LLM, producing a 0–100 match score, a count of requirements met vs. total, a list of missing requirements, and a short reasoning summary
9. Records every job the run encounters — filtered, scored, or skipped — to a local SQLite database (`jobwright.db`)
10. A separate `apply.ts` entry point reads jobs that scored above threshold straight from the database — across **all** platforms in one run, resolving the correct adapter per job — and submits real applications, recording the outcome (`applied`, `already_applied`, `expired`, or `error`) back to the same database row
11. **New in V4:** an optional per-run summary is sent to Telegram after a live apply run (see Notifications below)

Application outcome tracking beyond apply/already-applied/expired/error (interview stages, responses, rejections) is not implemented yet.

## Platforms

Jobwright's adapter pattern (`JobPlatform` interface) means every platform implements the same contract — `buildSearchQuery`, `search`, `getJobDetails`, `apply` — but real sites don't always support the same *capabilities*. Right now the two platforms are not at parity:

| | Jobinja | Jobvision |
|---|---|---|
| Search, pagination, scoring | ✅ | ✅ |
| Hard filters (location) | ✅ | ✅ (remote detection via `.feature-tag` chips) |
| Hard filters (experience) | ✅ | ❌ — no reliable labeled field; Jobvision jobs skip this filter and fail open |
| Expired-posting detection | ✅ | ❌ — no confirmed example found yet; an expired Jobvision posting currently reports `alreadyApplied` (false positive) rather than `expired` |
| Live apply (`--live-apply`) | ✅ | ❌ — see below |

**Jobvision's apply step doesn't work yet.** Jobvision authenticates via a short-lived OIDC bearer token (24-hour expiry, issued by `account.jobvision.ir`) stored in `localStorage`, not cookies — unlike Jobinja, which uses standard long-lived session cookies. There's no `refresh_token` available to renew it automatically, and the OIDC flow has too many real-world login variants (password, OAuth, OTP) to justify automating login itself. Search, scoring, and filtering all work fully unauthenticated. Applying on Jobvision currently requires manually opening the scored job's URL and applying yourself; `apply.ts` will surface a clear `error` for any Jobvision job it can't authenticate for rather than silently failing.

## How it talks to the LLM

Jobwright never lets the LLM touch a browser or make decisions about *what* to do — it's only ever asked to read text and return structured data. Everything else (scraping, filtering, applying, orchestration) is deterministic code.

```mermaid
flowchart TD
    A[Resume .md file] -->|read| B(resume/parser.ts)
    B -->|"prompt: extract structured data"| C[llm/client.ts]
    C -->|HTTP request| D[(OpenRouter API)]
    D -->|raw text response| C
    C -->|raw text| B
    B -->|validate: ResumeProfileSchema| E[profile.json]

    F[Jobinja / Jobvision] -->|scrape via Puppeteer| G(platforms/*/adapter.ts)
    G -->|JobPosting list| H(cli/index.ts)

    H -->|"info fields"| K(filters/experience.ts + filters/location.ts)
    K -->|pass/fail| H

    E -->|ResumeProfile| I(scoring/scorer.ts)
    H -->|"job description"| I
    I -->|"prompt: score match"| C
    C -->|raw text| I
    I -->|validate: JobScoreSchema| H
    H -->|upsertJob| L[(jobwright.db)]

    L -->|eligible jobs, any platform| M(cli/apply.ts)
    M -->|resolve adapter per row| G
    M -->|submit application| G
    G -->|ApplyResult| M
    M -->|upsertJob| L
    M -->|per-run summary| N[Telegram]

    style C fill:#f9f0ff,stroke:#8b5cf6
    style D fill:#eef2ff,stroke:#6366f1
    style L fill:#f0fdf4,stroke:#22c55e
    style N fill:#eff6ff,stroke:#3b82f6
```

`llm/client.ts` is a thin, generic wrapper — it knows nothing about resumes or job postings. It takes a finished prompt string and returns whatever text OpenRouter sends back. `resume/parser.ts` and `scoring/scorer.ts` each build their own prompt and are responsible for validating the response against their own schema. The LLM's role is strictly "read this text, extract/judge this specific thing" — never "decide what to do next." Filtering and applying are both fully deterministic — no LLM involvement.

## Hard filters

Applied after scraping, before scoring, so a filtered-out job never costs an LLM call.

**Experience filter** — opt-in via `--experience-tolerance`, Jobinja only (see Platforms above). With no flag, every job reaches scoring regardless of experience gap. When passed, compares the candidate's `totalYearsExperience` against the job's minimum-experience field with a tolerance buffer (default 1 year). Unparseable experience text always fails open — scoring is the real quality gate, so ambiguous text shouldn't cost a good-fit opportunity. This is deliberately fail-open by default: a strict skip on experience alone would contradict the principle that tech-stack match matters more than years of experience, which the LLM scorer already weighs.

**Location filter** — always active, no opt-in needed, works on both platforms. Defaults to permissive province-level matching; `--hard-match` tightens it to exact city-level matching. Remote-tagged jobs always pass regardless of candidate location — on Jobinja this comes from the `نوع همکاری` field, on Jobvision from `.feature-tag` chips (there can be more than one; only the remote-indicating tag matters). Any case where location can't be determined (missing candidate location, missing job field) fails open.

**`--skip-filters`** — bypasses both filters for a single run. Originally added as a debug-only convenience to unblock testing `apply.ts` against a larger job set; kept permanently rather than removed.

## Auto-apply

`cli/apply.ts` is a separate entry point from `cli/index.ts`, run manually after one or more scoring passes. It queries the database for jobs with `status = 'scored'` at or above `--min-score`, **across every platform present in the database in one run** — for each eligible job it resolves the correct adapter from the row's own `platform` column, rather than requiring you to specify which platform to apply on. It either logs what it *would* apply to (default, dry run) or submits real applications when `--live-apply` is passed. Every attempt — success, already-applied, expired, or error — is written back to the same database row, so a second run naturally skips anything already handled; there's no separate "check if already applied" step. A failure on one job (network error, adapter crash, unknown platform) is recorded as `error` and the run continues with the next job rather than aborting the whole batch. `--max-applies` caps the number of applications in a single run.

**`--retry-errors`** — by default, a row that ends in `status = 'error'` is never retried automatically (an `expired` posting never should be retried, but a transient network error might be worth another attempt). Passing this flag additionally includes `error` rows in the eligible set for that run, alongside `scored` ones. `expired` rows are never included, retry flag or not.

## Notifications

After a **live** (`--live-apply`) run finishes, `apply.ts` sends a one-message summary — counts of applied / already-applied / expired / errored, plus run duration — to any configured notification channel. Dry runs never notify.

Channels implement a small `NotificationChannel` interface (`notifications/types.ts`) so adding a new one (SMS, email, Discord) means writing one class and registering it — no changes needed in `apply.ts` itself:

- `notifications/telegram.ts` — the only channel implemented so far. Posts to a Telegram chat via the Bot API.
- `notifications/registry.ts` — builds the active channel list from whichever channels have their required env vars set; channels with missing config are simply skipped.
- `notifications/notifyAll.ts` — sends to every active channel via `Promise.allSettled`; a failure in one channel (or all of them) is logged and never blocks or fails the apply run itself — notifications are deliberately decoupled from the real work.

**Telegram setup:** create a bot via [@BotFather](https://t.me/BotFather), get its token, message the bot once (or add it to a channel as admin), then call `https://api.telegram.org/bot<token>/getUpdates` to read back the `chat.id` to notify. Add both to `.env`:

```
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
```

If both are unset, Telegram notifications are simply not sent — no error, no crash.

## Application tracking (SQLite)

Every job a run touches — filtered out, scored below threshold, scored and eligible, applied to, expired, or errored — is recorded as one row in a local `jobwright.db` SQLite file, keyed by URL.

- `src/db/client.ts` opens the database file and creates the `jobs` table if it doesn't exist (WAL mode enabled, for safety if a future daemon/dashboard mode ever reads while a run is writing).
- `src/db/upsertJob.ts` exposes a single `upsertJob()` function — insert-or-update by URL — called from every filter/scoring point in `index.ts` and every apply outcome in `apply.ts`.
- `src/db/getEligibleJobs.ts` — `getEligibleJobs(minScore, retryErrors)` returns eligible rows (including their `platform`) across all platforms in one query.
- Each row's `status` is one of: `filtered_experience`, `filtered_location`, `scored`, `scored_low`, `applied`, `already_applied`, `expired`, `error`.
- `src/utils/mapApplyResultToStatus.ts` translates the platform adapter's `ApplyResult["status"]` into the database's `status` values — written with no `default` case in its `switch`, so TypeScript raises a compile error if `ApplyResult` ever grows a new variant without updating the mapping (this caught the `expired` addition automatically).
- A row's `status` reflects only its most recent event — there's no history log of a job passing through multiple states over multiple runs, by design, to keep the schema simple until a real need for history shows up.
- `src/db/check.js` / `src/db/reset.js` — small dev-utility scripts (plain Node, ES modules) for inspecting and manually resetting job statuses during development. Not part of the shipped pipeline, but kept in the repo since this is open source and other contributors may find them useful for their own debugging.

## Requirements

- Node.js (v22+ recommended)
- An [OpenRouter](https://openrouter.ai) API key

## Setup

```bash
git clone https://github.com/MB-PieSec/jobwright.git
cd jobwright
npm install
```

Create a `.env` file in the project root (or copy `.env.example`):

```bash
cp .env.example .env
```

```
openRouterAPIKEY=your_key_here

# Optional
OPENROUTER_MODEL=openai/gpt-4o-mini
JOBWRIGHT_COOKIES_PATH=./cookies.json
JOBWRIGHT_DB_PATH=./jobwright.db
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
```

Only `openRouterAPIKEY` is required. `TELEGRAM_*` is optional — omit it to run without notifications. `OPENROUTER_MODEL` defaults to `openai/gpt-4o-mini`.

`jobwright.db` (plus its `-wal`/`-shm` companion files) is created automatically on first run and is already gitignored.

**Cookies:** `cookies.json` in the project root holds session cookies Puppeteer loads before every run. Jobinja's login is cookie-based, so exporting your logged-in Jobinja session cookies into this file (as a flat array of Puppeteer-format cookie objects) is enough for `apply()` to work there. Cookies for multiple sites can coexist in the same file — each cookie object carries its own `domain`, so Puppeteer applies them correctly regardless of how many domains are mixed into the array. Jobvision does **not** use cookies for auth (see Platforms above), so this file alone isn't enough to authenticate there.

> **These cookies are live credentials.** `cookies.json` is gitignored on purpose — never commit it, and never paste its contents into an issue or chat. If it ever lands in git (or gets shared), log out of the affected account to invalidate the session, then rotate the file. Set `JOBWRIGHT_COOKIES_PATH` if you want to keep it somewhere outside the repo. Upgrading from an older version? Move `src/config/cookies.json` to `./cookies.json` — that path is no longer read.

## Usage

```bash
npm start
```

On first run, you'll be prompted for the path to your resume (Markdown only for now). The parsed, validated profile is saved to `profile.json` — on subsequent runs this step is skipped if `profile.json` already exists, and the existing profile is loaded and re-validated instead.

The tool then opens a browser, searches your chosen platform (`--platform`, default `jobinja`) for the configured keyword (`--keyword`, default `backend`), fetching up to `--max-pages` pages of results (default `3`) — the console log tells you the total number of matching jobs found and how many pages you're covering, so you know if you're leaving results on the table. It then filters, scores each matching job against your resume, and records every job to `jobwright.db`.

To search Jobvision instead (or in addition — run both, they land in the same database):

```bash
npx tsx src/cli/index.ts --platform=jobvision
```

To apply to eligible jobs across whichever platforms you've scraped:

```bash
npx tsx src/cli/apply.ts --live-apply
```

Omit `--live-apply` to dry-run and see what would be applied to without submitting anything. `apply.ts` does not take a `--platform` flag — it resolves the right adapter per job automatically.

### CLI flags

All flags accept `--flag=value` or `--flag value` form unless noted otherwise.

| Flag | Default | Used by | Description |
|---|---|---|---|
| `--platform` | `jobinja` | `index.ts` | Which platform to search — `jobinja` or `jobvision`. Validated against the platform registry; an unknown value exits with a clear error rather than crashing later |
| `--reasoning-length` | `200` | `index.ts` | Target character length for each job's scoring reasoning |
| `--min-score` | `70` | `index.ts`, `apply.ts` | Score threshold — in `index.ts`, jobs below this are logged as "Ignored"; in `apply.ts`, only jobs at or above this are eligible to apply to |
| `--keyword` | `backend` | `index.ts` | Search keyword sent to the chosen platform. Only a single keyword is supported per run (see Known Limitations) |
| `--max-pages` | `3` | `index.ts` | Maximum number of search-result pages to scrape. If the site reports more results than this covers, a console log tells you how many pages/jobs you're missing |
| `--experience-tolerance` | off (flag absent = no filtering) | `index.ts` | Opt-in experience filter, Jobinja only. Presence alone enables it; a value (e.g. `--experience-tolerance=1`) sets the tolerance buffer in years (default `1` if no value given) |
| `--hard-match` | off (boolean) | `index.ts` | Tightens the location filter from province-level to exact city-level matching |
| `--skip-filters` | off (boolean) | `index.ts` | Bypasses both the experience and location filters for the run |
| `--live-apply` | off (boolean) | `apply.ts` | Submits real applications. Without it, `apply.ts` only logs what it would apply to |
| `--retry-errors` | off (boolean) | `apply.ts` | Also retries jobs currently at `status = 'error'`, alongside normal `scored` jobs. Never retries `expired` jobs |
| `--max-applies` | `0` (no cap) | `apply.ts` | Cap how many jobs a single run will apply to, e.g. `--max-applies=10`. Cheap insurance for an irreversible action |

## Resume format

Only **Markdown** resumes are supported. PDF and DOCX are not implemented yet. Structure your resume with clear section headers (e.g. `## Experience`, `## Skills`, `## Projects`) — this measurably improves extraction accuracy, since the LLM uses your headers as structural signal. A dedicated `## Projects` section is recommended: entries there are captured separately from work history (see Changelog) and don't need duration information the way work history does.

## Model recommendations

Scoring quality depends heavily on the model you configure in `llm/client.ts`. This isn't a hypothetical — testing surfaced a real difference:

- **`meta-llama/llama-3.1-8b-instruct`** (small, cheap): unreliable. It correctly identified missing requirements in its own reasoning text but frequently ignored that reasoning when picking a score — e.g. scoring a Go-only posting 85/100 for a candidate with zero Go experience.
- **`openai/gpt-4o-mini`**: markedly better. Correctly scored a stack-mismatched .NET posting as 0/100, and after a prompt revision (see V2 changelog), scores now track consistently with the `requirementsMet` / `requirementsTotal` counts returned alongside them (e.g. 3/12 → 25, 6/10 → 60).

**Recommendation:** use a model at least as capable as `gpt-4o-mini` for scoring. Smaller/cheaper models may silently produce unreliable scores — the JSON output will look valid, but the number itself may not reflect the reasoning next to it. Since this tool auto-applies autonomously with no human review step, this matters more than it would for a suggestion-only tool. Always spot-check a batch of results after changing models.

## Known limitations

- **`totalYearsExperience` is computed by summing `durationMonths` across all `workHistory` entries.** Standalone projects are captured separately (see Changelog) and intentionally don't count toward this total, even if resume-worthy.
- Extraction quality depends on the underlying LLM model. Smaller/cheaper models can occasionally misgroup or fragment work history entries — review `profile.json` after running to confirm it looks correct before relying on it downstream.
- Scoring quality also depends on the underlying LLM model — see Model Recommendations above.
- No PDF/DOCX support yet.
- The search keyword is configurable (`--keyword`), but only a single keyword is supported per run — no multi-keyword search in one invocation. This is a deliberate constraint, not a gap: unioning results across multiple keyword searches would multiply LLM scoring calls (and cost) for jobs that may overlap across searches, and would need dedup logic that doesn't exist yet.
- **Jobvision has no experience-filter data.** There's no reliably labeled experience field on Jobvision postings (it appears, when present at all, as an unlabeled bullet mixed into free-text "key indicator" items) — Jobvision jobs currently skip the experience filter entirely (fail open) rather than a heuristic bullet-parser built on too few real examples.
- **Jobvision has no expired-posting detection.** No confirmed example of an expired Jobvision posting has been found yet to build a selector against. Until then, an expired Jobvision job will likely be misreported as `alreadyApplied` (a false positive) rather than `expired`, since detection there is based on the submit button's absence.
- **Jobvision live-apply doesn't work.** See Platforms above — Jobvision's auth is a 24-hour OIDC bearer token in `localStorage` with no available refresh token, and there's no automated way to keep it fresh without also automating login (which has too many real-world variants — password, OAuth, OTP — to be worth automating right now). Search, filtering, and scoring on Jobvision are fully functional and don't require auth.
- **Filtered-out jobs are recorded with a status but no detail beyond that status** — e.g. a `filtered_experience` row doesn't retain the raw experience string that caused the fail. Full audit detail may be added later if needed.
- **No status history.** Each job's database row reflects only its latest state — if a job's status changes across runs (e.g. re-scored after a flag change, or retried after an error), the previous state isn't retained, only `updated_at` changes.
- Scraping depends on each site's current DOM structure (`src/platforms/*/selectors.ts`). If either site changes its page layout, extraction may break until selectors are updated. This has already happened once within Jobvision's own markup — some postings wrap their description text differently (with or without a `dir`-attributed wrapper div) depending on the posting, not just by language, and the selector had to be widened to tolerate both shapes.
- **Network routing in sanctioned/restricted regions:** OpenRouter may be unreachable without a VPN/tunnel (returns `403 Forbidden` otherwise), while scraping either job site works best with a direct connection. This isn't solved at the application level — Jobwright makes no attempt to switch network paths mid-run. The practical fix is at your VPN/network layer: configure your VPN client or server to route domestic traffic direct while tunneling everything else, so both connections work transparently without the app needing to know the difference.
- No scoring result caching or fuzzy skill matching — scoring is a fresh LLM call per job every run.
- Only Telegram is implemented as a notification channel so far, and only a per-run summary (no per-job messages).
- Application outcome tracking beyond apply/already-applied/expired/error (interview stages, responses, rejections) is not implemented yet.

## Project structure

```
src/
├── cli/
│   ├── index.ts                  # entry point — orchestrates resume parsing, job search, filtering, and scoring
│   └── apply.ts                  # reads eligible jobs from jobwright.db across all platforms, applies, writes outcomes back, sends notifications
├── resume/
│   ├── schema.ts                   # ResumeProfile zod schema (includes city, province, projects)
│   └── parser.ts                   # resume text -> LLM extraction -> validated ResumeProfile
├── scoring/
│   ├── schema.ts                   # JobScore zod schema
│   └── scorer.ts                   # {resumeProfile, jobDescription} -> LLM -> validated JobScore
├── filters/
│   ├── experience.ts                # ExperienceRequirement tagged union, parseExperienceRange, meetsExperienceRequirement
│   └── location.ts                  # meetsLocationRequirement (boolean), uses normalizePersian
├── llm/
│   └── client.ts                    # generic OpenRouter API wrapper — prompt string in, raw text out
├── db/
│   ├── client.ts                    # opens jobwright.db (project root, overridable), creates jobs table if missing (WAL mode)
│   ├── upsertJob.ts                 # upsertJob() — insert-or-update a job row by URL
│   ├── getEligibleJobs.ts           # getEligibleJobs(minScore, retryErrors) — eligible jobs across all platforms
│   ├── check.js                     # dev utility — inspect job rows by status/platform
│   └── reset.js                     # dev utility — manually reset job rows back to 'scored'
├── platforms/
│   ├── types.ts                     # JobListing / JobPosting / JobPlatform contracts (apply/ApplyResult incl. "expired", buildSearchQuery)
│   ├── browser.ts                    # shared Puppeteer browser launcher, loads cookies.json from the project root
│   ├── registry.ts                   # platform name -> adapter lookup, PlatformName union type
│   ├── jobinja/
│   │   ├── adapter.ts                 # implements JobPlatform for Jobinja (buildSearchQuery, search, getJobDetails, apply incl. expired detection)
│   │   └── selectors.ts               # Jobinja CSS selectors, Persian-digit result-count parsing
│   └── jobvision/
│       ├── adapter.ts                 # implements JobPlatform for Jobvision (buildSearchQuery, search, getJobDetails incl. remote-tag folding, apply)
│       └── selectors.ts               # Jobvision CSS selectors, Arabic-Indic-digit result-count parsing
├── notifications/
│   ├── types.ts                     # NotificationChannel interface, ApplyRunSummary shape
│   ├── telegram.ts                  # Telegram Bot API notifier
│   ├── registry.ts                  # builds active channel list from configured env vars
│   └── notifyAll.ts                 # sends to all active channels via Promise.allSettled, never throws
└── utils/
    ├── getUserInput.ts
    ├── readFileContent.ts
    ├── fileExists.ts
    ├── cliFlags.ts                   # getNumericArg(flagName, defaultValue), hasFlag(flagName), getStringArg(flagName, defaultValue)
    ├── stripCodeFences.ts            # strips markdown code fences from LLM responses
    ├── normalizePersian.ts           # Persian character-variant + zero-width-char normalization
    ├── mapApplyResultToStatus.ts     # ApplyResult status -> database status mapping (no default case, forces exhaustive handling)
    ├── throttle.ts                   # shared inter-request delay, used by both index.ts and apply.ts
    └── terminalLink.ts               # OSC 8 clickable terminal hyperlinks for job URLs in console logs
└── __tests__/
    └── parser.test.ts
```

## Roadmap

- ~~V0 — resume parsing~~ done
- ~~V1 — first job platform adapter (Jobinja, read-only)~~ done
- ~~V2 — resume-to-job scoring engine~~ done
- ~~V3 — hard filters, auto-apply, SQLite application tracking~~ done
- ~~V3.5 — multi-page search, configurable search keyword, internal cleanup~~ done
- ~~V4 — second platform (Jobvision), expired-posting detection, error retry, Telegram notifications~~ done
- V5 — LinkedIn/Indeed support, richer outcome tracking, resolving Jobvision auth for live apply, daemon/scheduled mode

## Changelog

<details>
<summary>Click to expand full version history (V0–V4)</summary>

### V4
- **Added `JobvisionAdapter`**, proving the adapter pattern generalizes to a second real platform:
  - `buildSearchQuery` puts the keyword in the URL path (`/jobs/keyword/{keyword}`), unlike Jobinja's query-string filter param.
  - Result-count parsing uses **Arabic-Indic digits** (٠-٩, distinct Unicode range from Jobinja's Persian digits ۰-۹) — required its own digit-conversion function rather than reusing Jobinja's.
  - Remote status comes from zero or more standalone `.feature-tag` chips rather than a single labeled field — folded into a synthetic `نوع همکاری`-labeled entry so the existing location filter's substring check works unchanged across both platforms.
  - Description scraping needed two iterations: first for postings in English vs. Persian (`dir="ltr"` vs `dir="rtl"`), then for a structural inconsistency where some postings omit the `dir`-attributed wrapper entirely — the selector was widened to the outer container (`.jvt-flex-1.jvt-mr-2`) that's present in every posting seen, rather than depending on either inner wrapper shape.
  - `apply()` detection is presence/absence-based (`button.jvt-btn-send-resume` exists → not applied; a plain disabled-looking div with no distinct class → already applied), simpler than Jobinja's redirect-chasing since the submit button's `disablebuttoninajax` attribute suggests an in-place AJAX update rather than a page redirect.
  - No reliable labeled experience field exists on Jobvision (appears, if at all, as an unlabeled bullet mixed into free-text indicators) — Jobvision jobs skip the experience filter entirely (fails open).
- **Investigated Jobvision authentication** and confirmed it does not work with cookie-based session loading: Jobvision uses a short-lived (24-hour) OIDC bearer token issued by a separate identity server (`account.jobvision.ir`, IdentityServer/Duende-shaped endpoints), stored in `localStorage` under `CandidateClient_v2`, not in a cookie. No `refresh_token` is present in the stored auth object despite the token's scope including `offline_access`, ruling out simple self-renewal via the token endpoint. Decided against automating the login flow itself given the range of real-world login methods (password, OAuth, OTP) — live-apply on Jobvision is a documented limitation rather than solved in this version.
- Added `--platform` CLI flag (default `jobinja`) to `index.ts`, validated against the platform registry's actual keys with a clear error message and `process.exit(1)` on an unrecognized value, rather than an unchecked type cast that would fail confusingly later.
- **Reworked `apply.ts` to resolve the platform adapter per job row rather than once per run.** Originally `apply.ts` also took a hardcoded (later flagged) single `platformName` for its whole run — this silently misapplied the wrong adapter to jobs from the other platform once both existed in the database. Fixed by having `getEligibleJobs` select and return each row's own `platform` column, and resolving `platformRegistry[job.platform]` inside the loop per job. `apply.ts` no longer takes a `--platform` flag at all, since one run can now correctly handle eligible jobs from every platform present in the database.
- **Added `expired` as a first-class `ApplyResult`/DB status**, distinct from `error`. Discovered via a real Jobinja posting showing `"این آگهی منقضی شده است"` (this posting has expired) in a dedicated `.c-alert--error` element — previously this fell through to a generic, unhelpful `error` result. `JobinjaAdapter.apply()` now checks for this alert before checking for the submit button or applied indicator. `mapApplyResultToStatus`'s exhaustive `switch` (no `default` case) caught the missing case automatically at compile time when `ApplyResult` grew the new variant. Jobvision has no equivalent detection yet (see Known Limitations) — an expired Jobvision posting is currently misreported as `alreadyApplied`.
- Added `--retry-errors` flag to `apply.ts`: widens `getEligibleJobs`'s query to include `status = 'error'` rows alongside `scored` ones when passed. `expired` rows are never retried, flag or not — this is the reason `expired` needed to be split out from `error` in the first place, rather than just improving `error`'s message.
- **Built a small notifications system** modeled on the existing `JobPlatform` adapter pattern: a `NotificationChannel` interface (`send(summary)`), one implementation so far (`TelegramNotifier`, via the Bot API), a `registry.ts` that activates channels based on which env vars are actually configured (so adding SMS/email later is one new class + one line, no changes to `apply.ts`), and a `notifyAll()` wrapper using `Promise.allSettled` so a failing or misconfigured channel never blocks or fails a real apply run. Sends one summary message (applied/already-applied/expired/error counts + duration) at the end of a **live** run only; dry runs never notify.
- Added `utils/terminalLink.ts` — wraps text in OSC-8 terminal hyperlink escape codes so job URLs print as clickable labels (e.g. `jobLink`) in supporting terminals (Windows Terminal, VS Code's integrated terminal), instead of long raw URLs cluttering the console log.
- Kept `src/db/check.js` and `src/db/reset.js` (plain ES-module Node scripts written during this version's debugging) in the repo as documented dev utilities rather than deleting them post-use, given the project is open source and in active development.

### V3.5
- Added multi-page scraping for Jobinja search results. Total result count is parsed from the page (handles Persian-numeral digits) and logged up front so you know how many jobs a `--max-pages` cap is leaving out; falls back to page-1-only with a warning if the count can't be parsed, rather than crashing.
- Added `--max-pages` flag (default `3`) to control how many result pages are fetched per run.
- Added `--keyword` flag (default `backend`) to make the search keyword configurable at runtime, replacing a previously hardcoded query string. Deliberately single-keyword only — see Known Limitations.
- Moved search-query construction out of `cli/index.ts` and into a new `buildSearchQuery()` method on the `JobPlatform` interface, implemented per-adapter. Keeps `index.ts` platform-agnostic ahead of adding a second platform in V4.
- Refactored `cli/index.ts`: extracted per-job filter/scoring logic into a `processJob()` function, flag-reading into `readRunFlags()`, and the repeated inter-request delay into a `throttle()` helper. Pure internal cleanup — no behavior change.
- Fixed a progress-counter bug: skip-branch log lines (`filtered_experience`, `filtered_location`) were hardcoded to show `/20`, correct only when a run was capped at a single page. Now reflects the actual `jobs.length` for the run.
- Extracted the shared inter-request delay into `utils/throttle.ts`, used by both `index.ts` and `apply.ts`, replacing two separate inline `setTimeout` calls.
- Extracted `apply.ts`'s raw SQL eligibility query into `db/getEligibleJobs.ts`, matching the existing pattern of giving each DB interaction its own named file (alongside `db/upsertJob.ts`).
- Refactored `apply.ts`'s progress counter to use `.entries()` instead of a manually incremented counter, matching `index.ts`.

### V3
- Added `filters/experience.ts` with a tagged-union `ExperienceRequirement` type (`range`, `atLeast`, `noRequirement`, `fieldAbsent`, `unparseable`) instead of a plain `{min, max}`, so every consumer handles each case explicitly. `noRequirement` and `fieldAbsent` are kept distinct even though they behave identically in the filter, so a future scraper breakage can be told apart from a genuine "doesn't matter" value.
- **Reversed an earlier design decision on the experience filter:** it was initially built as a hard pre-scoring skip (fail on any gap), then reversed after recognizing this contradicted the core principle that tech-stack match matters more than years of experience — a strict skip would silently discard well-matched jobs over a secondary signal the scorer already weighs. Final design is opt-in (`--experience-tolerance`) and fail-open by default; see Hard Filters section above.
- Added `utils/cliFlags.ts`'s `hasFlag(flagName)`, distinguishing "flag absent" from "flag present with a value" — `getNumericArg` alone couldn't express this, which the opt-in experience filter needed.
- Added `filters/location.ts` with `meetsLocationRequirement`, a plain boolean return (unlike the experience filter's tagged union — every "can't determine" case collapses to the same fail-open outcome here, so distinguishing them wasn't needed).
- Added `utils/normalizePersian.ts` to handle Persian/Arabic look-alike character variants (ی vs ي, ک vs ك) and zero-width non-joiners before location comparisons.
- Extended the resume-parsing prompt to extract `city`/`province` in Persian script (even when the resume states location in English), so it can be compared directly against Jobinja's Persian-language location field.
- **Discovered and fixed a real field-format issue:** Jobinja's location field is `<province>, <city>`, not `<city>, <city>` as it first appeared — Tehran and Isfahan looked duplicated only because those cities share their province's name.
- **Discovered that remote status lives in a separate field** (`نوع همکاری` / cooperation type, e.g. `"تمام وقت, دورکاری"`) from location, with an inconsistent delimiter — detection uses a substring check for `"دورکاری"` rather than splitting on a fixed delimiter.
- Added `--hard-match` flag to tighten the location filter from permissive province-level matching to exact city-level matching.
- **Fixed an unrelated regression surfaced while extending the resume prompt:** `workHistory` was silently dropping resume entries under a `## PROJECTS` section, due to a pre-existing prompt rule scoping extraction to work-experience sections only. Fixed by adding a separate `projects` field (`{title, summary}[]`, no `durationMonths`) to `ResumeProfileSchema`, rather than merging into `workHistory`, which would have corrupted the `totalYearsExperience`/`seniorityLevel` math computed from real employment durations.
- Added `apply()` to the `JobPlatform` interface, returning a tagged union `ApplyResult` (`success`, `alreadyApplied`, `error`) instead of a boolean, so each outcome is distinguishable for tracking purposes.
- Implemented `JobinjaAdapter.apply()`. The apply form's phone field and resume-choice radio are both pre-filled/pre-selected automatically by the site, so the implementation only needs to check for an "already applied" indicator, then click submit.
- **Debugged a real submit-confirmation bug:** the first implementation waited in-place for the "already applied" indicator to appear after clicking submit, which timed out — even though the application had actually gone through (confirmed by a second run against the same URL correctly returning `alreadyApplied`). Root cause: clicking submit redirects to a different page, so waiting in-place or reloading checks the wrong page. Fixed by explicitly re-navigating back to the original job URL after the click-triggered navigation completes. Verified end-to-end with a real, successful application, and a second real application to a different posting confirming `apply()` reliably returns `success`.
- Added `cli/apply.ts` as a separate entry point from `cli/index.ts`, deliberately decoupled rather than called inline in the scrape/score loop — this is the first part of the project with real-world side effects, so a persisted checkpoint between scoring and applying gives a review gate before anything irreversible happens.
- Added `--live-apply` flag as a safety gate — without it, `apply.ts` only logs what it would apply to, with zero side effects.
- Added `--skip-filters` flag to `cli/index.ts` to unblock testing `apply.ts` against a larger job set (the always-on location filter alone was leaving too few jobs to test against). Decided to keep it permanently rather than remove it as a debug-only flag.
- **Designed and built the SQLite application tracker**, replacing `jobs.json` and `applyResults.json` entirely:
  - Chose a "wide" schema — one row per job the pipeline ever encounters (filtered, scored, or applied), not just applied ones — over a narrower "applications only" table, in order to fix the audit-trail gap where filtered-out jobs previously left no persisted record at all.
  - Chose `better-sqlite3` (synchronous, raw SQL) over an ORM like Drizzle, for a minimal API with no added abstraction layer.
  - Added `db/client.ts`: opens `jobwright.db`, enables WAL mode, creates the `jobs` table (`url` primary key, `platform`, `title`, `status`, `score`, `reasoning`, `error_reason`, `first_seen_at`, `updated_at`) if it doesn't exist.
  - Added `db/upsertJob.ts`: a single `upsertJob()` function performing `INSERT ... ON CONFLICT(url) DO UPDATE`, called from every filter/scoring decision point in `index.ts` and every apply outcome in `apply.ts`.
  - Accepted a single-status-column design (no separate status-history log) as a deliberate tradeoff — `updated_at` shows when a row last changed, but not its prior states. Full history deferred as unnecessary for now.
  - Added `utils/mapApplyResultToStatus.ts` to translate `ApplyResult["status"]` into the database's `status` values — the two enums use different wording, so this is the one place that bridges them. Written with no `default` case in its `switch`, so TypeScript raises a compile error if `ApplyResult`'s status type ever grows a new variant without updating the mapping.
  - `cli/index.ts`: `results` array and the final `jobs.json` write removed entirely — every filter/scoring decision now writes directly to the database instead.
  - `cli/apply.ts`: the `jobs.json` file read replaced by a `SELECT` query (`status = 'scored' AND score >= ?`) — filtering out anything already filtered, scored below threshold, or already applied/error'd falls out of the schema for free, with no separate "already applied" check needed. The `applyResults.json` write replaced by an `upsertJob()` call after each `adapter.apply()`.

### V2
- Added `scoring/schema.ts` (`JobScoreSchema`): `score` (0–100, enforced), `requirementsMet` and `requirementsTotal` (both non-negative integers — added specifically to let downstream code sanity-check that a score actually tracks its own stated ratio), `missingRequirements` (string array), `reasoning` (string, length steered by prompt instruction rather than schema-enforced)
- Added `scoring/scorer.ts`: builds a scoring prompt, calls the LLM, strips code fences, validates against `JobScoreSchema`
- **Refactored `llm/client.ts`'s `openRouterWrapper`** from a function that hardcoded the resume-extraction prompt internally into a generic prompt-in/text-out wrapper, so it could be shared by both `resume/parser.ts` and `scoring/scorer.ts` without one feature's prompt leaking into the other's request
- **Moved `stripCodeFences`** out of `resume/parser.ts` into `utils/stripCodeFences.ts` — it's a generic string-cleanup helper with no resume- or scoring-specific knowledge, so it belongs alongside the other shared utilities
- **Iterated on the scoring prompt after finding real inconsistency:** the initial version used abstract anchoring bands (e.g. "missing 1–2 requirements") and produced unreliable scores on a small model, and even on a stronger model, showed a pattern of clustering around round/boundary numbers (e.g. four different postings all scoring exactly 70). Revised the prompt to include explicit step-by-step requirement counting, a worked example, an explicit instruction against defaulting to round numbers, and a formula-first anchor (`score ≈ 100 × requirementsMet / requirementsTotal`, adjustable for severity). Verified against a real batch — scores now track their own `requirementsMet`/`requirementsTotal` consistently.
- Added `utils/cliFlags.ts` with a generalized `getNumericArg(flagName, defaultValue)`, supporting both `--flag=value` and `--flag value` forms, replacing an earlier single-purpose flag parser
- Added `--reasoning-length` and `--min-score` CLI flags (see Usage)
- `cli/index.ts`: profile is now loaded into memory on **both** paths — parsed fresh when `profile.json` doesn't exist, or read from disk and re-validated against `ResumeProfileSchema` when it does. Previously, the "profile already exists" branch didn't actually load anything into memory.
- `cli/index.ts`: jobs with a `null` description (failed/partial scrape) are now skipped from scoring instead of causing a type error
- `cli/index.ts`: every scored job — regardless of score — is now written to `jobs.json` as a flat combined record (job fields + score fields merged). Filtering by score threshold happens only at console-log time for now, not at storage time, since low-scoring jobs may still be useful to review later.
- `cli/index.ts`: added a running `count/total` progress indicator to the console log for each scored job, and jobs below `--min-score` are now explicitly logged as "Ignored" (with their position in the run) instead of being silently skipped from console output
- Moved `parser.test.ts` into a top-level `__tests__/` folder

### V1
- Added `JobListing` / `JobPosting` / `JobPlatform` type contracts (`src/platforms/types.ts`), establishing the adapter interface every platform implements
- Built the Jobinja adapter: search by query, extract job listings, visit each posting and extract full description + metadata
- Centralized all Jobinja CSS selectors into `src/platforms/jobinja/selectors.ts`, threaded through `page.evaluate`/`page.$$eval` browser-context boundaries
- Added `src/platforms/registry.ts` with a strict `PlatformName` union type derived from the registry itself, so adding a platform later doesn't require hand-maintaining a separate type
- Refactored `src/cli/index.ts` to orchestrate through the registry instead of importing a specific adapter directly
- Fixed a logic bug where "Profile already exists!" printed unconditionally regardless of whether a profile was just created
- General hardening pass: replaced `.innerText` with `.textContent` in DOM extraction (more reliable in headless/automated contexts), replaced `||` fallbacks with `??` where appropriate, added explicit `null`/`undefined` handling across extracted fields

### V0
- Initial resume parser: Markdown resume -> LLM extraction (OpenRouter) -> validated JSON
- Defined `ResumeProfileSchema` (zod) as the contract for parsed resume data
- Moved experience-level computation (`totalYearsExperience`, `seniorityLevel`) out of the LLM's responsibility and into deterministic code, after the model proved unreliable at doing the arithmetic itself
- Added `stripCodeFences` to handle models that wrap JSON output in markdown code fences despite instructions not to
- Added unit tests for `computeExperienceLevel` and `stripCodeFences`
- Project scaffolding: TypeScript + `tsx`, Vitest, `.env`-based API key handling

</details>

## License

MIT — see [LICENSE](LICENSE). You're free to use, modify, and distribute this software, provided the copyright notice is kept. It comes with no warranty, which matters here: automated applying can affect your accounts and reputation, and you run it at your own risk.