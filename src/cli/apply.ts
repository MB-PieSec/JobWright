import { launchBrowser } from "../platforms/browser.js";
import { platformRegistry, type PlatformName } from "../platforms/registry.js";
import { getNumericArg, hasFlag } from "../utils/cliFlags.js";
import { getEligibleJobs } from "../db/getEligibleJobs.js";
import { upsertJob } from "../db/upsertJob.js";
import { mapApplyResultToStatus } from "../utils/mapApplyResultToStatus.js";
import { throttle } from "../utils/throttle.js";

async function main() {
  const minScore = getNumericArg('min-score', 70);
  const liveApply = hasFlag('live-apply');

  const platformName: PlatformName = "jobinja";
  const adapter = platformRegistry[platformName];

  const eligibleJobs = getEligibleJobs(minScore);

  const { browser, page } = await launchBrowser();

  try {
    for (const [index, job] of eligibleJobs.entries()) {
      const progressLabel = `${index + 1}/${eligibleJobs.length}`;

      if (liveApply) {
        const result = await adapter.apply(page, job.url);

        upsertJob({
          url: job.url,
          platform: platformName,
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
  }
}

main();