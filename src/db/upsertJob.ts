import { db } from "./client.js";

export interface JobRecord {
  url: string;
  platform: string;
  title: string | null;
  status:
    | "seen"
    | "filtered_experience"
    | "filtered_location"
    | "scored_low"
    | "scored"
    | "applied"
    | "already_applied"
    | "error";
  score?: number;
  reasoning?: string;
  errorReason?: string;
}

const upsertStmt = db.prepare(`
  INSERT INTO jobs (url, platform, title, status, score, reasoning, error_reason, first_seen_at, updated_at)
  VALUES (@url, @platform, @title, @status, @score, @reasoning, @errorReason, @now, @now)
  ON CONFLICT(url) DO UPDATE SET
    status = @status,
    score = @score,
    reasoning = @reasoning,
    error_reason = @errorReason,
    updated_at = @now
`);

export function upsertJob(record: JobRecord): void {
  upsertStmt.run({
    url: record.url,
    platform: record.platform,
    title: record.title,
    status: record.status,
    score: record.score ?? null,
    reasoning: record.reasoning ?? null,
    errorReason: record.errorReason ?? null,
    now: new Date().toISOString(),
  });
}
