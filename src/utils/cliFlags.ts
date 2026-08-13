
export function getNumericArg(flagName: string, defaultValue: number): number {
  const args: string[] = process.argv.slice(2);
  const prefix = `--${flagName}=`;

  // Check for `--flagName=X`
  const inlineArg = args.find((arg) => arg.startsWith(prefix));
  if (inlineArg) {
    const val = parseInt(inlineArg.slice(prefix.length), 10);
    return Number.isNaN(val) ? defaultValue : val;
  }

  // Check for `--flagName X`
  const flagIndex = args.indexOf(`--${flagName}`);
  if (flagIndex !== -1 && args[flagIndex + 1] !== undefined) {
    const val = parseInt(args[flagIndex + 1], 10);
    return Number.isNaN(val) ? defaultValue : val;
  }

  return defaultValue;
}