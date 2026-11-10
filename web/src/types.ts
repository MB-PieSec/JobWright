export const JOB_STATUSES = [
  "seen",
  "filtered_experience",
  "filtered_location",
  "scored_low",
  "scored",
  "applied",
  "expired",
  "already_applied",
  "error",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export const PLATFORMS = ["jobinja", "jobvision"] as const;

export type Platform = (typeof PLATFORMS)[number];

export interface Job {
  id: number;
  url: string;
  platform: string;
  title: string | null;
  status: JobStatus;
  score: number | null;
  reasoning: string | null;
  error_reason: string | null;
  first_seen_at: string;
  updated_at: string;
}

export interface JobsResponse {
  data: Job[];
  total: number;
  limit: number;
  offset: number;
}

export const SORT_KEYS = [
  "score",
  "updated",
  "seen",
  "title",
  "platform",
] as const;

export type SortKey = (typeof SORT_KEYS)[number];

export type SortOrder = "asc" | "desc";

export interface Filters {
  q: string;
  statuses: JobStatus[];
  platforms: string[];
  minScore: string;
  maxScore: string;
  seenAfter: string;
  seenBefore: string;
  sort: SortKey;
  order: SortOrder;
}

export const DEFAULT_FILTERS: Filters = {
  q: "",
  statuses: [],
  platforms: [],
  minScore: "",
  maxScore: "",
  seenAfter: "",
  seenBefore: "",
  sort: "score",
  order: "desc",
};

/* ------------------------------------------------------------------ */
/* Runs                                                                */
/* ------------------------------------------------------------------ */

export type RunKind = "search" | "apply";

export type RunStatus =
  "queued" | "running" | "completed" | "failed" | "cancelled";

export interface SearchRunSummary {
  jobsFound: number;
  skippedNoDescription: number;
  filteredExperience: number;
  filteredLocation: number;
  scored: number;
  scoredLow: number;
  errors: number;
}

export interface ApplyRunSummary {
  applied: number;
  alreadyApplied: number;
  expired: number;
  error: number;
  total: number;
  durationSeconds: number;
}

export type PipelineResult =
  | { kind: "search"; summary: SearchRunSummary }
  | { kind: "apply"; summary: ApplyRunSummary };

export interface JobRef {
  id?: number;
  url: string;
  title: string | null;
}

export type ApplyResult =
  | { status: "success" }
  | { status: "alreadyApplied" }
  | { status: "expired" }
  | { status: "error"; reason: string };

export type PipelineEvent =
  | { type: "run_started"; kind: RunKind }
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

export interface Run {
  id: number;
  kind: RunKind;
  status: RunStatus;
  params: Record<string, unknown>;
  result: PipelineResult | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface RunsResponse {
  data: Run[];
  total: number;
  limit: number;
  offset: number;
}

export interface StartRunResponse {
  runId: number;
  status: "queued";
}

export interface ResumeRunResponse extends StartRunResponse {
  resumedFrom: number;
}

/* ------------------------------------------------------------------ */
/* Stats                                                               */
/* ------------------------------------------------------------------ */

export interface ActivityPoint {
  date: string;
  seen: number;
  applied: number;
}

export interface Stats {
  total: number;
  byStatus: Record<string, number>;
  byPlatform: Record<string, number>;
  scoreBuckets: Array<{ bucket: number; count: number }>;
  averageScore: number | null;
  scoredCount: number;
  lastUpdatedAt: string | null;
  activity: ActivityPoint[];
  runs: {
    total: number;
    byStatus: Record<string, number>;
    byKind: Record<string, number>;
  };
  recentRuns: Run[];
}

/* ------------------------------------------------------------------ */
/* AI providers                                                        */
/* ------------------------------------------------------------------ */

export const AI_PROVIDER_IDS = [
  "openrouter",
  "openai",
  "anthropic",
  "gemini",
  "groq",
  "deepseek",
  "mistral",
  "xai",
  "together",
] as const;

export type AiProviderId = (typeof AI_PROVIDER_IDS)[number];

export type AiKeySource = "saved" | "environment" | null;

export interface AiProviderInfo {
  id: AiProviderId;
  label: string;
  description: string;
  docsUrl: string;
  defaultModel: string;
  models: string[];
  envKeys: string[];
  keySource: AiKeySource;
  hasSavedKey: boolean;
  hasEnvKey: boolean;
}

export interface AiState {
  active: {
    provider: AiProviderId;
    model: string;
    keySource: AiKeySource;
    configured: boolean;
  };
  providers: AiProviderInfo[];
}

export interface AiTestResult {
  ok: true;
  provider: AiProviderId;
  model: string;
  latencyMs: number;
  response: string;
}

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

export type NotificationConfigSource = "saved" | "environment" | null;

export interface TelegramNotificationState {
  enabled: boolean;
  botTokenSource: NotificationConfigSource;
  hasSavedBotToken: boolean;
  hasEnvBotToken: boolean;
  chatId: string;
  chatIdSource: NotificationConfigSource;
  hasSavedChatId: boolean;
  hasEnvChatId: boolean;
}

export interface NotificationsState {
  telegram: TelegramNotificationState;
}

export interface TelegramTestResult {
  ok: true;
  chatId: string;
  latencyMs: number;
}

/* ------------------------------------------------------------------ */
/* Resume                                                              */
/* ------------------------------------------------------------------ */

export interface ResumeWorkHistoryItem {
  title: string;
  company: string;
  durationMonths: number;
  summary: string;
}

export interface ResumeProject {
  title: string;
  summary: string;
}

export interface ResumeEducation {
  degree: string;
  institution: string;
  field?: string;
}

export interface ResumeProfile {
  name: string;
  totalYearsExperience: number;
  seniorityLevel: "junior" | "mid" | "senior" | "lead";
  skills: string[];
  workHistory: ResumeWorkHistoryItem[];
  projects?: ResumeProject[];
  education?: ResumeEducation[];
  city?: string;
  province?: string;
}

export interface ResumeSource {
  filename: string;
  uploadedAt: string;
  size: number;
}

export interface ResumeResponse {
  profile: ResumeProfile | null;
  source: ResumeSource | null;
  profileUpdatedAt: string | null;
  supportedExtensions: string[];
}

export interface ResumeUploadResponse {
  profile: ResumeProfile;
  source: ResumeSource;
}

/* ------------------------------------------------------------------ */
/* Settings & cookies                                                  */
/* ------------------------------------------------------------------ */

export type BrowserId = "brave" | "chrome" | "opera" | "firefox";

export type BrowserFamily = "chromium" | "firefox";

export interface BrowserProfile {
  id: string;
  name: string;
  path: string;
  cookiePath: string;
  isDefault: boolean;
}

export interface DetectedBrowser {
  id: BrowserId;
  name: string;
  family: BrowserFamily;
  installed: boolean;
  executablePath: string | null;
  supported: boolean;
  profiles: BrowserProfile[];
  note?: string;
}

export interface BrowsersResponse {
  platform: string;
  browsers: DetectedBrowser[];
}

export interface CookieImportResult {
  browserId: BrowserId;
  browserName: string;
  profilePath: string;
  cookieCount: number;
  skipped: number;
  domains: string[];
  writtenTo: string;
  importedAt: string;
}

export interface CookieSource {
  browserId: BrowserId;
  profilePath: string;
  autoImport: boolean;
}

export interface SettingsResponse {
  cookies: {
    path: string;
    source: CookieSource | null;
    lastImport: CookieImportResult | null;
  };
  browser: {
    /** True shows the Chromium window; false (default) runs headless. */
    debugMode: boolean;
  };
}

/* ------------------------------------------------------------------ */
/* Server-side folder browser                                          */
/* ------------------------------------------------------------------ */

export interface FsRoot {
  name: string;
  path: string;
}

export interface FsRootsResponse {
  home: string;
  filesystemRoot: string;
  known: FsRoot[];
}

export interface FsEntry {
  name: string;
  path: string;
  isBrowserRoot: boolean;
  hasCookies: boolean;
}

export interface FsListing {
  path: string;
  parent: string | null;
  entries: FsEntry[];
  truncated: boolean;
}
