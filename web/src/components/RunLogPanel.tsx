import { useEffect, useMemo, useRef, useState } from "react";
import { fetchRun, resumeRun, stopRun } from "../api";
import { useRunEvents } from "../hooks/useRunEvents";
import { useI18n, type Translate } from "../i18n";
import { cn } from "../lib/cn";
import { formatDateTime, formatNumber } from "../lib/format";
import { runKindLabel } from "../lib/runs";
import type { PipelineEvent, Run, RunStatus } from "../types";
import { Button } from "./Button";
import { RunStatusBadge } from "./RunStatusBadge";
import type { ToastKind } from "./Toast";
import {
  AlertCircleIcon,
  CheckCircleIcon,
  ExternalLinkIcon,
  InfoIcon,
  LoaderIcon,
  PlayIcon,
  RotateCcwIcon,
  StopIcon,
  TrashIcon,
  XIcon,
} from "./icons";

interface RunLogPanelProps {
  runId: number | null;
  onClose: () => void;
  onDone?: (runId: number) => void;
  onResumed?: (runId: number) => void;
  notify: (kind: ToastKind, message: string) => void;
}

export function RunLogPanel({
  runId,
  onClose,
  onDone,
  onResumed,
  notify,
}: RunLogPanelProps) {
  const { t, locale } = useI18n();
  const [run, setRun] = useState<Run | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stopBusy, setStopBusy] = useState(false);
  const [stopRequested, setStopRequested] = useState(false);
  const [resumeBusy, setResumeBusy] = useState(false);
  const [cleared, setCleared] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const { events, state, error: streamError } = useRunEvents(runId, onDone);

  useEffect(() => {
    if (runId === null) {
      setRun(null);
      setLoadError(null);
      return;
    }

    const controller = new AbortController();
    setRun(null);
    setLoadError(null);

    fetchRun(runId, controller.signal)
      .then(setRun)
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === "AbortError") {
          return;
        }
        setLoadError(caught instanceof Error ? caught.message : String(caught));
      });

    return () => controller.abort();
  }, [runId]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTop = list.scrollHeight;
  }, [events.length]);

  // A different run is a fresh panel: forget any stop/clear state from the
  // previous one.
  useEffect(() => {
    setCleared(false);
    setStopBusy(false);
    setStopRequested(false);
    setResumeBusy(false);
  }, [runId]);

  const status: RunStatus = useMemo(() => {
    let terminal: PipelineEvent | undefined;
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const event = events[index];
      if (
        event.type === "run_finished" ||
        event.type === "run_failed" ||
        event.type === "run_cancelled"
      ) {
        terminal = event;
        break;
      }
    }
    if (terminal?.type === "run_finished") return "completed";
    if (terminal?.type === "run_failed") return "failed";
    if (terminal?.type === "run_cancelled") return "cancelled";

    if (state === "live" || state === "connecting") {
      // The run record is fetched alongside the stream; trust a terminal status
      // from it until the replay arrives.
      if (
        run?.status === "queued" ||
        run?.status === "completed" ||
        run?.status === "failed" ||
        run?.status === "cancelled"
      ) {
        return run.status;
      }
      return "running";
    }
    return run?.status ?? "queued";
  }, [events, state, run?.status]);

  const active = status === "queued" || status === "running";
  const stopping = (stopBusy || stopRequested) && active;

  const handleStop = async () => {
    if (runId === null || stopping) return;

    setStopBusy(true);
    setStopRequested(true);
    try {
      await stopRun(runId);
      notify(
        "success",
        t("Stop requested for run #{id}.", {
          id: formatNumber(runId, locale),
        }),
      );
    } catch (caught) {
      setStopRequested(false);
      notify(
        "error",
        caught instanceof Error ? caught.message : String(caught),
      );
    } finally {
      setStopBusy(false);
    }
  };

  const handleResume = async () => {
    if (runId === null || resumeBusy) return;

    setResumeBusy(true);
    try {
      const result = await resumeRun(runId);
      notify(
        "success",
        t("Run #{id} resumed as run #{runId}.", {
          id: formatNumber(runId, locale),
          runId: formatNumber(result.runId, locale),
        }),
      );
      onResumed?.(result.runId);
    } catch (caught) {
      notify(
        "error",
        caught instanceof Error ? caught.message : String(caught),
      );
    } finally {
      setResumeBusy(false);
    }
  };

  return (
    <section
      aria-label={t("Run log")}
      className="flex max-h-[70vh] flex-col rounded-lg border border-line bg-surface shadow-sm lg:sticky lg:top-20 lg:max-h-[calc(100dvh-7rem)]"
    >
      <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-ink">
              {runId === null
                ? t("Run log")
                : t("Run #{id}", { id: formatNumber(runId, locale) })}
            </h2>
            {runId !== null && <RunStatusBadge status={status} />}
          </div>
          <p className="mt-1 text-xs text-ink-subtle">
            {run
              ? t("{kind} · started {date}", {
                  kind: runKindLabel(run.kind, t),
                  date: formatDateTime(
                    run.started_at ?? run.created_at,
                    locale,
                  ),
                })
              : t("Live events from the selected run")}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {(state === "connecting" || state === "live") && (
            <LoaderIcon className="h-4 w-4 text-accent motion-safe:animate-spin" />
          )}
          {runId !== null && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label={t("Close run log")}
            >
              <XIcon />
            </Button>
          )}
        </div>
      </header>

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-3">
        {cleared ? (
          <p className="px-2 py-10 text-center text-sm text-ink-subtle">
            {t("Log cleared. This run is still in the history below.")}
          </p>
        ) : runId === null ? (
          <p className="px-2 py-10 text-center text-sm text-ink-subtle">
            {t(
              "Start a run or pick one from the history to watch its progress.",
            )}
          </p>
        ) : loadError ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger-text"
          >
            <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span dir="auto">{t(loadError)}</span>
          </div>
        ) : events.length === 0 ? (
          <p className="px-2 py-10 text-center text-sm text-ink-subtle">
            {state === "done"
              ? t("This run finished without recording events.")
              : t("Waiting for the first event…")}
          </p>
        ) : (
          <ol className="space-y-1">
            {events.map((event, index) => (
              <LogRow key={index} event={event} />
            ))}
          </ol>
        )}
      </div>

      {runId !== null && (active || status === "cancelled") && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
          {active && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => void handleStop()}
              disabled={stopping}
            >
              {stopping ? (
                <LoaderIcon className="h-3.5 w-3.5 motion-safe:animate-spin" />
              ) : (
                <StopIcon className="h-3.5 w-3.5" />
              )}
              {stopping ? t("Stopping…") : t("Stop")}
            </Button>
          )}

          {status === "cancelled" && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCleared(true)}
              >
                <TrashIcon className="h-3.5 w-3.5" />
                {t("Clear")}
              </Button>
              {run?.kind === "search" && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => void handleResume()}
                  disabled={resumeBusy}
                >
                  {resumeBusy ? (
                    <LoaderIcon className="h-3.5 w-3.5 motion-safe:animate-spin" />
                  ) : (
                    <RotateCcwIcon className="h-3.5 w-3.5" />
                  )}
                  {resumeBusy ? t("Resuming…") : t("runs.action.resume")}
                </Button>
              )}
            </>
          )}

          <p className="ms-auto text-2xs text-ink-subtle">
            {active
              ? t("Stops after the current job finishes.")
              : run?.kind === "search"
                ? t("Resume skips jobs this run already processed.")
                : t("Clear hides the log without deleting the run.")}
          </p>
        </div>
      )}

      {streamError && (
        <p
          role="status"
          className="border-t border-line px-4 py-2 text-xs text-danger-text"
        >
          {streamError}
        </p>
      )}
    </section>
  );
}

interface EventView {
  icon: typeof InfoIcon;
  tone: string;
  title: string;
  detail?: string;
  href?: string;
}

function jobLabel(job: { title: string | null; url: string }): string {
  return job.title ?? job.url;
}

function describeEvent(
  event: PipelineEvent,
  t: Translate,
  locale: string,
): EventView {
  switch (event.type) {
    case "run_started":
      return {
        icon: PlayIcon,
        tone: "text-accent-text",
        title: t(
          event.kind === "search" ? "Search run started" : "Apply run started",
        ),
      };
    case "jobs_found":
      return {
        icon: InfoIcon,
        tone: "text-ink-muted",
        title: t(
          event.total === 1 ? "Found {count} job" : "Found {count} jobs",
          { count: formatNumber(event.total, locale) },
        ),
      };
    case "job_skipped":
      return {
        icon: InfoIcon,
        tone: "text-ink-subtle",
        title: t("Skipped {job}", { job: jobLabel(event.job) }),
        detail:
          event.reason === "already_processed"
            ? t("Already processed by the previous run")
            : t("No description available"),
        href: event.job.url,
      };
    case "job_filtered":
      return {
        icon: InfoIcon,
        tone: "text-status-scored-low",
        title: t("Filtered {job}", { job: jobLabel(event.job) }),
        detail: `${t(
          event.filter === "experience"
            ? "Experience filter"
            : "Location filter",
        )}${event.detail ? `: ${event.detail}` : ""}`,
        href: event.job.url,
      };
    case "job_scored":
      return {
        icon: CheckCircleIcon,
        tone:
          event.status === "scored"
            ? "text-status-scored"
            : "text-status-scored-low",
        title: t("{job} — {score}", {
          job: jobLabel(event.job),
          score: formatNumber(event.score, locale),
        }),
        detail: event.status === "scored" ? t("Scored") : t("Below threshold"),
        href: event.job.url,
      };
    case "job_error":
      return {
        icon: AlertCircleIcon,
        tone: "text-danger-text",
        title: t("Error on {job}", { job: jobLabel(event.job) }),
        detail: event.error,
        href: event.job.url,
      };
    case "apply_result":
      switch (event.result.status) {
        case "success":
          return {
            icon: CheckCircleIcon,
            tone: "text-status-applied",
            title: t("Applied to {job}", { job: jobLabel(event.job) }),
            href: event.job.url,
          };
        case "alreadyApplied":
          return {
            icon: InfoIcon,
            tone: "text-status-already-applied",
            title: t("Already applied — {job}", { job: jobLabel(event.job) }),
            href: event.job.url,
          };
        case "expired":
          return {
            icon: InfoIcon,
            tone: "text-status-expired",
            title: t("Expired — {job}", { job: jobLabel(event.job) }),
            href: event.job.url,
          };
        case "error":
          return {
            icon: AlertCircleIcon,
            tone: "text-danger-text",
            title: t("Apply failed — {job}", { job: jobLabel(event.job) }),
            detail: event.result.reason,
            href: event.job.url,
          };
      }
    case "apply_dry_run":
      return {
        icon: InfoIcon,
        tone: "text-ink-muted",
        title: t("Would apply — {job}", { job: jobLabel(event.job) }),
        detail: t("Dry run"),
        href: event.job.url,
      };
    case "apply_skipped":
      return {
        icon: InfoIcon,
        tone: "text-ink-subtle",
        title: t("Skipped — {job}", { job: jobLabel(event.job) }),
        detail: event.reason,
        href: event.job.url,
      };
    case "run_finished": {
      const summary =
        event.result.kind === "search"
          ? t("{found} found · {scored} scored · {low} low · {errors} errors", {
              found: formatNumber(event.result.summary.jobsFound, locale),
              scored: formatNumber(event.result.summary.scored, locale),
              low: formatNumber(event.result.summary.scoredLow, locale),
              errors: formatNumber(event.result.summary.errors, locale),
            })
          : t(
              "{applied} applied · {already} already · {expired} expired · {errors} errors",
              {
                applied: formatNumber(event.result.summary.applied, locale),
                already: formatNumber(
                  event.result.summary.alreadyApplied,
                  locale,
                ),
                expired: formatNumber(event.result.summary.expired, locale),
                errors: formatNumber(event.result.summary.error, locale),
              },
            );
      return {
        icon: CheckCircleIcon,
        tone: "text-status-applied",
        title: t("Run finished"),
        detail: summary,
      };
    }
    case "run_failed":
      return {
        icon: AlertCircleIcon,
        tone: "text-danger-text",
        title: t("Run failed"),
        detail: event.error,
      };
    case "run_cancelled":
      return {
        icon: StopIcon,
        tone: "text-status-expired",
        title: t("Run stopped"),
        detail: event.reason,
      };
    case "run_resumed":
      return {
        icon: RotateCcwIcon,
        tone: "text-accent-text",
        title: t("Resumed from run #{id}", {
          id: formatNumber(event.fromRunId, locale),
        }),
        detail: t("Jobs already processed by that run are skipped"),
      };
  }
}

function LogRow({ event }: { event: PipelineEvent }) {
  const { t, locale } = useI18n();
  const view = describeEvent(event, t, locale);
  const Icon = view.icon;

  return (
    <li className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-surface-hover">
      <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", view.tone)} />
      <div className="min-w-0 flex-1">
        <p dir="auto" className="text-xs leading-5 break-words text-ink">
          {view.href ? (
            <a
              href={view.href}
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            >
              {view.title}
            </a>
          ) : (
            view.title
          )}
        </p>
        {view.detail && (
          <p
            dir="auto"
            className="text-2xs leading-4 break-words text-ink-subtle"
          >
            {view.detail}
          </p>
        )}
      </div>
      {view.href && (
        <ExternalLinkIcon className="mt-0.5 h-3 w-3 shrink-0 text-ink-subtle" />
      )}
    </li>
  );
}
