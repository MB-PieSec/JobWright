import { getUserInput } from "../utils/getUserInput.js";
import { readFileContent } from "../utils/readFileContent.js";
import { fileExists } from "../utils/fileExists.js";
import { parseResume } from "../resume/parser.js";
import { ResumeProfileSchema, type ResumeProfile } from "../resume/schema.js";
import { writeFile } from "node:fs/promises";
import { launchBrowser } from "../platforms/browser.js";
import { platformRegistry, type PlatformName } from "../platforms/registry.js";
import { scoreResume } from "../scoring/scorer.js";
import { getNumericArg } from "../utils/cliFlags.js";

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
    
    const reasoningMaxLength = getNumericArg('reasoning-length', 200);
    const minScore = getNumericArg('min-score', 70);
    const results: {
      title: string | null;
      url: string;
      description: string;
      score: number;
      requirementsMet: number;
      requirementsTotal: number;
      missingRequirements: string[];
      reasoning: string;
    }[] = [];
    let count: number = 0;
    for (const job of jobs) {
      const { description } = await adapter.getJobDetails(page, job.url);
    
      if (description === null) {
        console.log(`${job.title} - skipped (no description)`);
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
  
      const jobScore = await scoreResume(profile, description, reasoningMaxLength);
    
      results.push({
        title: job.title,
        url: job.url,
        description,
        score: jobScore.score,
        requirementsMet: jobScore.requirementsMet,
        requirementsTotal: jobScore.requirementsTotal,
        missingRequirements: jobScore.missingRequirements,
        reasoning: jobScore.reasoning,
      });
    
      count += 1;
      if (jobScore.score >= minScore) {
        console.log(`${job.title} - score: ${jobScore.score} - ${count}/${jobs.length}`);
      } else {
        console.log(`${job.title} - Ignored - ${count}/${jobs.length}`);
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    
    await writeFile("jobs.json", JSON.stringify(results, null, 2));
  } catch (err: any) {
    console.error(err.message);
  } finally {
    await browser.close();
  }
}

main();