import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

let tempDir: string;
let browserMode: typeof import("../settings/browserMode.js");

beforeAll(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "jobwright-browser-"));
  process.env.JOBWRIGHT_DB_PATH = path.join(tempDir, "test.db");
  vi.resetModules();
  browserMode = await import("../settings/browserMode.js");
});

afterAll(async () => {
  delete process.env.JOBWRIGHT_DB_PATH;
  await rm(tempDir, { recursive: true, force: true });
});

describe("browser debug mode", () => {
  it("runs headless by default", () => {
    expect(browserMode.getBrowserDebugMode()).toBe(false);
    expect(browserMode.isHeadless()).toBe(true);
  });

  it("shows the browser window when debug mode is enabled", () => {
    browserMode.setBrowserDebugMode(true);

    expect(browserMode.getBrowserDebugMode()).toBe(true);
    expect(browserMode.isHeadless()).toBe(false);
  });

  it("returns to headless when debug mode is disabled", () => {
    browserMode.setBrowserDebugMode(false);

    expect(browserMode.getBrowserDebugMode()).toBe(false);
    expect(browserMode.isHeadless()).toBe(true);
  });
});
