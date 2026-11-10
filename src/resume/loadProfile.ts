import { writeFile } from "node:fs/promises";
import { fileExists } from "../utils/fileExists.js";
import { getUserInput } from "../utils/getUserInput.js";
import { readFileContent } from "../utils/readFileContent.js";
import { parseResume } from "./parser.js";
import { ResumeProfileSchema, type ResumeProfile } from "./schema.js";

export class ProfileNotFoundError extends Error {
  constructor(public readonly profilePath: string) {
    super(
      `No profile found at ${profilePath}. Run the CLI once to parse a resume before starting a search run.`,
    );
    this.name = "ProfileNotFoundError";
  }
}

/**
 * Loads and re-validates profile.json.
 *
 * `interactive` preserves the CLI's first-run flow (prompt for a resume and
 * parse it). Non-interactive callers — the server — get a clear error instead
 * of hanging on stdin.
 */
export async function loadProfile(
  profilePath: string,
  options: { interactive: boolean },
): Promise<ResumeProfile> {
  if (!(await fileExists(profilePath))) {
    if (!options.interactive) {
      throw new ProfileNotFoundError(profilePath);
    }

    console.log("Profiling for the first time.");
    const filePath = await getUserInput("Enter the path to your resume:");
    const contents = await readFileContent(filePath);
    const profile = await parseResume(contents);
    await writeFile(profilePath, JSON.stringify(profile, null, 2));
    return profile;
  }

  if (options.interactive) {
    console.log("Profile already exists!");
  }

  const raw = await readFileContent(profilePath);
  return ResumeProfileSchema.parse(JSON.parse(raw));
}
