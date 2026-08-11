import { getUserInput } from "../utils/getUserInput.js";
import { readFileContent } from "../utils/readFileContent.js";
import { parseResume } from "../resume/parser.js";
import { writeFile } from "node:fs/promises";

async function main() {
  const filePath = await getUserInput("Enter the path to your resume:");
  const contents = await readFileContent(filePath);
  const profile = await parseResume(contents);
  await writeFile("profile.json", JSON.stringify(profile, null, 2));
};

main();
