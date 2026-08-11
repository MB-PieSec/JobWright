# Jobwright

A self-hosted, open-source CLI tool that parses your resume, matches it against job postings across multiple platforms, and auto-applies to the ones that fit — built for developers who want a real, ownable alternative to manually scrolling job boards.

**Status: V0 — resume parsing only.** Platform scraping, scoring, and auto-apply are not implemented yet. This version takes a Markdown resume and turns it into structured, validated JSON.

## What V0 does

1. Reads a resume from a local Markdown (`.md`) file
2. Sends it to an LLM (via OpenRouter) to extract structured data — name, skills, and work history
3. Computes total years of experience and a seniority level from that work history in code (not by the LLM — see note below)
4. Validates the final result against a strict schema
5. Saves the result to `profile.json`

## Requirements

- Node.js (v22+ recommended)
- An [OpenRouter](https://openrouter.ai) API key

## Setup

```bash
git clone https://github.com/<your-username>/jobwright.git
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

You'll be prompted for the path to your resume. Point it at a Markdown file:

```
Enter the path to your resume: ./myResume.md
```

The parsed, validated profile will be saved to `profile.json` in the project root.

## Resume format

V0 only supports **Markdown** resumes. PDF and DOCX support are not implemented yet. Structure your resume with clear section headers (e.g. `## Experience`, `## Skills`) — this measurably improves extraction accuracy, since the LLM uses your headers as structural signal.

## Known limitations

- **`totalYearsExperience` is computed by summing `durationMonths` across all `workHistory` entries.** If a role or project in your resume doesn't have a clear time range, it will be parsed as `0` months and won't count toward your total. If you want personal or freelance projects to count toward your experience total, make sure they include explicit duration information in your resume.
- Extraction quality depends on the underlying LLM model. Smaller/cheaper models can occasionally misgroup or fragment work history entries — review `profile.json` after running to confirm it looks correct before relying on it downstream.
- No PDF/DOCX support yet.
- No platform scraping, scoring, or auto-apply yet — that's coming in later versions.

## Project structure

```
src/
├── cli/
│   └── index.ts      # entry point — prompts for resume path, orchestrates the flow
├── resume/
│   ├── schema.ts      # ResumeProfile zod schema
│   ├── parser.ts       # resume text -> LLM extraction -> validated ResumeProfile
│   └── parser.test.ts
└── llm/
    └── client.ts       # OpenRouter API wrapper
```

## Roadmap

- V1 — first job platform adapter (read-only job listing extraction)
- V2 — resume-to-job scoring engine
- V3 — auto-apply + application tracking (SQLite)
- V4 — additional platforms + notifications
- V5 — LinkedIn/Indeed support, outcome tracking

## License

Not yet decided.
