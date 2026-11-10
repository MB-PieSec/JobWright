import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { effectiveCookiesPath } from "../../cookies/import.js";
import type { CookieImportResult, CookieSource } from "../../cookies/types.js";
import {
  getBrowserDebugMode,
  setBrowserDebugMode,
} from "../../settings/browserMode.js";
import { getSetting, setSetting } from "../../settings/store.js";

const CookieSourceSchema = z
  .object({
    browserId: z.enum(["brave", "chrome", "opera", "firefox"]),
    profilePath: z.string().min(1),
    autoImport: z.boolean(),
  })
  .strict();

const SettingsBody = z
  .object({
    cookiesSource: CookieSourceSchema.nullable().optional(),
    /** True shows the Chromium window; false (default) runs headless. */
    browserDebugMode: z.boolean().optional(),
  })
  .strict();

function currentSettings() {
  return {
    cookies: {
      path: effectiveCookiesPath(),
      source: getSetting<CookieSource>("cookies.source"),
      lastImport: getSetting<CookieImportResult>("cookies.lastImport"),
    },
    browser: {
      debugMode: getBrowserDebugMode(),
    },
  };
}

const settingsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/settings", async () => currentSettings());

  app.put("/settings", async (req, reply) => {
    const parsed = SettingsBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "Invalid request body",
        issues: parsed.error.issues,
      });
    }

    if (parsed.data.cookiesSource !== undefined) {
      setSetting("cookies.source", parsed.data.cookiesSource);
    }

    if (parsed.data.browserDebugMode !== undefined) {
      setBrowserDebugMode(parsed.data.browserDebugMode);
    }

    return currentSettings();
  });
};

export default settingsRoutes;
