import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PipelineResult } from "../pipeline/types.js";

const EMPTY_SEARCH_RESULT: PipelineResult = {
  kind: "search",
  summary: {
    jobsFound: 0,
    skippedNoDescription: 0,
    filteredExperience: 0,
    filteredLocation: 0,
    scored: 0,
    scoredLow: 0,
    errors: 0,
  },
};

let tempDir: string;
let manager: typeof import("../server/runs/manager.js");

beforeAll(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "jobwright-runs-"));
  process.env.JOBWRIGHT_DB_PATH = path.join(tempDir, "test.db");
  vi.resetModules();
  manager = await import("../server/runs/manager.js");
});

afterAll(async () => {
  delete process.env.JOBWRIGHT_DB_PATH;
  await rm(tempDir, { recursive: true, force: true });
});

async function waitForStatus(
  id: number,
  status: string,
  timeoutMs = 1000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (manager.getRun(id)?.status === status) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Run ${id} did not reach status ${status}`);
}

describe("run cancellation", () => {
  it("cancels a queued run before its executor starts", async () => {
    let started = false;

    const id = manager.startRun("search", { kind: "search" }, async () => {
      started = true;
      return EMPTY_SEARCH_RESULT;
    });

    expect(manager.cancelRun(id)).toBe("cancelled");
    await waitForStatus(id, "cancelled");

    expect(started).toBe(false);
    expect(
      manager.getRunEvents(id).some((event) => event.type === "run_cancelled"),
    ).toBe(true);
  });

  it("cancels a running run at its next safe boundary", async () => {
    let signalStarted: () => void = () => {};
    const started = new Promise<void>((resolve) => {
      signalStarted = resolve;
    });

    const id = manager.startRun(
      "search",
      { kind: "search" },
      async (_emit, signal) => {
        signalStarted();
        await new Promise<void>((resolve) => {
          signal.addEventListener("abort", () => resolve(), { once: true });
        });
        throw new Error("pipeline aborted");
      },
    );

    await started;
    expect(manager.cancelRun(id)).toBe("cancelled");
    await waitForStatus(id, "cancelled");

    const run = manager.getRun(id);
    expect(run?.error).toBeNull();
    expect(
      manager.getRunEvents(id).some((event) => event.type === "run_cancelled"),
    ).toBe(true);
  });

  it("refuses to cancel a finished run", async () => {
    const id = manager.startRun("search", { kind: "search" }, async () => {
      return EMPTY_SEARCH_RESULT;
    });

    await waitForStatus(id, "completed");
    expect(manager.cancelRun(id)).toBe("not_cancellable");
  });
});
