import os from "node:os";
import path from "node:path";
import type { Dirent } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import type { FastifyPluginAsync } from "fastify";
import { knownBrowserRoots } from "../../cookies/definitions.js";

const BROWSER_ROOT_NAMES = new Set([
  "Brave-Browser",
  "Brave-Browser-Beta",
  "Brave-Browser-Dev",
  "BraveSoftware",
  "google-chrome",
  "google-chrome-beta",
  "google-chrome-unstable",
  "chromium",
  "opera",
  "opera-beta",
  "opera-developer",
  "firefox",
  "Mozilla",
  "User Data",
]);

const MAX_ENTRIES = 500;

function expandUserPath(value: string): string {
  if (value === "~") return os.homedir();
  if (value.startsWith("~/")) {
    return path.join(os.homedir(), value.slice(2));
  }
  return value;
}

async function isFile(candidate: string): Promise<boolean> {
  try {
    return (await stat(candidate)).isFile();
  } catch {
    return false;
  }
}

async function isDirectory(candidate: string): Promise<boolean> {
  try {
    return (await stat(candidate)).isDirectory();
  } catch {
    return false;
  }
}

/** A folder is interesting if it directly holds a cookie database. */
async function hasCookieDatabase(directory: string): Promise<boolean> {
  return (
    (await isFile(path.join(directory, "Cookies"))) ||
    (await isFile(path.join(directory, "Network", "Cookies"))) ||
    (await isFile(path.join(directory, "cookies.sqlite")))
  );
}

async function isDirectoryEntry(
  parent: string,
  entry: Dirent,
): Promise<boolean> {
  if (entry.isDirectory()) return true;
  if (!entry.isSymbolicLink()) return false;

  try {
    return (await stat(path.join(parent, entry.name))).isDirectory();
  } catch {
    return false;
  }
}

interface FsEntry {
  name: string;
  path: string;
  isBrowserRoot: boolean;
  hasCookies: boolean;
}

const fsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/fs/roots", async () => {
    const home = os.homedir();
    return {
      home,
      filesystemRoot: path.parse(home).root,
      known: await knownBrowserRoots(),
    };
  });

  app.get<{ Querystring: { path?: string } }>(
    "/fs/list",
    {
      schema: {
        querystring: {
          type: "object",
          properties: { path: { type: "string", maxLength: 4096 } },
        },
      },
    },
    async (req, reply) => {
      const requested = req.query.path
        ? expandUserPath(req.query.path)
        : os.homedir();
      const directory = path.resolve(requested);

      if (!(await isDirectory(directory))) {
        return reply.code(400).send({ error: `Not a directory: ${directory}` });
      }

      let dirents;
      try {
        dirents = await readdir(directory, { withFileTypes: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return reply.code(403).send({ error: message });
      }

      const knownRoots = new Set(
        (await knownBrowserRoots()).map((root) => path.resolve(root.path)),
      );

      const entries: FsEntry[] = [];
      for (const dirent of dirents) {
        if (!(await isDirectoryEntry(directory, dirent))) continue;

        const entryPath = path.join(directory, dirent.name);
        entries.push({
          name: dirent.name,
          path: entryPath,
          isBrowserRoot:
            knownRoots.has(entryPath) || BROWSER_ROOT_NAMES.has(dirent.name),
          hasCookies: await hasCookieDatabase(entryPath),
        });
      }

      entries.sort((a, b) => {
        if (a.isBrowserRoot !== b.isBrowserRoot)
          return a.isBrowserRoot ? -1 : 1;
        if (a.hasCookies !== b.hasCookies) return a.hasCookies ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      const truncated = entries.length > MAX_ENTRIES;
      const parent = path.dirname(directory);

      return {
        path: directory,
        parent: parent === directory ? null : parent,
        entries: entries.slice(0, MAX_ENTRIES),
        truncated,
      };
    },
  );
};

export default fsRoutes;
