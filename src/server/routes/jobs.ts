import type { FastifyPluginAsync } from "fastify";
import { JOB_STATUSES } from "../../jobs/statuses.js";

const STATUSES = JOB_STATUSES;

// Whitelist: column names can't be bound as parameters, so map
// user input to known columns instead of interpolating it.
const SORT_COLUMNS = {
  score: "score",
  updated: "updated_at",
  seen: "first_seen_at",
  title: "title",
  platform: "platform",
} as const;

interface JobsQuery {
  status?: string[];
  platform?: string[];
  minScore?: number;
  maxScore?: number;
  q?: string;
  seenAfter?: string;
  seenBefore?: string;
  sort?: keyof typeof SORT_COLUMNS;
  order?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

const datePattern = "^\\d{4}-\\d{2}-\\d{2}";

const jobsRoutes: FastifyPluginAsync = async (app) => {
  const wipe = app.db.transaction(() => {
    const { changes } = app.db.prepare("DELETE FROM jobs").run();
    app.db.prepare("DELETE FROM sqlite_sequence WHERE name = 'jobs'").run();
    return changes;
  });

  app.get<{ Querystring: JobsQuery }>(
    "/jobs",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            status: {
              type: "array",
              items: { type: "string", enum: STATUSES },
            },
            platform: { type: "array", items: { type: "string" } },
            minScore: { type: "integer" },
            maxScore: { type: "integer" },
            q: { type: "string", maxLength: 200 },
            seenAfter: { type: "string", pattern: datePattern },
            seenBefore: { type: "string", pattern: datePattern },
            sort: { type: "string", enum: Object.keys(SORT_COLUMNS) },
            order: { type: "string", enum: ["asc", "desc"] },
            limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
            offset: { type: "integer", minimum: 0, default: 0 },
          },
        },
      },
    },
    async (req) => {
      const {
        status,
        platform,
        minScore,
        maxScore,
        q,
        seenAfter,
        seenBefore,
        sort = "score",
        order = "desc",
        limit = 50,
        offset = 0,
      } = req.query;

      const where: string[] = [];
      const params: unknown[] = [];

      if (status?.length) {
        where.push(`status IN (${status.map(() => "?").join(",")})`);
        params.push(...status);
      }
      if (platform?.length) {
        where.push(`platform IN (${platform.map(() => "?").join(",")})`);
        params.push(...platform);
      }
      if (minScore !== undefined) {
        where.push("score >= ?");
        params.push(minScore);
      }
      if (maxScore !== undefined) {
        where.push("score <= ?");
        params.push(maxScore);
      }
      if (q) {
        // Escape LIKE wildcards so a literal "%" or "_" in the search matches itself
        const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
        where.push("(title LIKE ? ESCAPE '\\' OR url LIKE ? ESCAPE '\\')");
        params.push(pattern, pattern);
      }
      if (seenAfter) {
        where.push("first_seen_at >= ?");
        params.push(seenAfter);
      }
      if (seenBefore) {
        where.push("first_seen_at < ?");
        params.push(seenBefore);
      }

      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const direction = order === "asc" ? "ASC" : "DESC";

      const total = (
        app.db
          .prepare(`SELECT COUNT(*) AS n FROM jobs ${whereSql}`)
          .get(...params) as { n: number }
      ).n;

      // id as tie-breaker keeps pagination stable when many rows share a sort value
      const data = app.db
        .prepare(
          `SELECT * FROM jobs ${whereSql}
           ORDER BY ${SORT_COLUMNS[sort]} ${direction}, id DESC
           LIMIT ? OFFSET ?`,
        )
        .all(...params, limit, offset);

      return { data, total, limit, offset };
    },
  );

  // Wipe all jobs and reset IDs to start from 1
  app.delete<{ Querystring: { confirm?: string } }>(
    "/jobs",
    async (req, reply) => {
      if (req.query.confirm !== "yes") {
        return reply
          .code(400)
          .send({ error: "Add ?confirm=yes to wipe all jobs" });
      }
      return { deleted: wipe() };
    },
  );
};

export default jobsRoutes;
