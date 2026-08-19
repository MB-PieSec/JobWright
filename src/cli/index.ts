import { getUserInput } from "../utils/getUserInput.js";
import { readFileContent } from "../utils/readFileContent.js";
import { fileExists } from "../utils/fileExists.js";
import { parseResume } from "../resume/parser.js";
import { ResumeProfileSchema, type ResumeProfile } from "../resume/schema.js";
import { writeFile } from "node:fs/promises";
import { launchBrowser } from "../platforms/browser.js";
import { platformRegistry, type PlatformName } from "../platforms/registry.js";
import { type JobPlatform } from "../platforms/types.js";
import { scoreResume } from "../scoring/scorer.js";
import { getNumericArg, hasFlag, getStringArg } from "../utils/cliFlags.js";
import { parseExperienceRange, meetsExperienceRequirement } from "../filters/experience.js";
import { meetsLocationRequirement } from "../filters/location.js";
import { upsertJob } from "../db/upsertJob.js";
import type { JobListing } from "../platforms/types.js";
import { type Page } from "puppeteer";

const DELAY_MS = 1500;

async function throttle(): Promise<void> {
  await new Promise((r) => setTimeout(r, DELAY_MS));
}

async function loadProfile(defaultProfilePath: string): Promise<ResumeProfile> {
  if (!(await fileExists(defaultProfilePath))) {
    console.log("Profiling for the first time.");
    const filePath = await getUserInput("Enter the path to your resume:");
    const contents = await readFileContent(filePath);
    const profile = await parseResume(contents);
    await writeFile(defaultProfilePath, JSON.stringify(profile, null, 2));
    return profile;
  }

  console.log("Profile already exists!");
  const raw = await readFileContent(defaultProfilePath);
  return ResumeProfileSchema.parse(JSON.parse(raw));
}

interface RunFlags {
  skipFilters: boolean;
  reasoningMaxLength: number;
  minScore: number;
  hardMatch: boolean;
  experienceTolerance: number; // 0 means "not considered" (mirrors prior considerExperience ? ... : 0)
}

function readRunFlags(): RunFlags {
  const considerExperience = hasFlag('experience-tolerance');
  return {
    skipFilters: hasFlag('skip-filters'),
    reasoningMaxLength: getNumericArg('reasoning-length', 200),
    minScore: getNumericArg('min-score', 70),
    hardMatch: hasFlag('hard-match'),
    experienceTolerance: considerExperience ? getNumericArg('experience-tolerance', 1) : 0,
  };
}

async function processJob(
  page: Page,
  job: JobListing,
  adapter: JobPlatform,
  platformName: PlatformName,
  profile: ResumeProfile,
  flags: RunFlags,
  progressLabel: string
): Promise<void> {
  const { description, infoItems } = await adapter.getJobDetails(page, job.url);

  if (description === null) {
    console.log(`${job.title} - skipped (no description) ${progressLabel}`);
    await throttle();
    return;
  }

  const experienceRaw = infoItems.find((item) => item.label === "حداقل سابقه کار")?.value;
  const experienceReq = parseExperienceRange(experienceRaw);

  if (
    !flags.skipFilters &&
    flags.experienceTolerance > 0 &&
    !meetsExperienceRequirement(experienceReq, profile.totalYearsExperience, flags.experienceTolerance)
  ) {
    upsertJob({ url: job.url, platform: platformName, title: job.title, status: "filtered_experience" });
    console.log(`${job.title} - skipped (experience: ${experienceRaw}) ${progressLabel}`);
    await throttle();
    return;
  }

  const jobLocationRaw = infoItems.find((item) => item.label === "موقعیت مکانی")?.value;
  const cooperationTypeRaw = infoItems.find((item) => item.label === "نوع همکاری")?.value;

  if (
    !flags.skipFilters &&
    !meetsLocationRequirement(jobLocationRaw, cooperationTypeRaw, profile.city, profile.province, flags.hardMatch)
  ) {
    upsertJob({ url: job.url, platform: platformName, title: job.title, status: "filtered_location" });
    console.log(`${job.title} - skipped (location: ${jobLocationRaw}) ${progressLabel}`);
    await throttle();
    return;
  }

  const jobScore = await scoreResume(profile, description, flags.reasoningMaxLength);

  upsertJob({
    url: job.url,
    platform: platformName,
    title: job.title,
    status: jobScore.score >= flags.minScore ? "scored" : "scored_low",
    score: jobScore.score,
    reasoning: jobScore.reasoning,
  });

  const label = jobScore.score >= flags.minScore ? `score: ${jobScore.score}` : "Ignored";
  console.log(`${job.title} - ${label} - ${progressLabel}`);
  await throttle();
}

async function main() {
  const defaultProfilePath = "./profile.json";
  const { browser, page } = await launchBrowser();

  try {
    const profile = await loadProfile(defaultProfilePath);

    const platformName: PlatformName = "jobinja";
    const adapter = platformRegistry[platformName];

    const keyword = getStringArg('keyword', 'backend');
    const query = adapter.buildSearchQuery(keyword);
    const maxPages = getNumericArg('max-pages', 3);
    const jobs = await adapter.search(page, query, maxPages);

    const flags = readRunFlags();

    for (const [index, job] of jobs.entries()) {
      const progressLabel = `${index + 1}/${jobs.length}`;
      await processJob(page, job, adapter, platformName, profile, flags, progressLabel);
    }
  } catch (err: any) {
    console.error(err.message);
  } finally {
    await browser.close();
  }
}

main();