import path from "node:path";
import type { Dirent } from "node:fs";
import { chmod, mkdir, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  browserDefinition,
  findCookiePath,
  isDirectory,
  isFamilySupported,
} from "./definitions.js";
import { detectBrowsers } from "./detect.js";
import { readChromiumCookies } from "./chromium.js";
import { readFirefoxCookies } from "./firefox.js";
import { getSetting, setSetting } from "../settings/store.js";
import type {
  BrowserFamily,
  BrowserId,
  BrowserProfile,
  CookieImportResult,
  CookieSource,
  ImportedCookie,
} from "./types.js";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

/** The file the Puppeteer launcher already reads. */
export function effectiveCookiesPath(): string {
  return process.env.JOBWRIGHT_COOKIES_PATH
    ? path.resolve(process.cwd(), process.env.JOBWRIGHT_COOKIES_PATH)
    : path.join(projectRoot, "cookies.json");
}

function dedupeCookies(cookies: ImportedCookie[]): ImportedCookie[] {
  const unique = new Map<string, ImportedCookie>();
  for (const cookie of cookies) {
    unique.set(`${cookie.domain}|${cookie.path}|${cookie.name}`, cookie);
  }
  return [...unique.values()];
}

/**
 * Finds a profile inside a folder the user picked. Accepts either a profile
 * directory (contains Cookies/cookies.sqlite) or a browser user-data root
 * (contains Default/ or profile subdirectories).
 */
async function findProfileInDirectory(
  directory: string,
  family: BrowserFamily,
): Promise<BrowserProfile | null> {
  const direct = await findCookiePath(directory, family);
  if (direct) {
    return {
      id: directory,
      name: path.basename(directory),
      path: directory,
      cookiePath: direct,
      isDefault: true,
    };
  }

  let entries: Dirent[];
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return null;
  }

  const candidates = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(directory, entry.name));

  // Prefer a "Default" profile when the user selected a browser root.
  const preferred = candidates.find(
    (candidate) => path.basename(candidate) === "Default",
  );
  const ordered = preferred
    ? [preferred, ...candidates.filter((candidate) => candidate !== preferred)]
    : candidates;

  for (const candidate of ordered) {
    const cookiePath = await findCookiePath(candidate, family);
    if (cookiePath) {
      return {
        id: candidate,
        name: path.basename(candidate),
        path: candidate,
        cookiePath,
        isDefault: path.basename(candidate) === "Default",
      };
    }
  }

  return null;
}

async function resolveProfile(
  browserId: BrowserId,
  profilePath: string | undefined,
): Promise<BrowserProfile> {
  const definition = browserDefinition(browserId);

  if (profilePath) {
    const directory = path.resolve(profilePath);
    if (!(await isDirectory(directory))) {
      throw new Error(`Not a directory: ${directory}`);
    }

    const profile = await findProfileInDirectory(directory, definition.family);
    if (profile) return profile;

    // The folder may be a browser root the scanner knows about but that has a
    // non-standard profile layout.
    const detected = await detectBrowsers();
    const browser = detected.find((item) => item.id === browserId);
    const known = browser?.profiles.find(
      (item) =>
        item.path === directory ||
        item.path.startsWith(`${directory}${path.sep}`),
    );
    if (known) return known;

    const cookieFile =
      definition.family === "firefox" ? "cookies.sqlite" : "Cookies";
    throw new Error(
      `No ${cookieFile} database found in ${directory}. Pick the browser profile folder, or the browser's user-data folder.`,
    );
  }

  const detected = await detectBrowsers();
  const browser = detected.find((item) => item.id === browserId);
  const profile =
    browser?.profiles.find((item) => item.isDefault) ?? browser?.profiles[0];

  if (!profile) {
    throw new Error(
      `${browser?.name ?? browserId} was not detected, or has no profile with a cookie database.`,
    );
  }

  return profile;
}

export interface ImportCookiesOptions {
  browserId: BrowserId;
  profilePath?: string;
}

/**
 * Reads job-related cookies from a local browser and writes them to the file
 * the Puppeteer launcher reads. Only jobinja.ir / jobvision.ir cookies are
 * touched, and values are never returned to the caller.
 */
export async function importCookies(
  options: ImportCookiesOptions,
): Promise<CookieImportResult> {
  const definition = browserDefinition(options.browserId);

  if (!isFamilySupported(definition.family)) {
    throw new Error(
      "Cookie decryption is not implemented for this OS yet. Linux is supported first.",
    );
  }

  const profile = await resolveProfile(options.browserId, options.profilePath);

  const read =
    definition.family === "chromium"
      ? await readChromiumCookies(profile, definition.keyringApp)
      : await readFirefoxCookies(profile);

  const cookies = dedupeCookies(read.cookies);

  if (cookies.length === 0) {
    const decryptionHint =
      read.skipped > 0
        ? ` ${read.skipped} matching cookie(s) could not be decrypted — unlock your keyring and try again.`
        : "";
    throw new Error(
      `No jobinja.ir or jobvision.ir cookies were found in ${definition.name} profile "${profile.name}". Log in to those sites in ${definition.name}, then try again.${decryptionHint}`,
    );
  }

  const writtenTo = effectiveCookiesPath();
  await mkdir(path.dirname(writtenTo), { recursive: true });
  await writeFile(writtenTo, JSON.stringify(cookies, null, 2), {
    mode: 0o600,
  });
  // An existing file keeps its old mode; enforce owner-only explicitly.
  await chmod(writtenTo, 0o600).catch(() => undefined);

  const domains = [
    ...new Set(cookies.map((cookie) => cookie.domain.replace(/^\./, ""))),
  ].sort();

  return {
    browserId: definition.id,
    browserName: definition.name,
    profilePath: profile.path,
    cookieCount: cookies.length,
    skipped: read.skipped,
    domains,
    writtenTo,
    importedAt: new Date().toISOString(),
  };
}

/**
 * Called before a live apply run when the user enabled auto-import. Best
 * effort: a failure should not prevent the run from starting, but it is
 * returned so the caller can log it.
 */
export async function maybeAutoImportCookies(): Promise<CookieImportResult | null> {
  const source = getSetting<CookieSource>("cookies.source");
  if (!source?.autoImport) return null;

  const result = await importCookies({
    browserId: source.browserId,
    profilePath: source.profilePath,
  });
  setSetting("cookies.lastImport", result);
  return result;
}
