import path from "node:path";
import type { Dirent } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import {
  BROWSER_DEFINITIONS,
  findCookiePath,
  findExecutable,
  isDirectory,
  isFamilySupported,
  type BrowserDefinition,
} from "./definitions.js";
import type { BrowserProfile, DetectedBrowser } from "./types.js";

const SKIPPED_CHROMIUM_DIRS = new Set([
  "System Profile",
  "Guest Profile",
  "Crashpad",
  "ShaderCache",
  "GrShaderCache",
  "GraphiteDawnCache",
  "BrowserMetrics",
]);

async function chromiumProfileName(
  directory: string,
  fallback: string,
): Promise<string> {
  try {
    const raw = await readFile(path.join(directory, "Preferences"), "utf8");
    const parsed = JSON.parse(raw) as { profile?: { name?: string } };
    const name = parsed.profile?.name?.trim();
    if (name) return name;
  } catch {
    // Preferences is optional and may be locked while the browser runs.
  }
  return fallback;
}

async function discoverChromiumProfiles(
  definition: BrowserDefinition,
): Promise<BrowserProfile[]> {
  const profiles = new Map<string, BrowserProfile>();

  for (const root of definition.roots) {
    if (!(await isDirectory(root))) continue;

    // Opera keeps its profile files directly in the root; Chrome/Brave use
    // subdirectories such as "Default" and "Profile 1".
    const rootCookie = await findCookiePath(root, "chromium");
    if (rootCookie) {
      profiles.set(root, {
        id: root,
        name: path.basename(root),
        path: root,
        cookiePath: rootCookie,
        isDefault: true,
      });
    }

    let entries: Dirent[];
    try {
      entries = await readdir(root, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (SKIPPED_CHROMIUM_DIRS.has(entry.name)) continue;

      const directory = path.join(root, entry.name);
      const cookiePath = await findCookiePath(directory, "chromium");
      if (!cookiePath) continue;

      profiles.set(directory, {
        id: directory,
        name: await chromiumProfileName(directory, entry.name),
        path: directory,
        cookiePath,
        isDefault: entry.name === "Default",
      });
    }
  }

  const list = [...profiles.values()];
  list.sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return list;
}

interface FirefoxProfileCandidate {
  directory: string;
  name: string;
  isDefault: boolean;
}

function parseIni(text: string): Record<string, Record<string, string>> {
  const sections: Record<string, Record<string, string>> = {};
  let current: string | null = null;

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith(";")) {
      continue;
    }

    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      current = trimmed.slice(1, -1);
      sections[current] = {};
      continue;
    }

    if (!current) continue;

    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    sections[current][key] = value;
  }

  return sections;
}

async function discoverFirefoxProfiles(
  definition: BrowserDefinition,
): Promise<BrowserProfile[]> {
  const profiles = new Map<string, BrowserProfile>();
  const candidates: FirefoxProfileCandidate[] = [];

  for (const root of definition.roots) {
    if (!(await isDirectory(root))) continue;

    try {
      const ini = await readFile(path.join(root, "profiles.ini"), "utf8");
      const sections = parseIni(ini);

      for (const [sectionName, values] of Object.entries(sections)) {
        if (!sectionName.startsWith("Profile")) continue;
        const relativePath = values.Path;
        if (!relativePath) continue;

        const directory =
          values.IsRelative === "0"
            ? relativePath
            : path.join(root, relativePath);

        candidates.push({
          directory,
          name: values.Name?.trim() || path.basename(directory),
          isDefault: values.Default === "1",
        });
      }
    } catch {
      // profiles.ini is optional; fall back to scanning.
    }

    let entries: Dirent[];
    try {
      entries = await readdir(root, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      candidates.push({
        directory: path.join(root, entry.name),
        name: entry.name,
        isDefault: false,
      });
    }
  }

  for (const candidate of candidates) {
    if (profiles.has(candidate.directory)) continue;
    if (!(await isDirectory(candidate.directory))) continue;

    const cookiePath = await findCookiePath(candidate.directory, "firefox");
    if (!cookiePath) continue;

    profiles.set(candidate.directory, {
      id: candidate.directory,
      name: candidate.name,
      path: candidate.directory,
      cookiePath,
      isDefault: candidate.isDefault,
    });
  }

  const list = [...profiles.values()];
  if (list.length > 0 && !list.some((profile) => profile.isDefault)) {
    // Prefer the conventional default-release profile, otherwise the first.
    const preferred = list.find((profile) =>
      profile.name.includes("default-release"),
    );
    (preferred ?? list[0]).isDefault = true;
  }

  list.sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return list;
}

/**
 * Scans the known installation paths for each supported browser. This only
 * reads directory metadata; cookie databases are touched on import.
 */
export async function detectBrowsers(): Promise<DetectedBrowser[]> {
  return Promise.all(
    BROWSER_DEFINITIONS.map(async (definition) => {
      const executablePath = await findExecutable(definition.binaries);
      const rootsExist = (
        await Promise.all(definition.roots.map((root) => isDirectory(root)))
      ).some(Boolean);

      const installed = Boolean(executablePath) || rootsExist;
      const supported = isFamilySupported(definition.family);

      let profiles: BrowserProfile[] = [];
      let note: string | undefined;

      if (!installed) {
        note = "Not detected on this system.";
      } else if (!supported) {
        note = "Cookie decryption is not implemented for this OS yet.";
      } else {
        profiles =
          definition.family === "chromium"
            ? await discoverChromiumProfiles(definition)
            : await discoverFirefoxProfiles(definition);
        if (profiles.length === 0) {
          note = "No profile with a cookie database was found.";
        }
      }

      return {
        id: definition.id,
        name: definition.name,
        family: definition.family,
        installed,
        executablePath,
        supported,
        profiles,
        note,
      } satisfies DetectedBrowser;
    }),
  );
}
