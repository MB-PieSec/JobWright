import Database from "better-sqlite3";

const db = new Database("./jobwright.db");
const result = db
  .prepare(
    "UPDATE jobs SET status = 'scored' WHERE status IN ('error', 'expired', 'applied', 'already_applied') AND updated_at >= datetime('now', '-2 hours')",
  )
  .run();
console.log("Rows updated:", result.changes);
