import type { FastifyPluginAsync } from "fastify";
import { loadProfile, ProfileNotFoundError } from "../../resume/loadProfile.js";

const PROFILE_PATH = process.env.JOBWRIGHT_PROFILE_PATH ?? "./profile.json";

const profileRoutes: FastifyPluginAsync = async (app) => {
  app.get("/profile", async (_req, reply) => {
    try {
      return await loadProfile(PROFILE_PATH, { interactive: false });
    } catch (err) {
      if (err instanceof ProfileNotFoundError) {
        return reply.code(404).send({ error: err.message });
      }
      throw err;
    }
  });
};

export default profileRoutes;
