import type { FastifyPluginAsync } from "fastify";
import { JOB_STATUSES } from "../../jobs/statuses.js";
import { listRuns } from "../runs/manager.js";

const RUN_STATUSES = [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;
const RUN_KINDS = ["search", "apply"] as const;
const ACTIVITY_DAYS = 14;

function countMap(
  rows: Array<{ key: string; count: number }>,
  keys: readonly string[],
): Record<string, number> {
  const result: Record<string, number> = Object.fromEntries(
    keys.map((key) => [key, 0]),
  );
  for (const row of rows) result[row.key] = row.count;
  return result;
}

const statsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/stats", async () => {
    const total = (
      app.db.prepare("SELECT COUNT(*) AS n FROM jobs").get() as { n: number }
    ).n;

    const byStatus = countMap(
      app.db
        .prepare(
          "SELECT status AS key, COUNT(*) AS count FROM jobs GROUP BY status",
        )
        .all() as Array<{ key: string; count: number }>,
      JOB_STATUSES,
    );

    const byPlatform = countMap(
      app.db
        .prepare(
          "SELECT platform AS key, COUNT(*) AS count FROM jobs GROUP BY platform",
        )
        .all() as Array<{ key: string; count: number }>,
      [],
    );

    const scoreBuckets = app.db
      .prepare(
        `SELECT CASE WHEN score >= 90 THEN 90 ELSE (score / 10) * 10 END AS bucket,
                COUNT(*) AS count
         FROM jobs
         WHERE score IS NOT NULL
         GROUP BY bucket
         ORDER BY bucket`,
      )
      .all() as Array<{ bucket: number; count: number }>;

    const average = app.db
      .prepare("SELECT AVG(score) AS average, COUNT(score) AS scored FROM jobs")
      .get() as { average: number | null; scored: number };

    const lastUpdatedAt = (
      app.db.prepare("SELECT MAX(updated_at) AS value FROM jobs").get() as {
        value: string | null;
      }
    ).value;

    const runByStatus = countMap(
      app.db
        .prepare(
          "SELECT status AS key, COUNT(*) AS count FROM runs GROUP BY status",
        )
        .all() as Array<{ key: string; count: number }>,
      RUN_STATUSES,
    );

    const runByKind = countMap(
      app.db
        .prepare(
          "SELECT kind AS key, COUNT(*) AS count FROM runs GROUP BY kind",
        )
        .all() as Array<{ key: string; count: number }>,
      RUN_KINDS,
    );

    const totalRuns = (
      app.db.prepare("SELECT COUNT(*) AS n FROM runs").get() as { n: number }
    ).n;

    // Fourteen days of activity, newest last. The CLI writes ISO timestamps,
    // so the first ten characters are the UTC calendar date.
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - (ACTIVITY_DAYS - 1));
    const cutoff = start.toISOString();

    const seenRows = app.db
      .prepare(
        `SELECT substr(first_seen_at, 1, 10) AS date, COUNT(*) AS count
         FROM jobs WHERE first_seen_at >= ?
         GROUP BY date`,
      )
      .all(cutoff) as Array<{ date: string; count: number }>;

    const appliedRows = app.db
      .prepare(
        `SELECT substr(updated_at, 1, 10) AS date, COUNT(*) AS count
         FROM jobs WHERE status = 'applied' AND updated_at >= ?
         GROUP BY date`,
      )
      .all(cutoff) as Array<{ date: string; count: number }>;

    const seenByDate = new Map(seenRows.map((row) => [row.date, row.count]));
    const appliedByDate = new Map(
      appliedRows.map((row) => [row.date, row.count]),
    );

    const activity = Array.from({ length: ACTIVITY_DAYS }, (_, index) => {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + index);
      const key = date.toISOString().slice(0, 10);
      return {
        date: key,
        seen: seenByDate.get(key) ?? 0,
        applied: appliedByDate.get(key) ?? 0,
      };
    });

    return {
      total,
      byStatus,
      byPlatform,
      scoreBuckets,
      averageScore:
        average.average === null ? null : Math.round(average.average * 10) / 10,
      scoredCount: average.scored,
      lastUpdatedAt,
      activity,
      runs: {
        total: totalRuns,
        byStatus: runByStatus,
        byKind: runByKind,
      },
      recentRuns: listRuns({ limit: 5 }).data,
    };
  });
};

export default statsRoutes;
