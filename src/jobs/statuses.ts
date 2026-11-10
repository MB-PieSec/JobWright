/**
 * The single source of truth for job statuses used by the API and stats
 * queries. The web client keeps its own copy because it is a separate build.
 */
export const JOB_STATUSES = [
  "seen",
  "filtered_experience",
  "filtered_location",
  "scored_low",
  "scored",
  "applied",
  "expired",
  "already_applied",
  "error",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];
