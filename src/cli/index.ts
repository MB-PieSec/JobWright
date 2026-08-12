import { getUserInput } from "../utils/getUserInput.js";
import { readFileContent } from "../utils/readFileContent.js";
import { fileExists } from "../utils/fileExists.js";
import { parseResume } from "../resume/parser.js";
import { writeFile } from "node:fs/promises";
import { launchBrowser } from "../platforms/browser.js";
import { platformRegistry, type PlatformName } from "../platforms/registry.js";

async function main() {
  const defaultProfilePath = "./profile.json";
  const { browser, page } = await launchBrowser();

  try {
    if (!(await fileExists(defaultProfilePath))) {
      console.log("Profiling for the first time.");
      const filePath = await getUserInput("Enter the path to your resume:");
      const contents = await readFileContent(filePath);
      const profile = await parseResume(contents);
      await writeFile("profile.json", JSON.stringify(profile, null, 2));
    } else {
      console.log("Profile already exists!");
    }

    const platformName: PlatformName = "jobinja";
    const adapter = platformRegistry[platformName];

    const query = "https://jobinja.ir/jobs?filters%5Bkeywords%5D%5B0%5D=backend";
    const jobs = await adapter.search(page, query);

    for (const job of jobs) {
      const { description, infoItems } = await adapter.getJobDetails(page, job.url);
      console.log(`${job.title} - ${job.url} - ${description} - ${JSON.stringify(infoItems)}`);
      await new Promise((r) => setTimeout(r, 1500));
    }
  } catch (err: any) {
    console.error(err.message);
  } finally {
    await browser.close();
  }
}

main();
