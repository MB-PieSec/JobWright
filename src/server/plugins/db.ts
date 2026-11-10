// src/server/plugins/db.ts
import fp from "fastify-plugin";
import type Database from "better-sqlite3";
import { db } from "../../db/client.js";

declare module "fastify" {
  interface FastifyInstance {
    db: Database.Database;
  }
}

export default fp(async (app) => {
  app.decorate("db", db);
  app.addHook("onClose", async () => db.close());
});
