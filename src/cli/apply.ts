import { launchBrowser } from "../platforms/browser.js";
import { platformRegistry, type PlatformName } from "../platforms/registry.js";
import { getNumericArg, hasFlag } from "../utils/cliFlags.js";
import { db } from "../db/client.js";
import { upsertJob } from "../db/upsertJob.js";
import { mapApplyResultToStatus } from "../utils/mapApplyResultToStatus.js";

async function main() {
  const minScore = getNumericArg('min-score', 70);
  const liveApply = hasFlag('live-apply');

  const platformName: PlatformName = "jobinja";
  const adapter = platformRegistry[platformName];

  // status = 'scored' excludes filtered_* (never reached scoring),
  // scored_low (below threshold), and anything already applied/error'd —
  // dedup falls out of the schema for free, no separate check needed.
  const eligibleJobs = db
    .prepare(`SELECT url, title, score FROM jobs WHERE status = 'scored' AND score >= ?`)
    .all(minScore) as { url: string; title: string | null; score: number }[];

  const { browser, page } = await launchBrowser();

  try {
    let count = 0;

    for (const job of eligibleJobs) {
      count += 1;

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

        console.log(`${job.title} - apply: ${result.status} - ${count}/${eligibleJobs.length}`);
      } else {
        console.log(`${job.title} - would apply (dry run) - ${count}/${eligibleJobs.length}`);
      }

      await new Promise((r) => setTimeout(r, 1500));
    }
  } catch (err: any) {
    console.error(err.message);
  } finally {
    await browser.close();
  }
}

main();