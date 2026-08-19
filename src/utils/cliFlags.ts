
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

export function hasFlag(flagName: string): boolean {
  return process.argv.some(
    (arg) => arg === `--${flagName}` || arg.startsWith(`--${flagName}=`)
  );
}

export function getStringArg(flagName: string, defaultValue: string): string {
  const withEquals = process.argv.find((arg) => arg.startsWith(`--${flagName}=`));
  if (withEquals) return withEquals.split('=')[1];

  const flagIndex = process.argv.indexOf(`--${flagName}`);
  if (flagIndex !== -1 && process.argv[flagIndex + 1]) {
    return process.argv[flagIndex + 1];
  }

  return defaultValue;
}
