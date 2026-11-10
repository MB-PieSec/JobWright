import type { FastifyPluginAsync } from "fastify";

const idParamsSchema = {
  type: "object",
  properties: { id: { type: "integer", minimum: 1 } },
  required: ["id"],
} as const;

const jobRoutes: FastifyPluginAsync = async (app) => {
  const getStmt = app.db.prepare("SELECT * FROM jobs WHERE id = ?");
  const deleteStmt = app.db.prepare("DELETE FROM jobs WHERE id = ?");

  app.get<{ Params: { id: number } }>(
    "/jobs/:id",
    { schema: { params: idParamsSchema } },
    async (req, reply) => {
      const job = getStmt.get(req.params.id);
      if (!job) {
        return reply.code(404).send({ error: "Job not found" });
      }
      return job;
    },
  );

  app.delete<{ Params: { id: number } }>(
    "/jobs/:id",
    { schema: { params: idParamsSchema } },
    async (req, reply) => {
      const { changes } = deleteStmt.run(req.params.id);
      if (changes === 0) {
        return reply.code(404).send({ error: "Job not found" });
      }
      return reply.code(204).send();
    },
  );
};

export default jobRoutes;
