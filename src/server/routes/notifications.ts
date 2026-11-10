import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  clearTelegramConfig,
  getNotificationsState,
  saveTelegramConfig,
  testTelegramConnection,
} from "../../notifications/config.js";

const SaveBody = z
  .object({
    /** A string replaces the saved token; null removes it. */
    botToken: z.string().trim().max(512).nullable().optional(),
    /** A string replaces the saved chat ID; null removes it. */
    chatId: z.string().trim().max(128).nullable().optional(),
  })
  .strict();

const TestBody = z
  .object({
    botToken: z.string().trim().max(512).optional(),
    chatId: z.string().trim().max(128).optional(),
  })
  .strict();

const notificationsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/notifications", async () => getNotificationsState());

  app.put("/notifications", async (req, reply) => {
    const parsed = SaveBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "Invalid request body",
        issues: parsed.error.issues,
      });
    }

    try {
      return await saveTelegramConfig(parsed.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.code(400).send({ error: message });
    }
  });

  app.post("/notifications/test", async (req, reply) => {
    const parsed = TestBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({
        error: "Invalid request body",
        issues: parsed.error.issues,
      });
    }

    try {
      return await testTelegramConnection(parsed.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.code(502).send({ error: message });
    }
  });

  app.delete("/notifications/telegram", async () => clearTelegramConfig());
};

export default notificationsRoutes;
