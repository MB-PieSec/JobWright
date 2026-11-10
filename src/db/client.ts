import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

// Resolve relative to the project root rather than process.cwd(), so running
// the CLI from another directory doesn't silently create a second, empty DB.
const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

export const dbPath = process.env.JOBWRIGHT_DB_PATH
  ? path.resolve(process.cwd(), process.env.JOBWRIGHT_DB_PATH)
  : path.join(projectRoot, "jobwright.db");

// Single shared connection — same pattern as llm/client.ts being a
// generic, feature-agnostic wrapper other modules import from.
const db = new Database(dbPath);

// WAL mode isn't required for a single-process CLI tool, but it makes
// concurrent reads/writes safer if you ever add a dashboard or daemon
// mode that reads while index.ts/apply.ts is writing.
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL UNIQUE,
    platform TEXT NOT NULL,
    title TEXT,
    status TEXT NOT NULL,
    score INTEGER,
    reasoning TEXT,
    error_reason TEXT,
    first_seen_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
  CREATE INDEX IF NOT EXISTS idx_jobs_platform ON jobs(platform);
  CREATE INDEX IF NOT EXISTS idx_jobs_score ON jobs(score);
`);

// A run is one search/score or apply pass triggered from the CLI or the web
// API. Events are kept in memory while the run is live and persisted here when
// it finishes, so a finished run can still be replayed after a restart.
db.exec(`
  CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    status TEXT NOT NULL,
    params TEXT NOT NULL,
    result TEXT,
    events TEXT,
    error TEXT,
    created_at TEXT NOT NULL,
    started_at TEXT,
    finished_at TEXT
  )
`);

// Small key/value store for user preferences (cookie source, auto-import,
// last import result). Values are JSON so the shape can evolve without a
// migration for every new preference.
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`);

// One-time migration: older DBs have `url` as the primary key and no `id`.
const columns = db.prepare("PRAGMA table_info(jobs)").all() as {
  name: string;
}[];
if (!columns.some((c) => c.name === "id")) {
  db.transaction(() => {
    db.exec(`
      CREATE TABLE jobs_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL UNIQUE,
        platform TEXT NOT NULL,
        title TEXT,
        status TEXT NOT NULL,
        score INTEGER,
        reasoning TEXT,
        error_reason TEXT,
        first_seen_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      INSERT INTO jobs_new (url, platform, title, status, score, reasoning, error_reason, first_seen_at, updated_at)
      SELECT url, platform, title, status, score, reasoning, error_reason, first_seen_at, updated_at
      FROM jobs
      ORDER BY first_seen_at;

      DROP TABLE jobs;
      ALTER TABLE jobs_new RENAME TO jobs;
    `);
  })();
}

export { db };
