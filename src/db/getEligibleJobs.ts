import { db } from "./client.js";

export interface EligibleJob {
  url: string;
  title: string | null;
  score: number;
}

export function getEligibleJobs(minScore: number): EligibleJob[] {
  // status = 'scored' excludes filtered_* (never reached scoring),
  // scored_low (below threshold), and anything already applied/error'd —
  // dedup falls out of the schema for free, no separate check needed.
  return db
    .prepare(`SELECT url, title, score FROM jobs WHERE status = 'scored' AND score >= ?`)
    .all(minScore) as EligibleJob[];
}
