import os from "node:os";
import path from "node:path";
import { stat } from "node:fs/promises";
import type { BrowserFamily, BrowserId } from "./types.js";

export interface BrowserDefinition {
  id: BrowserId;
  name: string;
  family: BrowserFamily;
  /** libsecret application attribute used by Chromium on Linux. */
  keyringApp: string | null;
  roots: string[];
  binaries: string[];
}

const home = os.homedir();
const xdgConfig = process.env.XDG_CONFIG_HOME ?? path.join(home, ".config");
const localAppData =
  process.env.LOCALAPPDATA ?? path.join(home, "AppData", "Local");
const appData = process.env.APPDATA ?? path.join(home, "AppData", "Roaming");

/** Pick the path list for the current OS, falling back to Linux paths. */
function platformRoots(
  linux: string[],
  mac: string[],
  win: string[],
): string[] {
  if (process.platform === "darwin") return mac;
  if (process.platform === "win32") return win;
  return linux;
}

export const BROWSER_DEFINITIONS: BrowserDefinition[] = [
  {
    id: "brave",
    name: "Brave",
    family: "chromium",
    keyringApp: "brave",
    roots: platformRoots(
      [
        path.join(xdgConfig, "BraveSoftware", "Brave-Browser"),
        path.join(xdgConfig, "BraveSoftware", "Brave-Browser-Beta"),
        path.join(xdgConfig, "BraveSoftware", "Brave-Browser-Dev"),
      ],
      [
        path.join(
          home,
          "Library",
          "Application Support",
          "BraveSoftware",
          "Brave-Browser",
        ),
      ],
      [path.join(localAppData, "BraveSoftware", "Brave-Browser", "User Data")],
    ),
    binaries: platformRoots(
      ["brave-browser", "brave"],
      ["/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"],
      ["brave.exe"],
    ),
  },
  {
    id: "chrome",
    name: "Google Chrome",
    family: "chromium",
    keyringApp: "chrome",
    roots: platformRoots(
      [
        path.join(xdgConfig, "google-chrome"),
        path.join(xdgConfig, "google-chrome-beta"),
        path.join(xdgConfig, "google-chrome-unstable"),
      ],
      [path.join(home, "Library", "Application Support", "Google", "Chrome")],
      [path.join(localAppData, "Google", "Chrome", "User Data")],
    ),
    binaries: platformRoots(
      ["google-chrome", "google-chrome-stable"],
      ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"],
      ["chrome.exe"],
    ),
  },
  {
    id: "opera",
    name: "Opera",
    family: "chromium",
    keyringApp: "opera",
    roots: platformRoots(
      [
        path.join(xdgConfig, "opera"),
        path.join(xdgConfig, "opera-beta"),
        path.join(xdgConfig, "opera-developer"),
      ],
      [
        path.join(
          home,
          "Library",
          "Application Support",
          "com.operasoftware.Opera",
        ),
      ],
      [path.join(appData, "Opera Software", "Opera Stable")],
    ),
    binaries: platformRoots(
      ["opera"],
      ["/Applications/Opera.app/Contents/MacOS/Opera"],
      ["opera.exe"],
    ),
  },
  {
    id: "firefox",
    name: "Firefox",
    family: "firefox",
    keyringApp: null,
    roots: platformRoots(
      [path.join(home, ".mozilla", "firefox")],
      [path.join(home, "Library", "Application Support", "Firefox")],
      [path.join(appData, "Mozilla", "Firefox")],
    ),
    binaries: platformRoots(
      ["firefox", "firefox-esr"],
      ["/Applications/Firefox.app/Contents/MacOS/firefox"],
      ["firefox.exe"],
    ),
  },
];

export function browserDefinition(id: BrowserId): BrowserDefinition {
  const definition = BROWSER_DEFINITIONS.find((item) => item.id === id);
  if (!definition) throw new Error(`Unknown browser: ${id}`);
  return definition;
}

/**
 * Chromium cookie decryption is implemented for Linux (libsecret) in this
 * pass. Firefox stores cookies in plaintext, so it works everywhere.
 */
export function isFamilySupported(family: BrowserFamily): boolean {
  if (family === "firefox") return true;
  return process.platform === "linux";
}

export function isChromiumKeyringSupported(): boolean {
  return process.platform === "linux";
}

async function isFile(candidate: string): Promise<boolean> {
  try {
    return (await stat(candidate)).isFile();
  } catch {
    return false;
  }
}

export async function pathExists(candidate: string): Promise<boolean> {
  try {
    await stat(candidate);
    return true;
  } catch {
    return false;
  }
}

export async function isDirectory(candidate: string): Promise<boolean> {
  try {
    return (await stat(candidate)).isDirectory();
  } catch {
    return false;
  }
}

/** Resolve a binary name against PATH (or return an absolute path if given). */
export async function findExecutable(names: string[]): Promise<string | null> {
  const pathDirs = (process.env.PATH ?? "")
    .split(path.delimiter)
    .filter(Boolean);
  const extensions =
    process.platform === "win32"
      ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";").filter(Boolean)
      : [""];

  for (const name of names) {
    if (path.isAbsolute(name)) {
      if (await isFile(name)) return name;
      continue;
    }

    for (const dir of pathDirs) {
      for (const extension of extensions) {
        const suffix =
          extension && !name.toLowerCase().endsWith(extension.toLowerCase())
            ? extension
            : "";
        const candidate = path.join(dir, name + suffix);
        if (await isFile(candidate)) return candidate;
      }
    }
  }

  return null;
}

export function cookiePathCandidates(
  profileDir: string,
  family: BrowserFamily,
): string[] {
  if (family === "firefox") {
    return [path.join(profileDir, "cookies.sqlite")];
  }
  return [
    path.join(profileDir, "Cookies"),
    path.join(profileDir, "Network", "Cookies"),
  ];
}

export async function findCookiePath(
  profileDir: string,
  family: BrowserFamily,
): Promise<string | null> {
  for (const candidate of cookiePathCandidates(profileDir, family)) {
    if (await isFile(candidate)) return candidate;
  }
  return null;
}

/** Roots that the folder picker can offer as shortcuts. */
export async function knownBrowserRoots(): Promise<
  Array<{ name: string; path: string }>
> {
  const roots: Array<{ name: string; path: string }> = [];
  for (const definition of BROWSER_DEFINITIONS) {
    for (const root of definition.roots) {
      if (await isDirectory(root)) {
        roots.push({ name: definition.name, path: root });
      }
    }
  }
  return roots;
}
