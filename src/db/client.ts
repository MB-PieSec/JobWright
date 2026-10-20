import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

// Resolve relative to the project root rather than process.cwd(), so running
// the CLI from another directory doesn't silently create a second, empty DB.
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

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
