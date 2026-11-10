import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { fetchStats } from "../api";
import { Button } from "../components/Button";
import {
  ColumnChart,
  DonutChart,
  type DonutSegment,
} from "../components/charts";
import { RunStatusBadge } from "../components/RunStatusBadge";
import { Skeleton } from "../components/Skeleton";
import { StatCard } from "../components/StatCard";
import {
  AlertCircleIcon,
  CheckCircleIcon,
  DatabaseIcon,
  OverviewIcon,
  PlayIcon,
} from "../components/icons";
import { formatDateTime, formatNumber } from "../lib/format";
import { describeRun, runKindLabel } from "../lib/runs";
import { useI18n } from "../i18n";
import type { Stats } from "../types";

interface OverviewPageProps {
  onOpenRuns: () => void;
}

export function OverviewPage({ onOpenRuns }: OverviewPageProps) {
  const { t, locale } = useI18n();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetchStats(controller.signal)
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === "AbortError") {
          return;
        }
        setError(caught instanceof Error ? caught.message : String(caught));
        setLoading(false);
      });

    return () => controller.abort();
  }, [version]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-xl border border-line bg-linear-to-br from-accent-soft/70 via-surface to-accent-2-soft/60 p-5 shadow-sm">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -end-16 -top-20 h-44 w-44 rounded-full bg-accent/15 blur-2xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute start-1/3 -bottom-24 h-40 w-40 rounded-full bg-accent-2/10 blur-2xl"
        />
        <div className="relative flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-ink">
              {t("Overview")}
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              {t("A snapshot of your job search, scoring and applications.")}
            </p>
          </div>
          <div className="text-end">
            <p className="text-2xs text-ink-subtle">
              {t("Last database update")}
            </p>
            <p className="text-xs text-ink-muted">
              {stats ? formatDateTime(stats.lastUpdatedAt, locale) : "—"}
            </p>
          </div>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="mt-4 flex flex-col gap-3 rounded-lg border border-danger/30 bg-danger-soft p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2">
            <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-danger-text" />
            <div>
              <p className="text-sm font-medium text-danger-text">
                {t("Could not load stats")}
              </p>
              <p dir="auto" className="mt-0.5 text-sm text-danger-text">
                {error}
              </p>
            </div>
          </div>
          <Button variant="secondary" onClick={reload} className="shrink-0">
            {t("Retry")}
          </Button>
        </div>
      )}

      {loading && !stats ? (
        <OverviewSkeleton />
      ) : stats ? (
        <OverviewContent stats={stats} onOpenRuns={onOpenRuns} />
      ) : null}
    </div>
  );
}

function OverviewContent({
  stats,
  onOpenRuns,
}: {
  stats: Stats;
  onOpenRuns: () => void;
}) {
  const { t, locale } = useI18n();
  const applied = stats.byStatus.applied ?? 0;
  const appliedPercent =
    stats.total > 0 ? Math.round((applied / stats.total) * 100) : 0;

  const statusSegments = useMemo<DonutSegment[]>(
    () => [
      {
        label: t("Applied"),
        value: stats.byStatus.applied ?? 0,
        colorClass: "text-status-applied",
        swatchClass: "bg-status-applied",
      },
      {
        label: t("Scored"),
        value: stats.byStatus.scored ?? 0,
        colorClass: "text-status-scored",
        swatchClass: "bg-status-scored",
      },
      {
        label: t("Below threshold"),
        value: stats.byStatus.scored_low ?? 0,
        colorClass: "text-status-scored-low",
        swatchClass: "bg-status-scored-low",
      },
      {
        label: t("Already applied"),
        value: stats.byStatus.already_applied ?? 0,
        colorClass: "text-status-already-applied",
        swatchClass: "bg-status-already-applied",
      },
      {
        label: t("Unprocessed"),
        value:
          (stats.byStatus.seen ?? 0) +
          (stats.byStatus.filtered_experience ?? 0) +
          (stats.byStatus.filtered_location ?? 0),
        colorClass: "text-status-seen",
        swatchClass: "bg-status-seen",
      },
      {
        label: t("Expired"),
        value: stats.byStatus.expired ?? 0,
        colorClass: "text-status-expired",
        swatchClass: "bg-status-expired",
      },
      {
        label: t("Error"),
        value: stats.byStatus.error ?? 0,
        colorClass: "text-status-error",
        swatchClass: "bg-status-error",
      },
    ],
    [stats, t],
  );

  const platformSegments = useMemo<DonutSegment[]>(
    () => [
      {
        label: "Jobinja",
        value: stats.byPlatform.jobinja ?? 0,
        colorClass: "text-accent",
        swatchClass: "bg-accent",
      },
      {
        label: "Jobvision",
        value: stats.byPlatform.jobvision ?? 0,
        colorClass: "text-status-already-applied",
        swatchClass: "bg-status-already-applied",
      },
    ],
    [stats],
  );

  const scoreByBucket = useMemo(
    () =>
      new Map(
        stats.scoreBuckets.map((bucket) => [bucket.bucket, bucket.count]),
      ),
    [stats.scoreBuckets],
  );

  const scoreData = useMemo(
    () =>
      Array.from({ length: 10 }, (_, index) => ({
        label:
          index === 9
            ? `${formatNumber(90, locale)}+`
            : formatNumber(index * 10, locale),
        values: [scoreByBucket.get(index * 10) ?? 0],
      })),
    [scoreByBucket, locale],
  );

  const activityData = useMemo(
    () =>
      stats.activity.map((point) => ({
        label: formatNumber(Number(point.date.slice(8, 10)), locale),
        values: [point.seen, point.applied],
      })),
    [stats.activity, locale],
  );

  const activityTotals = useMemo(
    () =>
      stats.activity.reduce(
        (totals, point) => ({
          seen: totals.seen + point.seen,
          applied: totals.applied + point.applied,
        }),
        { seen: 0, applied: 0 },
      ),
    [stats.activity],
  );

  return (
    <div className="mt-5 space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label={t("Total jobs")}
          value={formatNumber(stats.total, locale)}
          hint={t(
            stats.runs.total === 1
              ? "{count} run recorded"
              : "{count} runs recorded",
            { count: formatNumber(stats.runs.total, locale) },
          )}
          icon={DatabaseIcon}
          tone="accent"
        />
        <StatCard
          label={t("Applied")}
          value={formatNumber(applied, locale)}
          hint={t("{percent}% of all jobs", {
            percent: formatNumber(appliedPercent, locale),
          })}
          icon={CheckCircleIcon}
          tone="success"
        />
        <StatCard
          label={t("Average score")}
          value={
            stats.averageScore == null
              ? "—"
              : formatNumber(stats.averageScore, locale)
          }
          hint={t(
            stats.scoredCount === 1
              ? "{count} job scored"
              : "{count} jobs scored",
            { count: formatNumber(stats.scoredCount, locale) },
          )}
          icon={OverviewIcon}
          tone="warning"
        />
        <StatCard
          label={t("Completed runs")}
          value={formatNumber(stats.runs.byStatus.completed ?? 0, locale)}
          hint={t("{failed} failed · {cancelled} stopped · {running} running", {
            failed: formatNumber(stats.runs.byStatus.failed ?? 0, locale),
            cancelled: formatNumber(stats.runs.byStatus.cancelled ?? 0, locale),
            running: formatNumber(stats.runs.byStatus.running ?? 0, locale),
          })}
          icon={PlayIcon}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <ChartCard
          title={t("Status breakdown")}
          subtitle={t("Where every job currently sits")}
          className="lg:col-span-5"
        >
          <DonutChart
            segments={statusSegments}
            centerLabel={t("jobs")}
            centerValue={stats.total}
            locale={locale}
            ariaLabel={t("Job status breakdown: {summary}", {
              summary: statusSegments
                .map((segment) => `${segment.label} ${segment.value}`)
                .join(", "),
            })}
          />
        </ChartCard>

        <ChartCard
          title={t("Activity")}
          subtitle={t("Jobs seen and applied over the last 14 days")}
          className="lg:col-span-7"
          aside={
            <div className="flex items-center gap-3 text-2xs text-ink-subtle">
              <span>
                <span className="font-mono text-ink">
                  {formatNumber(activityTotals.seen, locale)}
                </span>{" "}
                {t("seen")}
              </span>
              <span>
                <span className="font-mono text-ink">
                  {formatNumber(activityTotals.applied, locale)}
                </span>{" "}
                {t("applied")}
              </span>
            </div>
          }
        >
          <ColumnChart
            data={activityData}
            series={[
              {
                label: t("Seen"),
                fillClass: "fill-accent",
                swatchClass: "bg-accent",
              },
              {
                label: t("Applied"),
                fillClass: "fill-status-applied",
                swatchClass: "bg-status-applied",
              },
            ]}
            locale={locale}
            ariaLabel={t(
              "Activity over the last 14 days: {seen} jobs seen and {applied} applied.",
              {
                seen: formatNumber(activityTotals.seen, locale),
                applied: formatNumber(activityTotals.applied, locale),
              },
            )}
            labelEvery={2}
          />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <ChartCard
          title={t("Score distribution")}
          subtitle={t("Scored jobs grouped into ten-point buckets")}
          className="lg:col-span-7"
          aside={
            <span className="text-2xs text-ink-subtle">
              {t("avg")}{" "}
              <span className="font-mono text-ink">
                {stats.averageScore == null
                  ? "—"
                  : formatNumber(stats.averageScore, locale)}
              </span>
            </span>
          }
        >
          <ColumnChart
            data={scoreData}
            series={[
              {
                label: t("Jobs"),
                fillClass: "fill-accent",
                swatchClass: "bg-accent",
              },
            ]}
            locale={locale}
            ariaLabel={t("Job count by score bucket.")}
          />
        </ChartCard>

        <ChartCard
          title={t("Platform split")}
          subtitle={t("Where the listings came from")}
          className="lg:col-span-5"
        >
          <DonutChart
            segments={platformSegments}
            centerLabel={t("jobs")}
            centerValue={stats.total}
            locale={locale}
            ariaLabel={t(
              "Platform split: Jobinja {jobinja}, Jobvision {jobvision}.",
              {
                jobinja: formatNumber(stats.byPlatform.jobinja ?? 0, locale),
                jobvision: formatNumber(
                  stats.byPlatform.jobvision ?? 0,
                  locale,
                ),
              },
            )}
          />
        </ChartCard>
      </div>

      <ChartCard
        title={t("Recent runs")}
        subtitle={t("The latest searches and apply passes")}
        aside={
          <Button variant="ghost" size="sm" onClick={onOpenRuns}>
            {t("View runs")}
          </Button>
        }
      >
        {stats.recentRuns.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line px-4 py-10 text-center">
            <p className="text-sm text-ink-muted">{t("No runs yet.")}</p>
            <Button
              variant="primary"
              size="sm"
              onClick={onOpenRuns}
              className="mt-3"
            >
              {t("Start a search")}
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {stats.recentRuns.map((run) => (
              <li key={run.id} className="py-2.5 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-mono text-xs text-ink-subtle">
                    #{run.id}
                  </span>
                  <span className="text-sm font-medium text-ink">
                    {runKindLabel(run.kind, t)}
                  </span>
                  <RunStatusBadge status={run.status} />
                  <span className="ms-auto text-2xs text-ink-subtle">
                    {formatDateTime(run.finished_at ?? run.created_at, locale)}
                  </span>
                </div>
                <p
                  dir="auto"
                  className="mt-0.5 truncate text-xs text-ink-muted"
                >
                  {describeRun(run, t, locale)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </ChartCard>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  aside,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`rounded-lg border border-line bg-surface p-4 shadow-sm ${className ?? ""}`}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          {subtitle && (
            <p className="mt-0.5 text-xs text-ink-subtle">{subtitle}</p>
          )}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

function OverviewSkeleton() {
  return (
    <div className="mt-5 space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-lg border border-line bg-surface p-4 shadow-sm"
          >
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-7 w-16" />
            <Skeleton className="mt-3 h-3 w-24" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="rounded-lg border border-line bg-surface p-4 shadow-sm lg:col-span-5">
          <Skeleton className="h-4 w-32" />
          <div className="mt-4 flex items-center gap-5">
            <Skeleton className="h-36 w-36 rounded-full" />
            <div className="flex-1 space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-3 w-full" />
              ))}
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-line bg-surface p-4 shadow-sm lg:col-span-7">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-4 h-40 w-full" />
        </div>
      </div>
    </div>
  );
}
