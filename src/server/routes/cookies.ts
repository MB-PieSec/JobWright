import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { detectBrowsers } from "../../cookies/detect.js";
import { importCookies } from "../../cookies/import.js";
import { setSetting } from "../../settings/store.js";

const ImportBody = z
  .object({
    browserId: z.enum(["brave", "chrome", "opera", "firefox"]),
    /** Optional: a profile or browser user-data folder picked by the user. */
    profilePath: z.string().min(1).optional(),
  })
  .strict();

const cookiesRoutes: FastifyPluginAsync = async (app) => {
  app.get("/cookies/browsers", async () => ({
    platform: process.platform,
    browsers: await detectBrowsers(),
  }));

  app.post("/cookies/import", async (req, reply) => {
    const parsed = ImportBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "Invalid request body",
        issues: parsed.error.issues,
      });
    }

    try {
      const result = await importCookies(parsed.data);
      setSetting("cookies.lastImport", result);
      return result;
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
};

export default cookiesRoutes;
