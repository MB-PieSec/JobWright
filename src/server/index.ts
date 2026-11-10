import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ZodError } from "zod";
import dbPlugin from "./plugins/db.js";
import jobsRoutes from "./routes/jobs.js";
import jobRoutes from "./routes/job.js";
import runsRoutes from "./routes/runs.js";
import profileRoutes from "./routes/profile.js";
import resumeRoutes from "./routes/resume.js";
import aiRoutes from "./routes/ai.js";
import notificationsRoutes from "./routes/notifications.js";
import statsRoutes from "./routes/stats.js";
import settingsRoutes from "./routes/settings.js";
import cookiesRoutes from "./routes/cookies.js";
import fsRoutes from "./routes/fs.js";
import { recoverStaleRuns } from "./runs/manager.js";

const app = Fastify({ logger: true });

const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
  : ["http://localhost:5173", "http://127.0.0.1:5173"];

await app.register(cors, { origin: corsOrigins });
await app.register(dbPlugin);
recoverStaleRuns();

await app.register(jobRoutes, { prefix: "/api" });
await app.register(jobsRoutes, { prefix: "/api" });
await app.register(runsRoutes, { prefix: "/api" });
await app.register(profileRoutes, { prefix: "/api" });
await app.register(resumeRoutes, { prefix: "/api" });
await app.register(aiRoutes, { prefix: "/api" });
await app.register(notificationsRoutes, { prefix: "/api" });
await app.register(statsRoutes, { prefix: "/api" });
await app.register(settingsRoutes, { prefix: "/api" });
await app.register(cookiesRoutes, { prefix: "/api" });
await app.register(fsRoutes, { prefix: "/api" });

app.get("/api/health", async () => ({ ok: true }));

// Serve the built SPA when it exists. In development the Vite dev server
// handles the frontend and talks to this API via CORS.
const webDist = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../web/dist",
);

if (existsSync(webDist)) {
  await app.register(fastifyStatic, { root: webDist });

  app.setNotFoundHandler((req, reply) => {
    if (req.method === "GET" && !req.url.startsWith("/api/")) {
      return reply.sendFile("index.html");
    }
    return reply.code(404).send({ error: "Not found" });
  });
} else {
  app.setNotFoundHandler((_req, reply) =>
    reply.code(404).send({ error: "Not found" }),
  );
}

app.setErrorHandler((err, req, reply) => {
  if (err instanceof ZodError) {
    return reply
      .code(400)
      .send({ error: "Validation failed", issues: err.issues });
  }

  const error = err as { statusCode?: number; message?: string };
  const statusCode = error.statusCode ?? 500;
  if (statusCode >= 500) {
    req.log.error(err);
  }
  return reply
    .code(statusCode)
    .send({ error: error.message ?? "Internal Server Error" });
});

const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? 3000);

await app.listen({ host, port });
