import { loadProfile } from "../resume/loadProfile.js";
import { platformRegistry, type PlatformName } from "../platforms/registry.js";
import { getNumericArg, hasFlag, getStringArg } from "../utils/cliFlags.js";
import { runSearch } from "../pipeline/runSearch.js";
import { createConsoleListener } from "./consoleListener.js";

interface RunFlags {
  skipFilters: boolean;
  reasoningMaxLength: number;
  minScore: number;
  hardMatch: boolean;
  experienceTolerance: number; // 0 means "not considered"
}

function readRunFlags(): RunFlags {
  const considerExperience = hasFlag("experience-tolerance");
  return {
    skipFilters: hasFlag("skip-filters"),
    reasoningMaxLength: getNumericArg("reasoning-length", 200),
    minScore: getNumericArg("min-score", 70),
    hardMatch: hasFlag("hard-match"),
    experienceTolerance: considerExperience
      ? getNumericArg("experience-tolerance", 1)
      : 0,
  };
}

async function main() {
  const profile = await loadProfile("./profile.json", { interactive: true });

  const requestedPlatform = getStringArg("platform", "jobinja");
  if (!(requestedPlatform in platformRegistry)) {
    console.error(
      `Unknown platform "${requestedPlatform}". Available: ${Object.keys(platformRegistry).join(", ")}`,
    );
    process.exit(1);
  }
  const platformName = requestedPlatform as PlatformName;

  const flags = readRunFlags();

  await runSearch(
    {
      platform: platformName,
      keyword: getStringArg("keyword", "backend"),
      maxPages: getNumericArg("max-pages", 3),
      minScore: flags.minScore,
      reasoningMaxLength: flags.reasoningMaxLength,
      hardMatch: flags.hardMatch,
      skipFilters: flags.skipFilters,
      experienceTolerance: flags.experienceTolerance,
      profile,
    },
    createConsoleListener(),
  );
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
