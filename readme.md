# Jobwright

A self-hosted, open-source CLI tool that parses your resume, matches it against job postings across multiple platforms, and auto-applies to the ones that fit — built for developers who want a real, ownable alternative to manually scrolling job boards.

**Status: V1 — resume parsing + first platform adapter (Jobinja, read-only).** Scoring, auto-apply, and application tracking are not implemented yet.

## What Jobwright does so far

1. Reads a resume from a local Markdown (`.md`) file
2. Sends it to an LLM (via OpenRouter) to extract structured data — name, skills, and work history
3. Computes total years of experience and a seniority level from that work history in code (not by the LLM — see note below)
4. Validates the result against a strict schema and saves it to `profile.json`
5. Searches Jobinja for job postings matching a query, using a headless browser
6. Visits each matching posting and extracts its full description and metadata (location, work type, required experience, etc.)

Nothing is scored, tracked, or applied to yet — this version proves the extraction pipeline works end to end for one platform.

## Requirements

- Node.js (v22+ recommended)
- An [OpenRouter](https://openrouter.ai) API key

## Setup

```bash
git clone https://github.com/MB-PieSec/jobwright.git
cd jobwright
npm install
```

Create a `.env` file in the project root with your OpenRouter API key:

```
OPENROUTER_API_KEY=your_key_here
```

This file is git-ignored — never commit your API key.

## Usage

```bash
npm start
```

On first run, you'll be prompted for the path to your resume (Markdown only for now). The parsed, validated profile is saved to `profile.json` — on subsequent runs this step is skipped if `profile.json` already exists.

The tool then opens a browser, searches Jobinja for a (currently hardcoded) query, and logs each matching job's title, URL, description, and metadata to the console.

## Resume format

Only **Markdown** resumes are supported. PDF and DOCX are not implemented yet. Structure your resume with clear section headers (e.g. `## Experience`, `## Skills`) — this measurably improves extraction accuracy, since the LLM uses your headers as structural signal.

## Known limitations

- **`totalYearsExperience` is computed by summing `durationMonths` across all `workHistory` entries.** If a role or project in your resume doesn't have a clear time range, it will be parsed as `0` months and won't count toward your total. If you want personal or freelance projects to count toward your experience total, make sure they include explicit duration information in your resume.
- Extraction quality depends on the underlying LLM model. Smaller/cheaper models can occasionally misgroup or fragment work history entries — review `profile.json` after running to confirm it looks correct before relying on it downstream.
- No PDF/DOCX support yet.
- Jobinja search query and platform selection are currently hardcoded in `src/cli/index.ts` — not yet configurable via CLI args or config file.
- Job search results are only logged to the console, not saved to a file yet.
- No scoring, auto-apply, or application tracking yet — that's coming in later versions.
- Jobinja scraping depends on the site's current DOM structure (via `src/platforms/jobinja/selectors.ts`). If Jobinja changes their page layout, extraction may break until selectors are updated.

## Project structure

```
src/
├── cli/
│   └── index.ts              # entry point — orchestrates resume parsing + job search
├── resume/
│   ├── schema.ts               # ResumeProfile zod schema
│   ├── parser.ts               # resume text -> LLM extraction -> validated ResumeProfile
│   └── parser.test.ts
├── llm/
│   └── client.ts                # OpenRouter API wrapper
├── platforms/
│   ├── types.ts                 # JobListing / JobPosting / JobPlatform contracts
│   ├── browser.ts                # shared Puppeteer browser launcher
│   ├── registry.ts               # platform name -> adapter lookup
│   └── jobinja/
│       ├── adapter.ts             # implements JobPlatform for Jobinja
│       └── selectors.ts           # all Jobinja CSS selectors, centralized
└── utils/
    ├── getUserInput.ts
    ├── readFileContent.ts
    └── fileExists.ts
```

## Roadmap

- ~~V0 — resume parsing~~ done
- ~~V1 — first job platform adapter (Jobinja, read-only)~~ done
- V2 — resume-to-job scoring engine
- V3 — auto-apply + application tracking (SQLite)
- V4 — additional platforms + notifications
- V5 — LinkedIn/Indeed support, outcome tracking

## Changelog

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

## License

Not yet decided.
