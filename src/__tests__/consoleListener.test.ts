import { afterEach, describe, expect, it, vi } from "vitest";
import { createConsoleListener } from "../cli/consoleListener.js";
import { terminalLink } from "../utils/terminalLink.js";

const link = (url: string) => terminalLink("jobLink", url);

describe("createConsoleListener", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("formats a scored job like the original CLI", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    createConsoleListener()({
      type: "job_scored",
      index: 2,
      total: 5,
      job: { url: "https://example.com/job", title: "Backend Dev" },
      score: 88,
      status: "scored",
    });

    expect(log).toHaveBeenCalledWith(
      `Backend Dev - score: 88 - ${link("https://example.com/job")} - 2/5`,
    );
  });

  it("formats a below-threshold job as Ignored", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    createConsoleListener()({
      type: "job_scored",
      index: 1,
      total: 2,
      job: { url: "https://example.com/job", title: "Frontend Dev" },
      score: 20,
      status: "scored_low",
    });

    expect(log).toHaveBeenCalledWith(
      `Frontend Dev - Ignored - ${link("https://example.com/job")} - 1/2`,
    );
  });

  it("includes the raw filter value when a job is filtered", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    createConsoleListener()({
      type: "job_filtered",
      index: 3,
      total: 4,
      job: { url: "https://example.com/job", title: "Dev" },
      filter: "experience",
      detail: "پنج تا هفت سال",
    });

    expect(log).toHaveBeenCalledWith(
      `Dev - skipped (experience: پنج تا هفت سال) 3/4 - ${link("https://example.com/job")}`,
    );
  });

  it("formats apply outcomes and dry runs", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const listener = createConsoleListener();

    listener({
      type: "apply_result",
      index: 1,
      total: 2,
      job: { url: "https://example.com/a", title: "A" },
      result: { status: "success" },
    });
    listener({
      type: "apply_dry_run",
      index: 2,
      total: 2,
      job: { url: "https://example.com/b", title: "B" },
    });

    expect(log).toHaveBeenNthCalledWith(
      1,
      `A - apply: success - 1/2 - ${link("https://example.com/a")}`,
    );
    expect(log).toHaveBeenNthCalledWith(
      2,
      `B - would apply (dry run) - 2/2 - ${link("https://example.com/b")}`,
    );
  });
});
