import Database from "better-sqlite3";

// Single shared connection — same pattern as llm/client.ts being a
// generic, feature-agnostic wrapper other modules import from.
const db = new Database("jobwright.db");

// WAL mode isn't required for a single-process CLI tool, but it makes
// concurrent reads/writes safer if you ever add a dashboard or daemon
// mode that reads while index.ts/apply.ts is writing.
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    url TEXT PRIMARY KEY,
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

export { db };
