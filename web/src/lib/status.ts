import type { JobStatus } from "../types";

export const STATUS_LABELS: Record<JobStatus, string> = {
  seen: "Seen",
  filtered_experience: "Experience filter",
  filtered_location: "Location filter",
  scored_low: "Low score",
  scored: "Scored",
  applied: "Applied",
  expired: "Expired",
  already_applied: "Already applied",
  error: "Error",
};

/**
 * Semantic badge palette. Every entry supplies foreground, background and ring
 * tokens so the badge keeps AA contrast in both light and dark mode.
 */
export const STATUS_BADGE_CLASSES: Record<JobStatus, string> = {
  applied:
    "bg-status-applied-soft text-status-applied ring-status-applied-ring",
  scored: "bg-status-scored-soft text-status-scored ring-status-scored-ring",
  scored_low:
    "bg-status-scored-low-soft text-status-scored-low ring-status-scored-low-ring",
  already_applied:
    "bg-status-already-applied-soft text-status-already-applied ring-status-already-applied-ring",
  seen: "bg-status-seen-soft text-status-seen ring-status-seen-ring",
  filtered_experience:
    "bg-status-filtered-soft text-status-filtered ring-status-filtered-ring",
  filtered_location:
    "bg-status-filtered-soft text-status-filtered ring-status-filtered-ring",
  expired:
    "bg-status-expired-soft text-status-expired ring-status-expired-ring",
  error: "bg-status-error-soft text-status-error ring-status-error-ring",
};

export function scoreTone(score: number): string {
  if (score < 40) return "bg-score-low";
  if (score < 70) return "bg-score-mid";
  return "bg-score-high";
}
