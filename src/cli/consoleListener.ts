import type { ProgressListener } from "../pipeline/types.js";
import { terminalLink } from "../utils/terminalLink.js";

function progressLabel(index: number, total: number): string {
  return `${index}/${total}`;
}

/**
 * Reproduces the CLI's original per-job console output from pipeline events.
 * Keeping formatting here (rather than in the pipeline) is what lets the same
 * pipeline drive both the terminal and the HTTP/SSE server.
 */
export function createConsoleListener(): ProgressListener {
  return (event) => {
    switch (event.type) {
      case "run_started":
      case "jobs_found":
      case "run_finished":
      case "run_failed":
        return;

      case "job_skipped":
        console.log(
          `${event.job.title} - skipped (no description) ${progressLabel(event.index, event.total)} - ${terminalLink("jobLink", event.job.url)}`,
        );
        return;

      case "job_filtered": {
        const detail =
          event.filter === "experience" ? "experience" : "location";
        console.log(
          `${event.job.title} - skipped (${detail}: ${event.detail}) ${progressLabel(event.index, event.total)} - ${terminalLink("jobLink", event.job.url)}`,
        );
        return;
      }

      case "job_scored": {
        const label =
          event.status === "scored" ? `score: ${event.score}` : "Ignored";
        console.log(
          `${event.job.title} - ${label} - ${terminalLink("jobLink", event.job.url)} - ${progressLabel(event.index, event.total)}`,
        );
        return;
      }

      case "job_error":
        console.error(
          `${event.job.title} - error: ${event.error} - ${progressLabel(event.index, event.total)} - ${terminalLink("jobLink", event.job.url)}`,
        );
        return;

      case "apply_result":
        console.log(
          `${event.job.title} - apply: ${event.result.status} - ${progressLabel(event.index, event.total)} - ${terminalLink("jobLink", event.job.url)}`,
        );
        return;

      case "apply_dry_run":
        console.log(
          `${event.job.title} - would apply (dry run) - ${progressLabel(event.index, event.total)} - ${terminalLink("jobLink", event.job.url)}`,
        );
        return;

      case "apply_skipped":
        console.error(
          `${event.job.title} - error: ${event.reason} - ${progressLabel(event.index, event.total)}`,
        );
        return;
    }
  };
}
