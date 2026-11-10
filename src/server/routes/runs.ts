import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  platformRegistry,
  type PlatformName,
} from "../../platforms/registry.js";
import { runSearch } from "../../pipeline/runSearch.js";
import { runApply, toApplyRunSummaryJson } from "../../pipeline/runApply.js";
import { loadProfile, ProfileNotFoundError } from "../../resume/loadProfile.js";
import { maybeAutoImportCookies } from "../../cookies/import.js";
import type { PipelineEvent } from "../../pipeline/types.js";
import {
  cancelRun,
  getRun,
  getRunEvents,
  listRuns,
  startRun,
  subscribeToRun,
  type RunKind,
  type RunStatus,
} from "../runs/manager.js";
import { processedJobUrls } from "../runs/resume.js";

const PLATFORMS = Object.keys(platformRegistry) as [
  PlatformName,
  ...PlatformName[],
];
const PROFILE_PATH = process.env.JOBWRIGHT_PROFILE_PATH ?? "./profile.json";

const SearchBody = z
  .object({
    kind: z.literal("search"),
    platform: z.enum(PLATFORMS).default("jobinja"),
    keyword: z.string().min(1).max(200).default("backend"),
    maxPages: z.number().int().min(1).max(50).default(3),
    minScore: z.number().int().min(0).max(100).default(70),
    reasoningLength: z.number().int().min(1).max(2000).default(200),
    hardMatch: z.boolean().default(false),
    skipFilters: z.boolean().default(false),
    /** Absent = experience filter disabled; present = tolerance in years. */
    experienceTolerance: z.number().min(0).max(20).optional(),
  })
  .strict();

const ApplyBody = z
  .object({
    kind: z.literal("apply"),
    liveApply: z.boolean().default(false),
    retryErrors: z.boolean().default(false),
    maxApplies: z.number().int().min(0).default(0),
    minScore: z.number().int().min(0).max(100).default(70),
    /** When present, only these jobs are considered. [] means none. */
    jobIds: z.array(z.number().int().positive()).optional(),
  })
  .strict();

const StartRunBody = z.discriminatedUnion("kind", [SearchBody, ApplyBody]);

const idParamsSchema = {
  type: "object",
  properties: { id: { type: "integer", minimum: 1 } },
  required: ["id"],
} as const;

const RUN_KINDS: RunKind[] = ["search", "apply"];
const RUN_STATUSES: RunStatus[] = [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
];

type SearchBodyInput = z.infer<typeof SearchBody>;

/**
 * Loads the profile and queues a search run. Shared by the start and resume
 * endpoints so both paths build identical SearchOptions.
 */
async function startSearchRun(
  body: SearchBodyInput,
  extra: { skipJobUrls?: string[]; resumedFrom?: number } = {},
): Promise<number> {
  const profile = await loadProfile(PROFILE_PATH, { interactive: false });

  return startRun("search", body, async (emit, signal) => {
    const { summary } = await runSearch(
      {
        platform: body.platform,
        keyword: body.keyword,
        maxPages: body.maxPages,
        minScore: body.minScore,
        reasoningMaxLength: body.reasoningLength,
        hardMatch: body.hardMatch,
        skipFilters: body.skipFilters,
        experienceTolerance: body.experienceTolerance ?? 0,
        profile,
        skipJobUrls: extra.skipJobUrls,
        resumedFrom: extra.resumedFrom,
      },
      emit,
      signal,
    );
    return { kind: "search", summary };
  });
}

const runsRoutes: FastifyPluginAsync = async (app) => {
  app.post("/runs", async (req, reply) => {
    const parsed = StartRunBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "Invalid request body",
        issues: parsed.error.issues,
      });
    }

    const body = parsed.data;

    if (body.kind === "search") {
      try {
        const runId = await startSearchRun(body);
        return reply.code(202).send({ runId, status: "queued" });
      } catch (err) {
        if (err instanceof ProfileNotFoundError) {
          return reply.code(400).send({ error: err.message });
        }
        throw err;
      }
    }

    if (body.liveApply) {
      try {
        await maybeAutoImportCookies();
      } catch (error) {
        // Auto-import is a convenience; a stale browser path must not block a
        // run that may already have a valid cookies.json.
        req.log.warn(
          { err: error },
          "Cookie auto-import failed; continuing with the existing cookies file",
        );
      }
    }

    const runId = startRun("apply", body, async (emit, signal) => {
      const { summary } = await runApply(
        {
          minScore: body.minScore,
          liveApply: body.liveApply,
          retryErrors: body.retryErrors,
          maxApplies: body.maxApplies,
          jobIds: body.jobIds,
        },
        emit,
        signal,
      );
      return { kind: "apply", summary: toApplyRunSummaryJson(summary) };
    });

    return reply.code(202).send({ runId, status: "queued" });
  });

  app.get<{
    Querystring: {
      limit?: number;
      offset?: number;
      kind?: RunKind;
      status?: RunStatus;
    };
  }>(
    "/runs",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
            offset: { type: "integer", minimum: 0, default: 0 },
            kind: { type: "string", enum: RUN_KINDS },
            status: { type: "string", enum: RUN_STATUSES },
          },
        },
      },
    },
    async (req) => {
      const { limit = 50, offset = 0, kind, status } = req.query;
      return listRuns({ limit, offset, kind, status });
    },
  );

  app.get<{ Params: { id: number } }>(
    "/runs/:id",
    { schema: { params: idParamsSchema } },
    async (req, reply) => {
      const run = getRun(req.params.id);
      if (!run) {
        return reply.code(404).send({ error: "Run not found" });
      }
      return run;
    },
  );

  app.post<{ Params: { id: number } }>(
    "/runs/:id/stop",
    { schema: { params: idParamsSchema } },
    async (req, reply) => {
      const run = getRun(req.params.id);
      if (!run) {
        return reply.code(404).send({ error: "Run not found" });
      }
      if (run.status !== "queued" && run.status !== "running") {
        return reply.code(409).send({ error: `Run is already ${run.status}` });
      }

      const result = cancelRun(run.id);
      if (result === "not_found") {
        return reply.code(404).send({ error: "Run not found" });
      }
      if (result === "not_cancellable") {
        return reply.code(409).send({ error: "Run is no longer running" });
      }

      return reply.code(202).send({ runId: run.id, status: "cancelling" });
    },
  );

  app.post<{ Params: { id: number } }>(
    "/runs/:id/resume",
    { schema: { params: idParamsSchema } },
    async (req, reply) => {
      const run = getRun(req.params.id);
      if (!run) {
        return reply.code(404).send({ error: "Run not found" });
      }
      if (run.kind !== "search") {
        return reply
          .code(400)
          .send({ error: "Only search runs can be resumed" });
      }
      if (run.status !== "cancelled") {
        return reply
          .code(409)
          .send({ error: "Only stopped search runs can be resumed" });
      }

      // Stored params come from the same strict schema, so re-parsing keeps a
      // resumed run on exactly the same settings as the original.
      const parsed = SearchBody.safeParse(run.params);
      if (!parsed.success) {
        return reply
          .code(500)
          .send({ error: "Stored run parameters are invalid" });
      }

      try {
        const runId = await startSearchRun(parsed.data, {
          skipJobUrls: processedJobUrls(getRunEvents(run.id)),
          resumedFrom: run.id,
        });
        return reply
          .code(202)
          .send({ runId, status: "queued", resumedFrom: run.id });
      } catch (err) {
        if (err instanceof ProfileNotFoundError) {
          return reply.code(400).send({ error: err.message });
        }
        throw err;
      }
    },
  );

  // Server-Sent Events: replays past events (honoring Last-Event-ID), then
  // streams live ones until the run finishes.
  app.get<{ Params: { id: number } }>(
    "/runs/:id/events",
    { schema: { params: idParamsSchema } },
    async (req, reply) => {
      const run = getRun(req.params.id);
      if (!run) {
        return reply.code(404).send({ error: "Run not found" });
      }

      const lastEventId = req.headers["last-event-id"];
      const fromSeq =
        typeof lastEventId === "string" ? Number(lastEventId) || 0 : 0;

      reply.hijack();
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      reply.raw.write(": connected\n\n");

      const finish = () => {
        if (!reply.raw.writableEnded) reply.raw.end();
      };

      const send = (event: PipelineEvent, seq: number) => {
        if (reply.raw.writableEnded) return;
        try {
          reply.raw.write(
            `id: ${seq}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
          );
        } catch {
          finish();
          return;
        }
        if (
          event.type === "run_finished" ||
          event.type === "run_failed" ||
          event.type === "run_cancelled"
        ) {
          finish();
        }
      };

      if (
        run.status === "completed" ||
        run.status === "failed" ||
        run.status === "cancelled"
      ) {
        const events = getRunEvents(run.id);
        for (let i = fromSeq; i < events.length; i++) {
          send(events[i], i + 1);
        }
        finish();
        return;
      }

      const unsubscribe = subscribeToRun(run.id, send, fromSeq);
      if (!unsubscribe) {
        finish();
        return;
      }

      const heartbeat = setInterval(() => {
        if (!reply.raw.writableEnded) reply.raw.write(": ping\n\n");
      }, 15_000);

      req.raw.on("close", () => {
        clearInterval(heartbeat);
        unsubscribe();
      });
    },
  );
};

export default runsRoutes;
