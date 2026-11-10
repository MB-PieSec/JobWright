import { db } from "../db/client.js";

interface SettingRow {
  key: string;
  value: string;
  updated_at: string;
}

export function getSetting<T>(key: string): T | null {
  const row = db
    .prepare("SELECT key, value, updated_at FROM settings WHERE key = ?")
    .get(key) as SettingRow | undefined;

  if (!row) return null;

  try {
    return JSON.parse(row.value) as T;
  } catch {
    // A corrupt value should not take down the settings endpoint.
    return null;
  }
}

export function setSetting(key: string, value: unknown): void {
  db.prepare(
    `INSERT INTO settings (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = excluded.updated_at`,
  ).run(key, JSON.stringify(value), new Date().toISOString());
}

export function deleteSetting(key: string): void {
  db.prepare("DELETE FROM settings WHERE key = ?").run(key);
}
