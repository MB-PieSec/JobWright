import { getNumericArg, hasFlag } from "../utils/cliFlags.js";
import { runApply } from "../pipeline/runApply.js";
import { createConsoleListener } from "./consoleListener.js";

async function main() {
  await runApply(
    {
      minScore: getNumericArg("min-score", 70),
      liveApply: hasFlag("live-apply"),
      retryErrors: hasFlag("retry-errors"),
      maxApplies: getNumericArg("max-applies", 0),
    },
    createConsoleListener(),
  );
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
