import { PlatformName } from "../platforms/registry.js";
import { db } from "./client.js";

export interface EligibleJob {
  url: string;
  title: string | null;
  score: number;
  platform: PlatformName;
}

export function getEligibleJobs(minScore: number, retryErrors: boolean): EligibleJob[] {
  // status = 'scored' excludes filtered_* (never reached scoring),
  // scored_low (below threshold), and anything already applied/error'd —
  // dedup falls out of the schema for free, no separate check needed.
  const statusClause = retryErrors ? "status IN ('scored', 'error')" : "status = 'scored'";
  return db
    .prepare(`SELECT url, title, score, platform FROM jobs WHERE ${statusClause} AND score >= ?`)
    .all(minScore) as EligibleJob[];
}
