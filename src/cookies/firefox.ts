import os from "node:os";
import path from "node:path";
import { copyFile, mkdtemp, rm } from "node:fs/promises";
import Database from "better-sqlite3";
import { isJobDomain } from "./domains.js";
import type { BrowserProfile, ImportedCookie } from "./types.js";

export interface FirefoxCookieRow {
  host: string;
  name: string;
  value: string | null;
  path: string | null;
  expiry: number | null;
  isSecure: number | null;
  isHttpOnly: number | null;
  sameSite: number | null;
  isSession: number | null;
}

export interface FirefoxReadResult {
  cookies: ImportedCookie[];
  skipped: number;
  failures: string[];
}

export function mapFirefoxSameSite(
  value: number | null | undefined,
): ImportedCookie["sameSite"] {
  switch (value) {
    case 0:
      return "None";
    case 1:
      return "Lax";
    case 2:
      return "Strict";
    default:
      return undefined;
  }
}

export function mapFirefoxRow(row: FirefoxCookieRow): ImportedCookie | null {
  if (!row.host || !row.name) return null;

  const session = row.isSession === 1 || !row.expiry;

  const cookie: ImportedCookie = {
    name: row.name,
    value: row.value ?? "",
    domain: row.host,
    path: row.path || "/",
    expires: session ? -1 : Number(row.expiry),
    httpOnly: row.isHttpOnly === 1,
    secure: row.isSecure === 1,
  };

  const sameSite = mapFirefoxSameSite(row.sameSite);
  if (sameSite) cookie.sameSite = sameSite;

  return cookie;
}

async function copyForRead(
  cookiePath: string,
): Promise<{ directory: string; file: string }> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "jobwright-cookies-"));
  const file = path.join(directory, path.basename(cookiePath));
  await copyFile(cookiePath, file);

  for (const suffix of ["-wal", "-shm"]) {
    try {
      await copyFile(cookiePath + suffix, file + suffix);
    } catch {
      // Sidecar does not exist; that is normal.
    }
  }

  return { directory, file };
}

/**
 * Firefox stores cookies in plaintext (the primary password protects logins,
 * not the cookie jar), so no keyring or decryption is needed.
 */
export async function readFirefoxCookies(
  profile: BrowserProfile,
): Promise<FirefoxReadResult> {
  const { directory, file } = await copyForRead(profile.cookiePath);
  const cookies: ImportedCookie[] = [];
  const failures: string[] = [];
  let skipped = 0;

  try {
    const database = new Database(file, {
      readonly: true,
      fileMustExist: true,
    });

    try {
      const rows = database
        .prepare("SELECT * FROM moz_cookies")
        .all() as FirefoxCookieRow[];

      for (const row of rows) {
        if (!isJobDomain(row.host)) continue;

        const cookie = mapFirefoxRow(row);
        if (cookie) {
          cookies.push(cookie);
        } else {
          skipped += 1;
          failures.push(`${row.host} ${row.name}: malformed row`);
        }
      }
    } finally {
      database.close();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }

  return { cookies, skipped, failures };
}
