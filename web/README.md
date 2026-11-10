# JobWright web UI

React + Vite + TypeScript SPA for the JobWright pipeline. It is built and served
by the Fastify API in production, and talks to the same `/api` routes in
development through Vite's proxy.

The app has seven hash routes behind a slide-over navigation drawer:

| Route                  | Page          | Purpose                                              |
| ---------------------- | ------------- | ---------------------------------------------------- |
| `#/overview` (default) | Overview      | Landing dashboard: stat cards, charts, recent runs   |
| `#/jobs`               | Jobs          | Filter, sort and review the scraped job database     |
| `#/runs`               | Runs          | Start search/apply runs, watch the live SSE log      |
| `#/resume`             | Resume        | Upload a `.md` resume and inspect the active profile |
| `#/ai`                 | AI providers  | Provider/model/key setup and connection tests        |
| `#/notifications`      | Notifications | Telegram token/chat ID, test message, saved config   |
| `#/settings`           | Settings      | Browser detection, cookie import, auto-import        |

Hash routing is deliberate: the built SPA works when Fastify serves it from any
path without server-side route configuration.

## Running it

```bash
# Terminal 1 — API on http://127.0.0.1:3000
npm run dev:server        # from the repo root

# Terminal 2 — Vite dev server on http://localhost:5173
npm --prefix web run dev
```

The Vite dev server proxies `/api` to `http://127.0.0.1:3000`, so the browser
only ever talks to one origin (same as production).

Production build (outputs `web/dist`, which Fastify serves when it exists at
startup):

```bash
npm run build:web         # from the repo root
npm run start:server
```

Other scripts:

```bash
npm --prefix web run typecheck
npm --prefix web run format   # prettier + prettier-plugin-tailwindcss
```

## Pages

### Overview

The landing dashboard reads `GET /api/stats`:

- Four stat cards: total jobs, applied count, average score, completed runs.
- Status donut and platform donut, both hand-built SVG.
- Stacked 14-day activity columns (jobs seen vs. applied).
- Score-distribution columns in ten-point buckets.
- Recent runs with status badges and one-line summaries.

Charts live in `src/components/charts.tsx` and use `pathLength={100}` plus
percentage dash values, so no circumference math or inline sizing is needed. The
only inline style in the app is the score-bar width, which is data-driven.

### Jobs

`src/pages/JobsPage.tsx` holds the review workflow:

- Sticky filter bar: search, status multi-select, platform chips, score range,
  first-seen date range, sort key and direction.
- Dense table above `md`, cards below it.
- Pagination with page-size selection.
- Right-side detail panel with the LLM reasoning and a delete action.
- Wipe-all and delete confirmations; the wipe requires typing `DELETE`.

### Runs

`src/pages/RunsPage.tsx` drives the pipeline:

- Search form: platform, keyword, max pages, min score, reasoning length,
  experience tolerance, hard match, skip filters.
- Apply form: min score, max applies, retry errors, live apply. A live apply
  opens a confirmation dialog that requires typing `APPLY`.
- Run history with params, outcome summary and duration.
- `RunLogPanel` subscribes to `GET /api/runs/:id/events` and renders named SSE
  events as a readable log; `useRunEvents` attaches a listener per event type,
  dedupes by event id, and closes the stream on `run_finished`, `run_failed` or
  `run_cancelled`.
- Active runs show **Stop** (`POST /api/runs/:id/stop`), which lets the current
  job finish before the pipeline aborts. Stopped runs show **Clear** (hides the
  log only; the run stays in history) and, for search runs, **Resume**
  (`POST /api/runs/:id/resume`). Resume starts a new run with the same params,
  skips jobs the stopped run already processed, and switches the panel to the
  new run.

### Resume

`src/pages/ResumePage.tsx` owns profile creation from the browser:

- Drag-and-drop or file picker, accepting `.md` / `.MD` up to 256 KiB.
- Client-side validation mirrors the server so obvious mistakes never reach the
  API; the file is read as text and sent as JSON (`{ filename, content }`).
- **Upload & parse** shows a parsing state while the LLM extracts the profile,
  then refreshes the summary. Failures leave the previous resume and profile
  untouched.
- The right-hand card summarizes the active profile — name, experience,
  seniority, location, skills, work history, projects, education — plus the
  original filename, size and upload time when recorded.

Other formats (PDF, DOCX) are intentionally not supported yet.

### AI providers

`src/pages/AiPage.tsx` configures the LLM used by resume parsing and scoring:

- Provider cards for OpenRouter, OpenAI, Anthropic (Claude), Google Gemini,
  Groq, DeepSeek, Mistral, xAI (Grok) and Together AI, each showing whether its
  key comes from a saved key, the environment, or nowhere.
- Editable model field with per-provider suggestions; the field is never
  locked to the catalog.
- **Test connection & save** calls `POST /api/ai/test` first and only calls
  `PUT /api/ai` after the provider replies, so a bad key is never stored.
- **Remove saved key** clears only the stored copy and falls back to the
  matching environment variable if one exists.
- The active-provider summary shows provider, model, key source and readiness.
  Keys are write-only from the page's perspective: `GET /api/ai` reports
  presence/source and never returns a value.

### Notifications

`src/pages/NotificationsPage.tsx` configures Telegram delivery for live apply
runs:

- Bot token and chat ID fields backed by `GET/PUT /api/notifications`; saved
  values take precedence over `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID`.
- **Send test message** posts to `POST /api/notifications/test` without saving
  the pasted values, so a wrong token or chat ID is caught first.
- **Remove saved settings** deletes both stored values and falls back to the
  environment.
- The token is write-only from the page's perspective; the API reports only
  presence/source. The chat ID is shown because it is not secret.

### Settings

`src/pages/SettingsPage.tsx` manages cookie import:

- Lists detected Brave, Chrome, Opera and Firefox installs with a **Found** /
  **Not detected** badge and any detector note.
- Lets you choose a profile, or type/paste a custom profile or browser folder.
- **Import cookies** reads only `jobinja.ir` / `jobvision.ir` cookies and writes
  a `0600` Puppeteer-format file; values are never sent back to the page.
- **Browse…** opens `PathPicker`, a server-backed folder browser built on
  `/api/fs/roots` and `/api/fs/list`. It exists because the page cannot read the
  server's filesystem itself. It marks folders that directly contain a cookie
  database.
- **Auto-import** refreshes cookies before each live apply run; a failed import
  is logged and the run continues with the existing file.
- **Debug mode** shows the Chromium window during search and live apply instead
  of running headless. Off by default; the value is stored as
  `browser.debugMode` and applies to CLI runs too because they share the
  database. Changing it saves immediately.

Linux is the fully supported platform for Chromium decryption today; Firefox
cookies are plaintext and work everywhere. Windows and macOS are next.

## Design tokens

All colors, radii, fonts and the extra `text-2xs` size live in
`src/index.css`. Light and dark values are raw CSS variables on `:root` and
`.dark`, aliased into Tailwind's namespace with `@theme inline`, so utilities
like `bg-surface` / `text-ink` re-resolve at runtime instead of freezing the
light value. Add a token once there and both modes stay in sync.

The accent scale has three stops — `accent` (indigo), `accent-2` (violet) and
`accent-3` (rose) — plus `-soft`, `-text` and `-hover` variants. Primary
buttons, the logo marks, active navigation, page heroes and stat-card top lines
use Tailwind's gradient utilities (`bg-linear-to-r` / `bg-linear-to-br`) across
those stops. Gradients are decorative only; every piece of text still uses a
token that meets WCAG AA in both themes.

## Dark mode

Tailwind v4 defaults `dark:` to `prefers-color-scheme`. This project switches
to class-based dark mode so the manual toggle can override the OS setting:

```css
@custom-variant dark (&:where(.dark, .dark *));
```

The pieces involved:

- `index.html` has a tiny pre-paint script that adds `.dark` to `<html>` from
  `localStorage["jobwright-theme"]` or the system preference, preventing a
  flash of the wrong theme.
- `src/hooks/useTheme.ts` owns the toggle: it writes the class and persists the
  choice. Until a choice is stored, it follows system changes live.
- Semantic colors (surfaces, text, accent, status, score tones) are defined for
  both modes in `src/index.css`; components use tokens like `bg-surface` and
  `text-ink` instead of `dark:` one-offs. Reach for `dark:` only for the rare
  case with no token (e.g. `dark:[color-scheme:dark]` on form controls so the
  native date picker matches).

To add a new themed color, define `--thing` under both `:root` and `.dark`, then
alias it in `@theme inline` as `--color-thing: var(--thing)`.

## Languages and RTL

The UI is bilingual English/Persian. `src/i18n.tsx` holds the dictionary and a
`useI18n()` hook exposing `t()`, `locale` (`en-US` / `fa-IR`), `dir` and the
language toggle. English source strings double as translation keys, so any
string without a Persian entry falls back to English instead of showing a raw
key.

- The choice persists in `localStorage["jobwright-lang"]`; when nothing is
  stored, the browser language decides. A pre-paint script in `index.html` sets
  `<html lang>` and `<html dir>` before React mounts, so the first frame is
  already in the right direction.
- Persian switches the whole document to `dir="rtl"`. Layout uses logical
  utilities (`ms-*` / `me-*`, `ps-*` / `pe-*`, `text-start` / `text-end`,
  `start-*` / `end-*`, `border-s` / `border-e`) so mirroring needs no per-page
  overrides. Directional icons add `rtl:rotate-180` / `rtl:rotate-0`.
- `html[dir="rtl"]` swaps `--font-ui` to Vazirmatn-first; Inter stays in the
  stack for Latin identifiers and model names. Both fonts are bundled locally
  through `@fontsource-variable`.
- Dates and numbers go through `src/lib/format.ts`, which caches
  `Intl.DateTimeFormat` / `Intl.NumberFormat` instances for `en-US` and
  `fa-IR`. Charts receive the locale so labels and tooltips localize too.
- `dir="auto"` stays on every element that renders a job title, reasoning,
  error, or user-entered search text, so mixed Persian/Latin content aligns
  itself independently.
- URLs, file paths and IDs are forced to `dir="ltr"` and use `font-mono` plus
  `break-all` or `truncate`.

## Structure

```
src/
├── index.css            # @theme tokens, light/dark variables, base styles
├── App.tsx              # shell: hash route, drawer, theme, toast ownership
├── i18n.tsx             # English/Persian dictionary, locale, language toggle
├── api.ts               # jobs, runs, resume, AI, notifications, stats, settings, cookies, fs clients
├── types.ts             # jobs, runs, resume, AI, notifications, stats, cookies, fs types
├── pages/
│   ├── OverviewPage.tsx # dashboard: stat cards, charts, recent runs
│   ├── JobsPage.tsx     # filters, table/cards, pagination, detail panel
│   ├── RunsPage.tsx     # search/apply forms, history, live log, stop/resume
│   ├── ResumePage.tsx   # .md upload/drop zone + active profile summary
│   ├── AiPage.tsx       # provider picker, key/model editing, test-and-save
│   ├── NotificationsPage.tsx # Telegram token/chat ID, test message, saved config
│   └── SettingsPage.tsx # browser detection, cookie import, folder picker
├── components/          # Badge, Button, Input, Select, ScoreBar, FilterBar,
│                        # JobsTable, JobCard, Pagination, DetailPanel,
│                        # ConfirmDialog, Toast, Skeleton, TopBar, icons,
│                        # NavDrawer, StatCard, RunStatusBadge, PathPicker,
│                        # RunLogPanel, charts (donut + stacked columns)
├── hooks/               # useJobs, useTheme, useDebouncedValue, useFocusTrap,
│                        # useHashRoute, useRunEvents
└── lib/                 # cn, formatting, status labels + score tones, run helpers
```
