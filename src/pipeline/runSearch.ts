import type { Page } from "puppeteer";
import { launchBrowser } from "../platforms/browser.js";
import { platformRegistry } from "../platforms/registry.js";
import type { JobListing, JobPlatform } from "../platforms/types.js";
import {
  parseExperienceRange,
  meetsExperienceRequirement,
} from "../filters/experience.js";
import { meetsLocationRequirement } from "../filters/location.js";
import { scoreResume } from "../scoring/scorer.js";
import { upsertJob } from "../db/upsertJob.js";
import { throttle } from "../utils/throttle.js";
import { throwIfAborted } from "./cancel.js";
import type {
  ProgressListener,
  SearchOptions,
  SearchRunSummary,
  PipelineResult,
} from "./types.js";

export interface SearchRunResult {
  summary: SearchRunSummary;
}

export async function runSearch(
  options: SearchOptions,
  onEvent: ProgressListener = () => {},
  signal?: AbortSignal,
): Promise<SearchRunResult> {
  const adapter = platformRegistry[options.platform];
  if (!adapter) {
    throw new Error(`No adapter registered for platform "${options.platform}"`);
  }

  const summary: SearchRunSummary = {
    jobsFound: 0,
    skippedNoDescription: 0,
    filteredExperience: 0,
    filteredLocation: 0,
    scored: 0,
    scoredLow: 0,
    errors: 0,
  };

  if (options.resumedFrom !== undefined) {
    onEvent({ type: "run_resumed", fromRunId: options.resumedFrom });
  }
  onEvent({ type: "run_started", kind: "search" });
  throwIfAborted(signal);

  const { browser, page } = await launchBrowser();
  try {
    throwIfAborted(signal);

    const query = adapter.buildSearchQuery(options.keyword);
    const jobs = await adapter.search(page, query, options.maxPages);

    summary.jobsFound = jobs.length;
    onEvent({ type: "jobs_found", total: jobs.length });

    const skipJobUrls = new Set(options.skipJobUrls ?? []);

    for (const [index, job] of jobs.entries()) {
      throwIfAborted(signal);

      const progress = { index: index + 1, total: jobs.length };

      if (skipJobUrls.has(job.url)) {
        onEvent({
          type: "job_skipped",
          ...progress,
          job,
          reason: "already_processed",
        });
        continue;
      }

      try {
        await processJob(
          page,
          job,
          adapter,
          options,
          summary,
          progress,
          onEvent,
        );
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        upsertJob({
          url: job.url,
          platform: options.platform,
          title: job.title,
          status: "error",
          errorReason: reason,
        });
        summary.errors++;
        onEvent({ type: "job_error", ...progress, job, error: reason });
      }
      await throttle();
    }
  } finally {
    await browser.close();
  }

  // A stop requested during the final throttle or browser shutdown must still
  // end the run as cancelled instead of reporting a clean finish.
  throwIfAborted(signal);

  const result: PipelineResult = { kind: "search", summary };
  onEvent({ type: "run_finished", result });
  return { summary };
}

async function processJob(
  page: Page,
  job: JobListing,
  adapter: JobPlatform,
  options: SearchOptions,
  summary: SearchRunSummary,
  progress: { index: number; total: number },
  onEvent: ProgressListener,
): Promise<void> {
  const { description, infoItems } = await adapter.getJobDetails(page, job.url);

  if (description === null) {
    summary.skippedNoDescription++;
    onEvent({
      type: "job_skipped",
      ...progress,
      job,
      reason: "no_description",
    });
    return;
  }

  const experienceRaw = infoItems.find(
    (item) => item.label === "حداقل سابقه کار",
  )?.value;
  const experienceReq = parseExperienceRange(experienceRaw);

  if (
    !options.skipFilters &&
    options.experienceTolerance > 0 &&
    !meetsExperienceRequirement(
      experienceReq,
      options.profile.totalYearsExperience,
      options.experienceTolerance,
    )
  ) {
    upsertJob({
      url: job.url,
      platform: options.platform,
      title: job.title,
      status: "filtered_experience",
    });
    summary.filteredExperience++;
    onEvent({
      type: "job_filtered",
      ...progress,
      job,
      filter: "experience",
      detail: experienceRaw ?? null,
    });
    return;
  }

  const jobLocationRaw = infoItems.find(
    (item) => item.label === "موقعیت مکانی",
  )?.value;
  const cooperationTypeRaw = infoItems.find(
    (item) => item.label === "نوع همکاری",
  )?.value;

  if (
    !options.skipFilters &&
    !meetsLocationRequirement(
      jobLocationRaw,
      cooperationTypeRaw,
      options.profile.city,
      options.profile.province,
      options.hardMatch,
    )
  ) {
    upsertJob({
      url: job.url,
      platform: options.platform,
      title: job.title,
      status: "filtered_location",
    });
    summary.filteredLocation++;
    onEvent({
      type: "job_filtered",
      ...progress,
      job,
      filter: "location",
      detail: jobLocationRaw ?? null,
    });
    return;
  }

  const jobScore = await scoreResume(
    options.profile,
    description,
    options.reasoningMaxLength,
  );
  const status = jobScore.score >= options.minScore ? "scored" : "scored_low";

  upsertJob({
    url: job.url,
    platform: options.platform,
    title: job.title,
    status,
    score: jobScore.score,
    reasoning: jobScore.reasoning,
  });

  if (status === "scored") summary.scored++;
  else summary.scoredLow++;

  onEvent({
    type: "job_scored",
    ...progress,
    job,
    score: jobScore.score,
    status,
  });
}
