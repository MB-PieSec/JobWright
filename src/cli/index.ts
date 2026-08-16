import { getUserInput } from "../utils/getUserInput.js";
import { readFileContent } from "../utils/readFileContent.js";
import { fileExists } from "../utils/fileExists.js";
import { parseResume } from "../resume/parser.js";
import { ResumeProfileSchema, type ResumeProfile } from "../resume/schema.js";
import { writeFile } from "node:fs/promises";
import { launchBrowser } from "../platforms/browser.js";
import { platformRegistry, type PlatformName } from "../platforms/registry.js";
import { scoreResume } from "../scoring/scorer.js";
import { getNumericArg, hasFlag } from "../utils/cliFlags.js";
import { parseExperienceRange, meetsExperienceRequirement, type ExperienceRequirement } from "../filters/experience.js";
import { meetsLocationRequirement } from "../filters/location.js";
import { upsertJob } from "../db/upsertJob.js";

async function main() {
  const defaultProfilePath = "./profile.json";
  const { browser, page } = await launchBrowser();

  try {
    let profile: ResumeProfile;

    if (!(await fileExists(defaultProfilePath))) {
      console.log("Profiling for the first time.");
      const filePath = await getUserInput("Enter the path to your resume:");
      const contents = await readFileContent(filePath);
      profile = await parseResume(contents);
      await writeFile(defaultProfilePath, JSON.stringify(profile, null, 2));
    } else {
      console.log("Profile already exists!");
      const raw = await readFileContent(defaultProfilePath);
      profile = ResumeProfileSchema.parse(JSON.parse(raw));
    }

    const platformName: PlatformName = "jobinja";
    const adapter = platformRegistry[platformName];

    const query = "https://jobinja.ir/jobs?filters%5Bkeywords%5D%5B0%5D=backend";
    const jobs = await adapter.search(page, query);

    const skipFilters = hasFlag('skip-filters');
    const reasoningMaxLength = getNumericArg('reasoning-length', 200);
    const minScore = getNumericArg('min-score', 70);
    const hardMatch = hasFlag('hard-match');
    const considerExperience = hasFlag('experience-tolerance');
    const experienceTolerance = considerExperience
      ? getNumericArg('experience-tolerance', 1)
      : 0;

    let count: number = 0;
    for (const job of jobs) {
      count += 1;
      const { description, infoItems } = await adapter.getJobDetails(page, job.url);
      if (description === null) {
        console.log(`${job.title} - skipped (no description)`);
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }

      const experienceRaw = infoItems.find(
        (item) => item.label === "حداقل سابقه کار"
      )?.value;
      const experienceReq = parseExperienceRange(experienceRaw);

      if (
        !skipFilters &&
        considerExperience &&
        !meetsExperienceRequirement(experienceReq, profile.totalYearsExperience, experienceTolerance)
      ) {
        upsertJob({
          url: job.url,
          platform: platformName,
          title: job.title,
          status: "filtered_experience",
        });
        console.log(`${job.title} - skipped (experience: ${experienceRaw}) ${count}/20`);
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      const jobLocationRaw = infoItems.find(
        (item) => item.label === "موقعیت مکانی"
      )?.value;
      const cooperationTypeRaw = infoItems.find(
        (item) => item.label === "نوع همکاری"
      )?.value;

      if (
        !skipFilters &&
        !meetsLocationRequirement(jobLocationRaw, cooperationTypeRaw, profile.city, profile.province, hardMatch)
      ) {
        upsertJob({
          url: job.url,
          platform: platformName,
          title: job.title,
          status: "filtered_location",
        });
        console.log(`${job.title} - skipped (location: ${jobLocationRaw}) ${count}/20`);
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }

      const jobScore = await scoreResume(profile, description, reasoningMaxLength);

      upsertJob({
        url: job.url,
        platform: platformName,
        title: job.title,
        status: jobScore.score >= minScore ? "scored" : "scored_low",
        score: jobScore.score,
        reasoning: jobScore.reasoning,
      });

      if (jobScore.score >= minScore) {
        console.log(`${job.title} - score: ${jobScore.score} - ${count}/${jobs.length}`);
      } else {
        console.log(`${job.title} - Ignored - ${count}/${jobs.length}`);
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
