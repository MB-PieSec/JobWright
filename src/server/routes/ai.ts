import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  clearAiKey,
  getAiState,
  saveAiConfig,
  testAiConnection,
} from "../../llm/config.js";
import { isProviderId, PROVIDER_IDS } from "../../llm/providers.js";

const ProviderIdSchema = z.enum(PROVIDER_IDS);

const SaveBody = z
  .object({
    provider: ProviderIdSchema,
    model: z.string().trim().min(1).max(200),
    /** A string replaces the saved key; null removes it. */
    apiKey: z.string().trim().min(1).max(4096).nullable().optional(),
  })
  .strict();

const TestBody = z
  .object({
    provider: ProviderIdSchema,
    model: z.string().trim().min(1).max(200),
    apiKey: z.string().trim().max(4096).optional(),
  })
  .strict();

const aiRoutes: FastifyPluginAsync = async (app) => {
  app.get("/ai", async () => getAiState());

  app.put("/ai", async (req, reply) => {
    const parsed = SaveBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "Invalid request body",
        issues: parsed.error.issues,
      });
    }

    try {
      return await saveAiConfig(parsed.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.code(400).send({ error: message });
    }
  });

  app.post("/ai/test", async (req, reply) => {
    const parsed = TestBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "Invalid request body",
        issues: parsed.error.issues,
      });
    }

    try {
      return await testAiConnection(parsed.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.code(502).send({ error: message });
    }
  });

  app.delete<{ Params: { provider: string } }>(
    "/ai/keys/:provider",
    async (req, reply) => {
      if (!isProviderId(req.params.provider)) {
        return reply.code(400).send({ error: "Unknown AI provider" });
      }

      return clearAiKey(req.params.provider);
    },
  );
};

export default aiRoutes;
