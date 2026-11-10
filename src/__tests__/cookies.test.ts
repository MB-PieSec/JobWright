import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  chromeExpiresToUnix,
  decryptChromiumValue,
  deriveChromiumKey,
  mapChromiumRow,
  mapChromiumSameSite,
  type ChromiumCookieRow,
} from "../cookies/chromium.js";
import { isJobDomain } from "../cookies/domains.js";
import { mapFirefoxRow, type FirefoxCookieRow } from "../cookies/firefox.js";

const IV = Buffer.alloc(16, 0x20);
const CHROME_EPOCH_OFFSET_SECONDS = 11_644_473_600;

function encrypt(
  value: string,
  key: Buffer,
  options: { prefix?: string; hostKey?: string } = {},
): Buffer {
  const { prefix = "v11", hostKey } = options;
  const plaintext = hostKey
    ? Buffer.concat([
        crypto.createHash("sha256").update(hostKey).digest(),
        Buffer.from(value, "utf8"),
      ])
    : Buffer.from(value, "utf8");

  const cipher = crypto.createCipheriv("aes-128-cbc", key, IV);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);

  return Buffer.concat([Buffer.from(prefix, "latin1"), encrypted]);
}

describe("deriveChromiumKey", () => {
  it("derives a deterministic 16-byte AES key", () => {
    const first = deriveChromiumKey("peanuts");
    const second = deriveChromiumKey("peanuts");

    expect(first).toHaveLength(16);
    expect(first.equals(second)).toBe(true);
  });
});

describe("decryptChromiumValue", () => {
  const key = deriveChromiumKey("test-key");

  it("round-trips v10 and v11 values", () => {
    for (const prefix of ["v10", "v11"]) {
      const encrypted = encrypt("session=abc123", key, { prefix });
      expect(decryptChromiumValue(encrypted, ".jobinja.ir", [key])).toBe(
        "session=abc123",
      );
    }
  });

  it("strips the SHA-256 host prefix used by newer Chromium builds", () => {
    const encrypted = encrypt("device_id=xyz", key, {
      hostKey: ".jobinja.ir",
    });

    expect(decryptChromiumValue(encrypted, ".jobinja.ir", [key])).toBe(
      "device_id=xyz",
    );
  });

  it("tries each candidate key until one works", () => {
    const encrypted = encrypt("value", key, { prefix: "v10" });
    const wrong = deriveChromiumKey("wrong");

    expect(decryptChromiumValue(encrypted, "jobvision.ir", [wrong, key])).toBe(
      "value",
    );
  });

  it("rejects values it cannot decrypt", () => {
    const encrypted = encrypt("value", key, { prefix: "v11" });
    const wrong = deriveChromiumKey("wrong");

    expect(() =>
      decryptChromiumValue(encrypted, "jobvision.ir", [wrong]),
    ).toThrow(/could not decrypt/i);
  });

  it("rejects app-bound v20 cookies", () => {
    const encrypted = encrypt("value", key, { prefix: "v20" });

    expect(() =>
      decryptChromiumValue(encrypted, "jobvision.ir", [key]),
    ).toThrow(/v20/i);
  });

  it("passes through very old plaintext values", () => {
    const plaintext = Buffer.from("legacy-value", "utf8");

    expect(decryptChromiumValue(plaintext, ".jobinja.ir", [key])).toBe(
      "legacy-value",
    );
  });
});

describe("isJobDomain", () => {
  it("accepts jobinja and jobvision hosts", () => {
    expect(isJobDomain("jobinja.ir")).toBe(true);
    expect(isJobDomain(".jobinja.ir")).toBe(true);
    expect(isJobDomain("account.jobvision.ir")).toBe(true);
    expect(isJobDomain("JOBVISION.IR")).toBe(true);
  });

  it("rejects lookalike and unrelated hosts", () => {
    expect(isJobDomain("eviljobinja.ir")).toBe(false);
    expect(isJobDomain("jobinja.ir.example.com")).toBe(false);
    expect(isJobDomain("example.com")).toBe(false);
  });
});

describe("Chromium row mapping", () => {
  const base: ChromiumCookieRow = {
    host_key: ".jobinja.ir",
    name: "session",
    value: null,
    encrypted_value: null,
    path: "/",
    expires_utc: null,
    is_secure: 1,
    is_httponly: 1,
    samesite: 1,
    is_persistent: 1,
  };

  it("converts Chrome timestamps to Unix seconds", () => {
    const expires = CHROME_EPOCH_OFFSET_SECONDS + 1_700_000_000;
    const cookie = mapChromiumRow(
      { ...base, expires_utc: expires * 1_000_000 },
      "value",
    );

    expect(cookie?.expires).toBe(1_700_000_000);
    expect(cookie?.secure).toBe(true);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("Lax");
  });

  it("maps session cookies to -1", () => {
    const cookie = mapChromiumRow(
      { ...base, expires_utc: 0, is_persistent: 0 },
      "value",
    );

    expect(cookie?.expires).toBe(-1);
  });

  it("maps all SameSite values", () => {
    expect(mapChromiumSameSite(0)).toBe("None");
    expect(mapChromiumSameSite(1)).toBe("Lax");
    expect(mapChromiumSameSite(2)).toBe("Strict");
    expect(mapChromiumSameSite(-1)).toBeUndefined();
  });

  it("handles missing persistent flags and empty expires", () => {
    expect(chromeExpiresToUnix(0)).toBe(-1);
    expect(chromeExpiresToUnix(null)).toBe(-1);
    expect(chromeExpiresToUnix(undefined)).toBe(-1);
  });
});

describe("Firefox row mapping", () => {
  const base: FirefoxCookieRow = {
    host: ".jobinja.ir",
    name: "session",
    value: "abc",
    path: "/",
    expiry: 1_700_000_000,
    isSecure: 1,
    isHttpOnly: 0,
    sameSite: 2,
    isSession: 0,
  };

  it("maps a persistent cookie", () => {
    const cookie = mapFirefoxRow(base);

    expect(cookie).toMatchObject({
      name: "session",
      value: "abc",
      domain: ".jobinja.ir",
      expires: 1_700_000_000,
      secure: true,
      httpOnly: false,
      sameSite: "Strict",
    });
  });

  it("maps session cookies to -1", () => {
    const cookie = mapFirefoxRow({
      ...base,
      expiry: 0,
      isSession: 1,
    });

    expect(cookie?.expires).toBe(-1);
  });
});
