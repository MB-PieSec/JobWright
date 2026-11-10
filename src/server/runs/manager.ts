import { db } from "../../db/client.js";
import type {
  PipelineEvent,
  PipelineResult,
  ProgressListener,
} from "../../pipeline/types.js";

export type RunKind = "search" | "apply";
export type RunStatus =
  "queued" | "running" | "completed" | "failed" | "cancelled";

export interface RunRecord {
  id: number;
  kind: RunKind;
  status: RunStatus;
  params: unknown;
  result: PipelineResult | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

interface RunRow {
  id: number;
  kind: RunKind;
  status: RunStatus;
  params: string;
  result: string | null;
  events: string | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

interface RunState {
  events: PipelineEvent[];
  subscribers: Set<(event: PipelineEvent, seq: number) => void>;
  emit: ProgressListener;
}

export type RunExecutor = (
  emit: ProgressListener,
  signal: AbortSignal,
) => Promise<PipelineResult>;

const states = new Map<number, RunState>();
const controllers = new Map<number, AbortController>();

// Runs share a single Puppeteer browser and mutate the same DB, so they are
// serialized rather than allowed to overlap.
let queue: Promise<unknown> = Promise.resolve();

function now(): string {
  return new Date().toISOString();
}

function insertRun(kind: RunKind, params: unknown): number {
  const info = db
    .prepare(
      `INSERT INTO runs (kind, status, params, created_at) VALUES (?, 'queued', ?, ?)`,
    )
    .run(kind, JSON.stringify(params), now());
  return Number(info.lastInsertRowid);
}

function updateRun(
  id: number,
  fields: Partial<{
    status: RunStatus;
    result: string | null;
    events: string | null;
    error: string | null;
    started_at: string | null;
    finished_at: string | null;
  }>,
): void {
  const entries = Object.entries(fields);
  if (entries.length === 0) return;

  const sql = `UPDATE runs SET ${entries.map(([key]) => `${key} = @${key}`).join(", ")} WHERE id = @id`;
  db.prepare(sql).run({ id, ...fields });
}

function hasCancelledEvent(state: RunState): boolean {
  return state.events.some((event) => event.type === "run_cancelled");
}

/** Marks a run stopped, emitting `run_cancelled` at most once. */
function markCancelled(id: number, state: RunState, reason: string): void {
  if (!hasCancelledEvent(state)) {
    state.emit({ type: "run_cancelled", reason });
  }
  updateRun(id, {
    status: "cancelled",
    events: JSON.stringify(state.events),
    finished_at: now(),
  });
}

export function startRun(
  kind: RunKind,
  params: unknown,
  executor: RunExecutor,
): number {
  const id = insertRun(kind, params);
  const controller = new AbortController();
  controllers.set(id, controller);

  const state: RunState = {
    events: [],
    subscribers: new Set(),
    emit: () => {},
  };
  states.set(id, state);

  const emit: ProgressListener = (event) => {
    state.events.push(event);
    const seq = state.events.length;
    for (const subscriber of state.subscribers) {
      try {
        subscriber(event, seq);
      } catch {
        // A broken SSE connection must never abort the actual run.
        state.subscribers.delete(subscriber);
      }
    }
  };
  state.emit = emit;

  const task = queue.then(async () => {
    try {
      // A queued run may have been stopped before it reached the front of the
      // queue. cancelRun() already persisted the cancelled state in that case.
      if (controller.signal.aborted) {
        if (!hasCancelledEvent(state)) {
          markCancelled(id, state, "Stopped before starting");
        }
        return;
      }

      updateRun(id, { status: "running", started_at: now() });

      try {
        const result = await executor(emit, controller.signal);
        updateRun(id, {
          status: "completed",
          result: JSON.stringify(result),
          events: JSON.stringify(state.events),
          finished_at: now(),
        });
      } catch (err) {
        if (controller.signal.aborted) {
          markCancelled(id, state, "Stopped by user");
          return;
        }

        const message = err instanceof Error ? err.message : String(err);
        emit({ type: "run_failed", error: message });
        updateRun(id, {
          status: "failed",
          error: message,
          events: JSON.stringify(state.events),
          finished_at: now(),
        });
      }
    } finally {
      controllers.delete(id);
    }
  });

  // Keep the chain alive even if a run's DB bookkeeping throws.
  queue = task.catch(() => {});
  return id;
}

export type CancelRunResult = "cancelled" | "not_found" | "not_cancellable";

/**
 * Requests a stop. Running pipelines abort at their next safe boundary; a
 * queued run is marked cancelled immediately so the UI does not have to wait
 * for the run ahead of it to finish.
 */
export function cancelRun(id: number): CancelRunResult {
  const run = getRun(id);
  if (!run) return "not_found";
  if (run.status !== "queued" && run.status !== "running") {
    return "not_cancellable";
  }

  const controller = controllers.get(id);
  if (!controller) return "not_cancellable";

  controller.abort();

  if (run.status === "queued") {
    const state = states.get(id);
    if (state) markCancelled(id, state, "Stopped before starting");
  }

  return "cancelled";
}

/**
 * Marks runs left queued/running by a previous process as failed. Called once
 * at server startup — never from the shared DB module, because the CLI also
 * imports that and must not clobber a live server's runs.
 */
export function recoverStaleRuns(): number {
  const info = db
    .prepare(
      `UPDATE runs
       SET status = 'failed',
           error = 'Server restarted before the run finished',
           finished_at = ?
       WHERE status IN ('queued', 'running')`,
    )
    .run(now());
  return info.changes;
}

function rowToRecord(row: RunRow): RunRecord {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    params: JSON.parse(row.params),
    result: row.result ? (JSON.parse(row.result) as PipelineResult) : null,
    error: row.error,
    created_at: row.created_at,
    started_at: row.started_at,
    finished_at: row.finished_at,
  };
}

export function getRun(id: number): RunRecord | undefined {
  const row = db.prepare("SELECT * FROM runs WHERE id = ?").get(id) as
    RunRow | undefined;
  return row ? rowToRecord(row) : undefined;
}

export function listRuns(
  options: {
    limit?: number;
    offset?: number;
    kind?: RunKind;
    status?: RunStatus;
  } = {},
): { data: RunRecord[]; total: number; limit: number; offset: number } {
  const { limit = 50, offset = 0, kind, status } = options;

  const where: string[] = [];
  const params: unknown[] = [];
  if (kind) {
    where.push("kind = ?");
    params.push(kind);
  }
  if (status) {
    where.push("status = ?");
    params.push(status);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const total = (
    db.prepare(`SELECT COUNT(*) AS n FROM runs ${whereSql}`).get(...params) as {
      n: number;
    }
  ).n;
  const rows = db
    .prepare(`SELECT * FROM runs ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset) as RunRow[];

  return { data: rows.map(rowToRecord), total, limit, offset };
}

/**
 * Returns events for a run: live from memory when possible, otherwise the
 * snapshot persisted when the run finished.
 */
export function getRunEvents(id: number): PipelineEvent[] {
  const state = states.get(id);
  if (state) return state.events;

  const row = db.prepare("SELECT events FROM runs WHERE id = ?").get(id) as
    { events: string | null } | undefined;
  return row?.events ? (JSON.parse(row.events) as PipelineEvent[]) : [];
}

/**
 * Replays events after `fromSeq` (1-based event id), then subscribes to new
 * ones. Returns undefined when the run has no live state (finished + restarted,
 * or unknown). Replay and subscription happen synchronously so no event can
 * slip between them.
 */
export function subscribeToRun(
  id: number,
  listener: (event: PipelineEvent, seq: number) => void,
  fromSeq = 0,
): (() => void) | undefined {
  const state = states.get(id);
  if (!state) return undefined;

  for (let i = fromSeq; i < state.events.length; i++) {
    listener(state.events[i], i + 1);
  }

  state.subscribers.add(listener);
  return () => {
    state.subscribers.delete(listener);
  };
}
