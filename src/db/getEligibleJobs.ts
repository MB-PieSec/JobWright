import { PlatformName } from "../platforms/registry.js";
import { db } from "./client.js";

export interface EligibleJob {
  id: number;
  url: string;
  title: string | null;
  score: number;
  platform: PlatformName;
}

export function getEligibleJobs(
  minScore: number,
  retryErrors: boolean,
  jobIds?: number[],
): EligibleJob[] {
  // An explicitly empty selection means "apply to nothing", not "apply to
  // everything" — the latter would be a dangerous default for a web request.
  if (jobIds !== undefined && jobIds.length === 0) {
    return [];
  }

  // status = 'scored' excludes filtered_* (never reached scoring),
  // scored_low (below threshold), and anything already applied/error'd —
  // dedup falls out of the schema for free, no separate check needed.
  const statusClause = retryErrors
    ? "status IN ('scored', 'error')"
    : "status = 'scored'";
  const idClause = jobIds?.length
    ? `AND id IN (${jobIds.map(() => "?").join(",")})`
    : "";

  return db
    .prepare(
      `SELECT id, url, title, score, platform FROM jobs
       WHERE ${statusClause} AND score >= ? ${idClause}`,
    )
    .all(minScore, ...(jobIds ?? [])) as EligibleJob[];
}
