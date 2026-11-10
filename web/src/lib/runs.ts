import { formatNumber } from "./format";
import type { Translate } from "../i18n";
import type { Run, RunKind } from "../types";

export function runKindLabel(kind: RunKind, t: Translate): string {
  return kind === "search" ? t("Search") : t("Apply");
}

/** One-line human summary of a finished run, or its current state. */
export function describeRun(run: Run, t: Translate, locale = "en-US"): string {
  if (run.status === "cancelled") return t("Stopped by user");
  if (run.error) return run.error;
  if (!run.result) {
    return run.status === "queued"
      ? t("Waiting in the queue")
      : t("In progress");
  }

  if (run.result.kind === "search") {
    const { jobsFound, scored, scoredLow, errors } = run.result.summary;
    return t("{found} found · {scored} scored · {low} low · {errors} errors", {
      found: formatNumber(jobsFound, locale),
      scored: formatNumber(scored, locale),
      low: formatNumber(scoredLow, locale),
      errors: formatNumber(errors, locale),
    });
  }

  const { applied, alreadyApplied, expired, error } = run.result.summary;
  return t(
    "{applied} applied · {already} already · {expired} expired · {errors} errors",
    {
      applied: formatNumber(applied, locale),
      already: formatNumber(alreadyApplied, locale),
      expired: formatNumber(expired, locale),
      errors: formatNumber(error, locale),
    },
  );
}

/** Describes the inputs a run was started with. */
export function describeRunParams(
  run: Run,
  t: Translate,
  locale = "en-US",
): string {
  const params = run.params;

  if (run.kind === "search") {
    const keyword = typeof params.keyword === "string" ? params.keyword : "—";
    const platform =
      typeof params.platform === "string" ? params.platform : "—";
    const pages =
      typeof params.maxPages === "number"
        ? formatNumber(params.maxPages, locale)
        : "—";
    const minScore =
      typeof params.minScore === "number"
        ? formatNumber(params.minScore, locale)
        : "—";
    return t("{keyword} · {platform} · {pages} pages · min score {minScore}", {
      keyword,
      platform,
      pages,
      minScore,
    });
  }

  const minScore =
    typeof params.minScore === "number"
      ? formatNumber(params.minScore, locale)
      : "—";
  const maxApplies =
    typeof params.maxApplies === "number" && params.maxApplies > 0
      ? formatNumber(params.maxApplies, locale)
      : "∞";
  const mode = params.liveApply === true ? t("live") : t("dry run");
  return t("{mode} · min score {minScore} · max {maxApplies}", {
    mode,
    minScore,
    maxApplies,
  });
}

export function runDurationSeconds(run: Run): number | null {
  if (!run.started_at || !run.finished_at) return null;
  const start = new Date(run.started_at).getTime();
  const end = new Date(run.finished_at).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return Math.round((end - start) / 1000);
}

export function formatDuration(seconds: number, locale = "en-US"): string {
  if (seconds < 60) return `${formatNumber(seconds, locale)}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes < 60) {
    return `${formatNumber(minutes, locale)}m ${formatNumber(rest, locale)}s`;
  }
  const hours = Math.floor(minutes / 60);
  return `${formatNumber(hours, locale)}h ${formatNumber(minutes % 60, locale)}m`;
}
