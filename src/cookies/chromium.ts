import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import { copyFile, mkdtemp, rm } from "node:fs/promises";
import Database from "better-sqlite3";
import { isJobDomain } from "./domains.js";
import { getChromiumKeyringPassword } from "./keyring.js";
import type { BrowserProfile, ImportedCookie } from "./types.js";

// Chromium on Linux derives an AES-128 key from a keyring password with a
// single PBKDF2 round, and uses 16 spaces as the CBC IV. This is stable across
// Chrome/Brave/Opera; the key itself is what differs per browser.
const CHROMIUM_IV = Buffer.alloc(16, 0x20);
const CHROME_EPOCH_OFFSET_SECONDS = 11_644_473_600;

export interface ChromiumCookieRow {
  host_key: string;
  name: string;
  value: string | null;
  encrypted_value: Buffer | null;
  path: string | null;
  expires_utc: number | null;
  is_secure: number | null;
  is_httponly: number | null;
  samesite: number | null;
  is_persistent: number | null;
}

export interface ChromiumReadResult {
  cookies: ImportedCookie[];
  skipped: number;
  failures: string[];
  keyringFound: boolean;
}

export function deriveChromiumKey(password: string): Buffer {
  return crypto.pbkdf2Sync(password, "saltysalt", 1, 16, "sha1");
}

function unpad(buffer: Buffer): Buffer {
  if (buffer.length === 0) return buffer;
  const padding = buffer[buffer.length - 1];
  if (padding < 1 || padding > 16 || padding > buffer.length) return buffer;

  const tail = buffer.subarray(buffer.length - padding);
  if (!tail.every((byte) => byte === padding)) return buffer;

  return buffer.subarray(0, buffer.length - padding);
}

function isPlausibleCookieValue(value: string): boolean {
  if (value.includes("\uFFFD")) return false;
  // Reject binary control characters, but allow tab (some sites use it).
  return !/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value);
}

/**
 * Chrome 130+ prepends SHA-256(host_key) to the plaintext before encrypting.
 * Older stores do not. Strip it only when it matches, so both formats work.
 */
function stripHostHash(decrypted: Buffer, hostKey: string): string {
  const hostHash = crypto.createHash("sha256").update(hostKey).digest();
  if (decrypted.length >= 32 && decrypted.subarray(0, 32).equals(hostHash)) {
    return decrypted.subarray(32).toString("utf8");
  }
  return decrypted.toString("utf8");
}

/**
 * Decrypts a `v10`/`v11` Chromium cookie value. Tries every candidate key
 * (keyring first, then the `peanuts` fallback used with --password-store=basic)
 * and validates the result before accepting it.
 */
export function decryptChromiumValue(
  encrypted: Buffer,
  hostKey: string,
  keys: Buffer[],
): string {
  const prefix = encrypted.subarray(0, 3).toString("latin1");

  if (prefix === "v20") {
    throw new Error("app-bound cookie encryption (v20) is not supported");
  }

  if (prefix !== "v10" && prefix !== "v11") {
    // Very old stores kept the value in encrypted_value as plaintext.
    return encrypted.toString("utf8");
  }

  const payload = encrypted.subarray(3);

  for (const key of keys) {
    try {
      const decipher = crypto.createDecipheriv("aes-128-cbc", key, CHROMIUM_IV);
      const decrypted = unpad(
        Buffer.concat([decipher.update(payload), decipher.final()]),
      );
      const value = stripHostHash(decrypted, hostKey);
      if (isPlausibleCookieValue(value)) return value;
    } catch {
      // Wrong key for this value; try the next one.
    }
  }

  throw new Error("could not decrypt with the available keys");
}

export function chromeExpiresToUnix(
  expiresUtc: number | null | undefined,
): number {
  if (!expiresUtc || expiresUtc <= 0) return -1;
  return Math.max(
    -1,
    Math.floor(expiresUtc / 1_000_000 - CHROME_EPOCH_OFFSET_SECONDS),
  );
}

export function mapChromiumSameSite(
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

export function mapChromiumRow(
  row: ChromiumCookieRow,
  value: string,
): ImportedCookie | null {
  if (!row.host_key || !row.name) return null;

  const persistent =
    row.is_persistent === 1 ||
    (row.is_persistent == null && (row.expires_utc ?? 0) > 0);

  const cookie: ImportedCookie = {
    name: row.name,
    value,
    domain: row.host_key,
    path: row.path || "/",
    expires: persistent ? chromeExpiresToUnix(row.expires_utc) : -1,
    httpOnly: row.is_httponly === 1,
    secure: row.is_secure === 1,
  };

  const sameSite = mapChromiumSameSite(row.samesite);
  if (sameSite) cookie.sameSite = sameSite;

  return cookie;
}

async function copyForRead(
  cookiePath: string,
): Promise<{ directory: string; file: string }> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "jobwright-cookies-"));
  const file = path.join(directory, path.basename(cookiePath));
  await copyFile(cookiePath, file);

  // The browser may be running with WAL enabled; copy the sidecars too so a
  // recent login is not missed.
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
 * Reads and decrypts job-related cookies from a Chromium profile. The DB is
 * copied first so a running browser's lock never blocks the import.
 */
export async function readChromiumCookies(
  profile: BrowserProfile,
  keyringApp: string | null,
): Promise<ChromiumReadResult> {
  const keyringPassword = await getChromiumKeyringPassword(keyringApp);

  const keys: Buffer[] = [];
  if (keyringPassword) keys.push(deriveChromiumKey(keyringPassword));
  // Fallback for Chromium's basic password store.
  keys.push(deriveChromiumKey("peanuts"));

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
        .prepare("SELECT * FROM cookies")
        .all() as ChromiumCookieRow[];

      for (const row of rows) {
        if (!isJobDomain(row.host_key)) continue;

        let value = row.value ?? "";

        if (!value && row.encrypted_value?.length) {
          try {
            value = decryptChromiumValue(
              row.encrypted_value,
              row.host_key,
              keys,
            );
          } catch (error) {
            skipped += 1;
            failures.push(
              `${row.host_key} ${row.name}: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
            continue;
          }
        }

        const cookie = mapChromiumRow(row, value);
        if (cookie) cookies.push(cookie);
      }
    } finally {
      database.close();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }

  return {
    cookies,
    skipped,
    failures,
    keyringFound: Boolean(keyringPassword),
  };
}
