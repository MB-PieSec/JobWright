import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { isChromiumKeyringSupported } from "./definitions.js";

const execFileAsync = promisify(execFile);

// Chromium stores its cookie-encryption password in the Secret Service under
// the schema `chrome_libsecret_os_crypt_password_v2` with an `application`
// attribute (e.g. "brave"). `secret-tool` is the smallest way to read it, but
// it is not installed everywhere; PyGObject's Secret bindings are a reliable
// fallback on distros that ship python3-gi (including this one).
const PYTHON_LOOKUP = `
import sys
try:
    import gi
    gi.require_version("Secret", "1")
    from gi.repository import Secret

    schema = Secret.Schema.new(
        "chrome_libsecret_os_crypt_password_v2",
        Secret.SchemaFlags.NONE,
        {"application": Secret.SchemaAttributeType.STRING},
    )
    value = Secret.password_lookup_sync(schema, {"application": sys.argv[1]}, None)
    if value:
        sys.stdout.write(value)
except Exception:
    sys.exit(1)
`;

async function tryCommand(
  command: string,
  args: string[],
  timeout: number,
): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(command, args, {
      timeout,
      maxBuffer: 1024 * 1024,
    });
    const value = stdout.trim();
    return value || null;
  } catch {
    return null;
  }
}

/**
 * Returns the libsecret password for a Chromium-family browser, or null when
 * the keyring entry is missing/locked or the tools are unavailable.
 */
export async function getChromiumKeyringPassword(
  application: string | null,
): Promise<string | null> {
  if (!application || !isChromiumKeyringSupported()) return null;

  const viaSecretTool = await tryCommand(
    "secret-tool",
    ["lookup", "application", application],
    5000,
  );
  if (viaSecretTool) return viaSecretTool;

  const viaPython = await tryCommand(
    "python3",
    ["-c", PYTHON_LOOKUP, application],
    8000,
  );
  if (viaPython) return viaPython;

  return null;
}
