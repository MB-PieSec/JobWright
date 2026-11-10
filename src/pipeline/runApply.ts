import { launchBrowser } from "../platforms/browser.js";
import { platformRegistry } from "../platforms/registry.js";
import type { ApplyResult } from "../platforms/types.js";
import { getEligibleJobs } from "../db/getEligibleJobs.js";
import { upsertJob } from "../db/upsertJob.js";
import { mapApplyResultToStatus } from "../utils/mapApplyResultToStatus.js";
import { throttle } from "../utils/throttle.js";
import { getActiveChannels } from "../notifications/registry.js";
import { notifyAll } from "../notifications/notifyAll.js";
import type { ApplyRunSummary } from "../notifications/types.js";
import { throwIfAborted } from "./cancel.js";
import type {
  ApplyOptions,
  ApplyRunSummaryJson,
  PipelineResult,
  ProgressListener,
} from "./types.js";

export interface ApplyRunResult {
  summary: ApplyRunSummary;
}

export function toApplyRunSummaryJson(
  summary: ApplyRunSummary,
): ApplyRunSummaryJson {
  return {
    applied: summary.applied,
    alreadyApplied: summary.alreadyApplied,
    expired: summary.expired,
    error: summary.error,
    total: summary.total,
    durationSeconds: Math.round(
      (summary.finishedAt.getTime() - summary.startedAt.getTime()) / 1000,
    ),
  };
}

export async function runApply(
  options: ApplyOptions,
  onEvent: ProgressListener = () => {},
  signal?: AbortSignal,
): Promise<ApplyRunResult> {
  throwIfAborted(signal);

  const eligible = getEligibleJobs(
    options.minScore,
    options.retryErrors,
    options.jobIds,
  );
  const eligibleJobs =
    options.maxApplies > 0 ? eligible.slice(0, options.maxApplies) : eligible;

  const startedAt = new Date();
  const summary = {
    applied: 0,
    alreadyApplied: 0,
    expired: 0,
    error: 0,
    total: 0,
  };

  onEvent({ type: "run_started", kind: "apply" });
  onEvent({ type: "jobs_found", total: eligibleJobs.length });

  // Dry runs never touch the browser — they only report what would happen.
  const session = options.liveApply ? await launchBrowser() : null;

  try {
    throwIfAborted(signal);

    for (const [index, job] of eligibleJobs.entries()) {
      throwIfAborted(signal);

      const progress = { index: index + 1, total: eligibleJobs.length };
      summary.total++;

      const adapter = platformRegistry[job.platform];
      if (!adapter) {
        const reason = `No adapter registered for platform "${job.platform}"`;
        summary.error++;
        upsertJob({
          url: job.url,
          platform: job.platform,
          title: job.title,
          status: "error",
          score: job.score,
          errorReason: reason,
        });
        onEvent({ type: "apply_skipped", ...progress, job, reason });
        continue;
      }

      if (options.liveApply && session) {
        let result: ApplyResult;
        try {
          result = await adapter.apply(session.page, job.url);
        } catch (err) {
          result = {
            status: "error",
            reason: err instanceof Error ? err.message : String(err),
          };
        }

        if (result.status === "success") summary.applied++;
        else if (result.status === "alreadyApplied") summary.alreadyApplied++;
        else if (result.status === "expired") summary.expired++;
        else summary.error++;

        upsertJob({
          url: job.url,
          platform: job.platform,
          title: job.title,
          status: mapApplyResultToStatus(result),
          score: job.score,
          errorReason: result.status === "error" ? result.reason : undefined,
        });

        onEvent({ type: "apply_result", ...progress, job, result });

        // Only live applies hit the network; dry runs have nothing to throttle.
        await throttle();
      } else {
        onEvent({ type: "apply_dry_run", ...progress, job });
      }
    }
  } finally {
    if (session) {
      await session.browser.close();
    }
  }

  throwIfAborted(signal);

  const finishedAt = new Date();
  const fullSummary: ApplyRunSummary = { ...summary, startedAt, finishedAt };

  if (options.liveApply) {
    await notifyAll(await getActiveChannels(), fullSummary);
  }

  const result: PipelineResult = {
    kind: "apply",
    summary: toApplyRunSummaryJson(fullSummary),
  };
  onEvent({ type: "run_finished", result });

  return { summary: fullSummary };
}
