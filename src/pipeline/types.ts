import type { ResumeProfile } from "../resume/schema.js";
import type { PlatformName } from "../platforms/registry.js";
import type { ApplyResult } from "../platforms/types.js";

export interface SearchOptions {
  platform: PlatformName;
  keyword: string;
  maxPages: number;
  minScore: number;
  reasoningMaxLength: number;
  hardMatch: boolean;
  skipFilters: boolean;
  /** 0 disables the experience filter (flag absent). */
  experienceTolerance: number;
  profile: ResumeProfile;
  /** URLs already processed by an earlier run; skipped when resuming. */
  skipJobUrls?: string[];
  /** Set when this run is a resume of an earlier, stopped run. */
  resumedFrom?: number;
}

export interface ApplyOptions {
  minScore: number;
  liveApply: boolean;
  retryErrors: boolean;
  /** 0 means "no cap". */
  maxApplies: number;
  /** When provided, only these job ids are considered. An empty array means none. */
  jobIds?: number[];
}

export interface JobRef {
  id?: number;
  url: string;
  title: string | null;
}

export interface SearchRunSummary {
  jobsFound: number;
  skippedNoDescription: number;
  filteredExperience: number;
  filteredLocation: number;
  scored: number;
  scoredLow: number;
  errors: number;
}

/** JSON-friendly apply summary for events / API responses (no Date objects). */
export interface ApplyRunSummaryJson {
  applied: number;
  alreadyApplied: number;
  expired: number;
  error: number;
  total: number;
  durationSeconds: number;
}

export type PipelineResult =
  | { kind: "search"; summary: SearchRunSummary }
  | { kind: "apply"; summary: ApplyRunSummaryJson };

export type PipelineEvent =
  | { type: "run_started"; kind: "search" | "apply" }
  | { type: "jobs_found"; total: number }
  | {
      type: "job_skipped";
      index: number;
      total: number;
      job: JobRef;
      reason: "no_description" | "already_processed";
    }
  | {
      type: "job_filtered";
      index: number;
      total: number;
      job: JobRef;
      filter: "experience" | "location";
      detail: string | null;
    }
  | {
      type: "job_scored";
      index: number;
      total: number;
      job: JobRef;
      score: number;
      status: "scored" | "scored_low";
    }
  | {
      type: "job_error";
      index: number;
      total: number;
      job: JobRef;
      error: string;
    }
  | {
      type: "apply_result";
      index: number;
      total: number;
      job: JobRef;
      result: ApplyResult;
    }
  | { type: "apply_dry_run"; index: number; total: number; job: JobRef }
  | {
      type: "apply_skipped";
      index: number;
      total: number;
      job: JobRef;
      reason: string;
    }
  | { type: "run_finished"; result: PipelineResult }
  | { type: "run_failed"; error: string }
  | { type: "run_cancelled"; reason: string }
  | { type: "run_resumed"; fromRunId: number };

export type ProgressListener = (event: PipelineEvent) => void;
