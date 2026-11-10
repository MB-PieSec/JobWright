import { describe, expect, it } from "vitest";
import { processedJobUrls } from "../server/runs/resume.js";
import type { PipelineEvent } from "../pipeline/types.js";

const job = (url: string) => ({ url, title: null });

describe("processedJobUrls", () => {
  it("collects every job that reached a result", () => {
    const events: PipelineEvent[] = [
      { type: "run_started", kind: "search" },
      { type: "jobs_found", total: 4 },
      {
        type: "job_skipped",
        index: 1,
        total: 4,
        job: job("https://example.com/1"),
        reason: "no_description",
      },
      {
        type: "job_filtered",
        index: 2,
        total: 4,
        job: job("https://example.com/2"),
        filter: "location",
        detail: null,
      },
      {
        type: "job_scored",
        index: 3,
        total: 4,
        job: job("https://example.com/3"),
        score: 80,
        status: "scored",
      },
      {
        type: "job_error",
        index: 4,
        total: 4,
        job: job("https://example.com/4"),
        error: "boom",
      },
      {
        type: "run_cancelled",
        reason: "Stopped by user",
      },
    ];

    expect(processedJobUrls(events)).toEqual([
      "https://example.com/1",
      "https://example.com/2",
      "https://example.com/3",
      "https://example.com/4",
    ]);
  });

  it("deduplicates URLs and ignores events without a job", () => {
    const events: PipelineEvent[] = [
      { type: "run_started", kind: "search" },
      {
        type: "job_scored",
        index: 1,
        total: 2,
        job: job("https://example.com/1"),
        score: 90,
        status: "scored",
      },
      {
        type: "job_error",
        index: 1,
        total: 2,
        job: job("https://example.com/1"),
        error: "retry failed",
      },
      { type: "run_failed", error: "boom" },
    ];

    expect(processedJobUrls(events)).toEqual(["https://example.com/1"]);
  });

  it("returns an empty list for a run with no processed jobs", () => {
    expect(
      processedJobUrls([
        { type: "run_started", kind: "search" },
        { type: "run_cancelled", reason: "Stopped before starting" },
      ]),
    ).toEqual([]);
  });
});
