import { launchBrowser } from "../platforms/browser.js";
import { platformRegistry} from "../platforms/registry.js";
import { getNumericArg, hasFlag } from "../utils/cliFlags.js";
import { getEligibleJobs } from "../db/getEligibleJobs.js";
import { upsertJob } from "../db/upsertJob.js";
import { mapApplyResultToStatus } from "../utils/mapApplyResultToStatus.js";
import { throttle } from "../utils/throttle.js";
import { getActiveChannels } from "../notifications/registry.js";
import { notifyAll } from "../notifications/notifyAll.js";



async function main() {
  const minScore = getNumericArg("min-score", 70);
  const liveApply = hasFlag("live-apply");
  const retryErrors = hasFlag("retry-errors");

  const eligibleJobs = getEligibleJobs(minScore, retryErrors);

  const { browser, page } = await launchBrowser();

  const startedAt = new Date();
  const summary = { applied: 0, alreadyApplied: 0, expired: 0, error: 0, total: 0 };

  try {
    for (const [index, job] of eligibleJobs.entries()) {
      const progressLabel = `${index + 1}/${eligibleJobs.length}`;
      const adapter = platformRegistry[job.platform];
      summary.total++;
      if (liveApply) {
        const result = await adapter.apply(page, job.url);
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

        console.log(`${job.title} - apply: ${result.status} - ${progressLabel}`);
      } else {
        console.log(`${job.title} - would apply (dry run) - ${progressLabel}`);
      }

      await throttle();
    }
  } catch (err: any) {
    console.error(err.message);
  } finally {
    await browser.close();
    if (liveApply) {
      await notifyAll(getActiveChannels(), { ...summary, startedAt, finishedAt: new Date() });
    }
  }
}

main();