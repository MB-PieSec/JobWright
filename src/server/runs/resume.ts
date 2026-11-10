import type { PipelineEvent } from "../../pipeline/types.js";

/**
 * Collects job URLs that an earlier run already reached a result for. Resuming
 * reuses the original search parameters and skips these URLs, so the new run
 * only spends time on work the stopped run never got to.
 */
export function processedJobUrls(events: PipelineEvent[]): string[] {
  const urls = new Set<string>();

  for (const event of events) {
    switch (event.type) {
      case "job_skipped":
      case "job_filtered":
      case "job_scored":
      case "job_error":
      case "apply_result":
      case "apply_dry_run":
      case "apply_skipped":
        urls.add(event.job.url);
        break;
      default:
        break;
    }
  }

  return [...urls];
}
