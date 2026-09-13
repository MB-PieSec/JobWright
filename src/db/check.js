import Database from 'better-sqlite3';
const db = new Database("./jobwright.db");
const rows = db.prepare("SELECT url, title, platform, status FROM jobs WHERE platform = 'jobinja' AND status = 'scored' ORDER BY updated_at DESC LIMIT 10").all();
console.table(rows);