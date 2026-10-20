import { launchBrowser } from "../platforms/browser.js";
import { platformRegistry } from "../platforms/registry.js";
import type { ApplyResult } from "../platforms/types.js";
import { getNumericArg, hasFlag } from "../utils/cliFlags.js";
import { getEligibleJobs } from "../db/getEligibleJobs.js";
import { upsertJob } from "../db/upsertJob.js";
import { mapApplyResultToStatus } from "../utils/mapApplyResultToStatus.js";
import { throttle } from "../utils/throttle.js";
import { terminalLink } from "../utils/terminalLink.js";
import { getActiveChannels } from "../notifications/registry.js";
import { notifyAll } from "../notifications/notifyAll.js";

async function main() {
  const minScore = getNumericArg("min-score", 70);
  const liveApply = hasFlag("live-apply");
  const retryErrors = hasFlag("retry-errors");
  // 0 means "no cap". A cap is cheap insurance for an irreversible action.
  const maxApplies = getNumericArg("max-applies", 0);

  const eligible = getEligibleJobs(minScore, retryErrors);
  const eligibleJobs = maxApplies > 0 ? eligible.slice(0, maxApplies) : eligible;

  if (maxApplies > 0 && eligible.length > eligibleJobs.length) {
    console.log(
      `Applying to ${eligibleJobs.length} of ${eligible.length} eligible jobs this run (--max-applies=${maxApplies}).`
    );
  }

  const { browser, page } = await launchBrowser();

  const startedAt = new Date();
  const summary = { applied: 0, alreadyApplied: 0, expired: 0, error: 0, total: 0 };

  try {
    for (const [index, job] of eligibleJobs.entries()) {
      const progressLabel = `${index + 1}/${eligibleJobs.length}`;
      summary.total++;

      const adapter = platformRegistry[job.platform];
      if (!adapter) {
        const reason = `No adapter registered for platform "${job.platform}"`;
        console.error(`${job.title} - error: ${reason} - ${progressLabel}`);
        summary.error++;
        upsertJob({
          url: job.url,
          platform: job.platform,
          title: job.title,
          status: "error",
          score: job.score,
          errorReason: reason,
        });
        continue;
      }

      if (liveApply) {
        let result: ApplyResult;
        try {
          result = await adapter.apply(page, job.url);
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

        console.log(
          `${job.title} - apply: ${result.status} - ${progressLabel} - ${terminalLink("jobLink", job.url)}`
        );
      } else {
        console.log(
          `${job.title} - would apply (dry run) - ${progressLabel} - ${terminalLink("jobLink", job.url)}`
        );
      }

      await throttle();
    }
  } catch (err: any) {
    console.error(err.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
    if (liveApply) {
      await notifyAll(getActiveChannels(), { ...summary, startedAt, finishedAt: new Date() });
    }
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
