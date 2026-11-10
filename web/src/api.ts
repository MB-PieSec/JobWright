import type {
  AiProviderId,
  AiState,
  AiTestResult,
  BrowsersResponse,
  CookieImportResult,
  Filters,
  FsListing,
  FsRootsResponse,
  Job,
  JobsResponse,
  NotificationsState,
  ResumeResponse,
  ResumeRunResponse,
  ResumeUploadResponse,
  Run,
  RunsResponse,
  SettingsResponse,
  StartRunResponse,
  Stats,
  TelegramTestResult,
} from "./types";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers as Record<string, string> | undefined),
    },
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as {
        error?: string;
        message?: string;
      };
      message = body.error ?? body.message ?? message;
    } catch {
      // Non-JSON error bodies keep the generic message.
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function parseScore(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * The API treats `seenBefore` as an exclusive upper bound. Adding a day makes
 * the date the user picked inclusive, which is what a date input implies.
 */
function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function buildJobsQuery(
  filters: Filters,
  limit: number,
  offset: number,
): string {
  const params = new URLSearchParams();

  // Fastify parses repeated keys into arrays; `status[]=...` would be silently
  // ignored, so always append one entry per value.
  for (const status of filters.statuses) params.append("status", status);
  for (const platform of filters.platforms) params.append("platform", platform);

  if (filters.q.trim()) params.set("q", filters.q.trim());

  const minScore = parseScore(filters.minScore);
  const maxScore = parseScore(filters.maxScore);
  if (minScore !== undefined) params.set("minScore", String(minScore));
  if (maxScore !== undefined) params.set("maxScore", String(maxScore));

  if (filters.seenAfter) params.set("seenAfter", filters.seenAfter);
  if (filters.seenBefore)
    params.set("seenBefore", addDays(filters.seenBefore, 1));

  params.set("sort", filters.sort);
  params.set("order", filters.order);
  params.set("limit", String(limit));
  params.set("offset", String(offset));

  return params.toString();
}

export function fetchJobs(
  filters: Filters,
  limit: number,
  offset: number,
  signal?: AbortSignal,
): Promise<JobsResponse> {
  return request<JobsResponse>(
    `/api/jobs?${buildJobsQuery(filters, limit, offset)}`,
    { signal },
  );
}

export function fetchJob(id: number, signal?: AbortSignal): Promise<Job> {
  return request<Job>(`/api/jobs/${id}`, { signal });
}

export function deleteJob(id: number): Promise<void> {
  return request<void>(`/api/jobs/${id}`, { method: "DELETE" });
}

export function wipeJobs(): Promise<{ deleted: number }> {
  return request<{ deleted: number }>("/api/jobs?confirm=yes", {
    method: "DELETE",
  });
}

/* ------------------------------------------------------------------ */
/* Runs                                                                */
/* ------------------------------------------------------------------ */

export interface SearchRunInput {
  kind: "search";
  platform: string;
  keyword: string;
  maxPages: number;
  minScore: number;
  reasoningLength: number;
  hardMatch: boolean;
  skipFilters: boolean;
  experienceTolerance?: number;
}

export interface ApplyRunInput {
  kind: "apply";
  liveApply: boolean;
  retryErrors: boolean;
  maxApplies: number;
  minScore: number;
}

export type StartRunInput = SearchRunInput | ApplyRunInput;

export function fetchRuns(
  options: {
    limit?: number;
    offset?: number;
    kind?: "search" | "apply";
    status?: "queued" | "running" | "completed" | "failed" | "cancelled";
  } = {},
  signal?: AbortSignal,
): Promise<RunsResponse> {
  const params = new URLSearchParams();
  if (options.limit !== undefined) params.set("limit", String(options.limit));
  if (options.offset !== undefined)
    params.set("offset", String(options.offset));
  if (options.kind) params.set("kind", options.kind);
  if (options.status) params.set("status", options.status);

  const query = params.toString();
  return request<RunsResponse>(`/api/runs${query ? `?${query}` : ""}`, {
    signal,
  });
}

export function fetchRun(id: number, signal?: AbortSignal): Promise<Run> {
  return request<Run>(`/api/runs/${id}`, { signal });
}

export function startRun(input: StartRunInput): Promise<StartRunResponse> {
  return request<StartRunResponse>("/api/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function stopRun(id: number): Promise<{
  runId: number;
  status: "cancelling";
}> {
  return request<{ runId: number; status: "cancelling" }>(
    `/api/runs/${id}/stop`,
    { method: "POST" },
  );
}

export function resumeRun(id: number): Promise<ResumeRunResponse> {
  return request<ResumeRunResponse>(`/api/runs/${id}/resume`, {
    method: "POST",
  });
}

/* ------------------------------------------------------------------ */
/* AI providers                                                        */
/* ------------------------------------------------------------------ */

export function fetchAiState(signal?: AbortSignal): Promise<AiState> {
  return request<AiState>("/api/ai", { signal });
}

export function saveAiSettings(input: {
  provider: AiProviderId;
  model: string;
  apiKey?: string | null;
}): Promise<AiState> {
  return request<AiState>("/api/ai", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function testAiConnection(input: {
  provider: AiProviderId;
  model: string;
  apiKey?: string;
}): Promise<AiTestResult> {
  return request<AiTestResult>("/api/ai/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function removeAiKey(provider: AiProviderId): Promise<AiState> {
  return request<AiState>(`/api/ai/keys/${provider}`, { method: "DELETE" });
}

/* ------------------------------------------------------------------ */
/* Resume                                                              */
/* ------------------------------------------------------------------ */

export function fetchResume(signal?: AbortSignal): Promise<ResumeResponse> {
  return request<ResumeResponse>("/api/resume", { signal });
}

export function uploadResume(input: {
  filename: string;
  content: string;
}): Promise<ResumeUploadResponse> {
  return request<ResumeUploadResponse>("/api/resume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

/* ------------------------------------------------------------------ */
/* Stats                                                               */
/* ------------------------------------------------------------------ */

export function fetchStats(signal?: AbortSignal): Promise<Stats> {
  return request<Stats>("/api/stats", { signal });
}

/* ------------------------------------------------------------------ */
/* Settings & cookies                                                  */
/* ------------------------------------------------------------------ */

export function fetchSettings(signal?: AbortSignal): Promise<SettingsResponse> {
  return request<SettingsResponse>("/api/settings", { signal });
}

export function saveSettings(input: {
  cookiesSource: {
    browserId: CookieImportResult["browserId"];
    profilePath: string;
    autoImport: boolean;
  } | null;
}): Promise<SettingsResponse> {
  return request<SettingsResponse>("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function fetchBrowsers(signal?: AbortSignal): Promise<BrowsersResponse> {
  return request<BrowsersResponse>("/api/cookies/browsers", { signal });
}

export function importCookies(input: {
  browserId: CookieImportResult["browserId"];
  profilePath?: string;
}): Promise<CookieImportResult> {
  return request<CookieImportResult>("/api/cookies/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

/* ------------------------------------------------------------------ */
/* Server-side folder browser                                          */
/* ------------------------------------------------------------------ */

export function fetchFsRoots(signal?: AbortSignal): Promise<FsRootsResponse> {
  return request<FsRootsResponse>("/api/fs/roots", { signal });
}

export function listFs(
  path?: string,
  signal?: AbortSignal,
): Promise<FsListing> {
  const query = path ? `?path=${encodeURIComponent(path)}` : "";
  return request<FsListing>(`/api/fs/list${query}`, { signal });
}

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

export function fetchNotifications(
  signal?: AbortSignal,
): Promise<NotificationsState> {
  return request<NotificationsState>("/api/notifications", { signal });
}

export function saveTelegramSettings(input: {
  /** A string replaces the saved token; null removes it. */
  botToken?: string | null;
  /** A string replaces the saved chat ID; null removes it. */
  chatId?: string | null;
}): Promise<NotificationsState> {
  return request<NotificationsState>("/api/notifications", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function testTelegram(input?: {
  botToken?: string;
  chatId?: string;
}): Promise<TelegramTestResult> {
  return request<TelegramTestResult>("/api/notifications/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input ?? {}),
  });
}

export function clearTelegramSettings(): Promise<NotificationsState> {
  return request<NotificationsState>("/api/notifications/telegram", {
    method: "DELETE",
  });
}
