import { useCallback, useMemo, useState } from "react";
import { deleteJob, fetchJob, wipeJobs } from "../api";
import { Button, buttonClasses } from "../components/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { DetailPanel } from "../components/DetailPanel";
import { FilterBar } from "../components/FilterBar";
import { JobCard } from "../components/JobCard";
import { JobsTable } from "../components/JobsTable";
import { Pagination } from "../components/Pagination";
import { CardSkeleton } from "../components/Skeleton";
import type { ToastKind } from "../components/Toast";
import { AlertCircleIcon, TrashIcon } from "../components/icons";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useJobs } from "../hooks/useJobs";
import { useI18n } from "../i18n";
import { formatNumber } from "../lib/format";
import { DEFAULT_FILTERS, type Filters, type Job } from "../types";

type ConfirmState = { kind: "wipe" } | { kind: "delete"; job: Job };

interface JobsPageProps {
  notify: (kind: ToastKind, message: string) => void;
}

export function JobsPage({ notify }: JobsPageProps) {
  const { t, locale } = useI18n();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);

  const debouncedQ = useDebouncedValue(filters.q, 300);

  const queryFilters = useMemo<Filters>(
    () => ({
      q: debouncedQ,
      statuses: filters.statuses,
      platforms: filters.platforms,
      minScore: filters.minScore,
      maxScore: filters.maxScore,
      seenAfter: filters.seenAfter,
      seenBefore: filters.seenBefore,
      sort: filters.sort,
      order: filters.order,
    }),
    [
      debouncedQ,
      filters.statuses,
      filters.platforms,
      filters.minScore,
      filters.maxScore,
      filters.seenAfter,
      filters.seenBefore,
      filters.sort,
      filters.order,
    ],
  );

  const { data, loading, error, reload } = useJobs(queryFilters, limit, offset);

  const [selected, setSelected] = useState<Job | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [busy, setBusy] = useState(false);

  const showToast = useCallback(
    (kind: ToastKind, message: string) => {
      notify(kind, message);
    },
    [notify],
  );

  const updateFilters = useCallback((patch: Partial<Filters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setOffset(0);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters((current) => ({
      ...DEFAULT_FILTERS,
      sort: current.sort,
      order: current.order,
    }));
    setOffset(0);
  }, []);

  const hasActiveFilters =
    filters.q.trim() !== "" ||
    filters.statuses.length > 0 ||
    filters.platforms.length > 0 ||
    filters.minScore !== "" ||
    filters.maxScore !== "" ||
    filters.seenAfter !== "" ||
    filters.seenBefore !== "";

  const openJob = useCallback((job: Job) => {
    setSelected(job);
    fetchJob(job.id)
      .then((fresh) => {
        setSelected((current) =>
          current && current.id === fresh.id ? fresh : current,
        );
      })
      .catch(() => {
        // Keep the list copy if the detail refresh fails.
      });
  }, []);

  const closePanel = useCallback(() => setSelected(null), []);

  const requestDelete = useCallback((job: Job) => {
    setConfirm({ kind: "delete", job });
  }, []);

  const requestWipe = useCallback(() => {
    setConfirm({ kind: "wipe" });
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!confirm) return;

    setBusy(true);
    try {
      if (confirm.kind === "wipe") {
        const { deleted } = await wipeJobs();
        showToast(
          "success",
          t(deleted === 1 ? "Deleted {count} job." : "Deleted {count} jobs.", {
            count: formatNumber(deleted, locale),
          }),
        );
        setSelected(null);
        setOffset(0);
        reload();
      } else {
        await deleteJob(confirm.job.id);
        showToast("success", t("Job deleted."));
        setSelected((current) =>
          current?.id === confirm.job.id ? null : current,
        );

        const deletedLastRowOnPage = data?.data.length === 1 && offset > 0;
        if (deletedLastRowOnPage) {
          setOffset(Math.max(0, offset - limit));
        } else {
          reload();
        }
      }
      setConfirm(null);
    } catch (caught) {
      showToast(
        "error",
        caught instanceof Error ? caught.message : t("Something went wrong."),
      );
    } finally {
      setBusy(false);
    }
  }, [confirm, data, limit, offset, reload, showToast, t, locale]);

  const handleLimitChange = useCallback((nextLimit: number) => {
    setLimit(nextLimit);
    setOffset(0);
  }, []);

  const showEmptyState = !loading && data !== null && data.total === 0;

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
      <div className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-ink">
              {t("Jobs")}
            </h1>
            <p className="text-xs text-ink-subtle">
              {data
                ? t(
                    data.total === 1
                      ? "{count} job in the database"
                      : "{count} jobs in the database",
                    { count: formatNumber(data.total, locale) },
                  )
                : t("Loading the job database…")}
            </p>
          </div>

          <Button
            variant="danger"
            size="sm"
            onClick={requestWipe}
            disabled={busy}
          >
            <TrashIcon className="h-3.5 w-3.5" />
            {t("Wipe all jobs")}
          </Button>
        </div>
      </div>

      <FilterBar
        filters={filters}
        onChange={updateFilters}
        onClear={clearFilters}
        active={hasActiveFilters}
      />

      <main className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            {error && (
              <div className="mb-4">
                <ErrorAlert message={error} onRetry={reload} />
              </div>
            )}

            {!data && error ? null : loading ? (
              <>
                <JobsTable
                  jobs={[]}
                  loading
                  onSelect={openJob}
                  skeletonRows={Math.min(limit, 10)}
                />
                <div className="md:hidden">
                  <CardSkeleton count={Math.min(limit, 8)} />
                </div>
              </>
            ) : showEmptyState ? (
              hasActiveFilters ? (
                <NoMatches onClear={clearFilters} />
              ) : (
                <NoJobs />
              )
            ) : (
              <>
                <JobsTable
                  jobs={data?.data ?? []}
                  loading={false}
                  onSelect={openJob}
                />
                <div className="flex flex-col gap-3 md:hidden">
                  {(data?.data ?? []).map((job) => (
                    <JobCard key={job.id} job={job} onSelect={openJob} />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <Pagination
          total={data?.total ?? 0}
          limit={limit}
          offset={offset}
          onOffsetChange={setOffset}
          onLimitChange={handleLimitChange}
          disabled={loading}
        />
      </main>

      {selected && (
        <DetailPanel
          job={selected}
          onClose={closePanel}
          onDelete={requestDelete}
          suspended={confirm !== null}
        />
      )}

      {confirm && (
        <ConfirmDialog
          title={
            confirm.kind === "wipe"
              ? t("Wipe all jobs?")
              : t("Delete this job?")
          }
          description={
            confirm.kind === "wipe" ? (
              t(
                "This permanently deletes every job in the database and resets IDs. This cannot be undone.",
              )
            ) : (
              <>
                {t("Remove {title} from the database? This cannot be undone.", {
                  title: confirm.job.title ?? confirm.job.url,
                })}
              </>
            )
          }
          confirmLabel={
            confirm.kind === "wipe" ? t("Wipe all jobs") : t("Delete job")
          }
          requireText={confirm.kind === "wipe" ? "DELETE" : undefined}
          tone="danger"
          busy={busy}
          onConfirm={handleConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

function ErrorAlert({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const { t } = useI18n();
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-lg border border-danger/30 bg-danger-soft p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-2">
        <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-danger-text" />
        <div>
          <p className="text-sm font-medium text-danger-text">
            {t("Could not load jobs")}
          </p>
          <p dir="auto" className="mt-0.5 text-sm text-danger-text">
            {message}
          </p>
        </div>
      </div>
      <Button variant="secondary" onClick={onRetry} className="shrink-0">
        {t("Retry")}
      </Button>
    </div>
  );
}

function NoJobs() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line bg-surface px-6 py-16 text-center">
      <h2 className="text-sm font-semibold text-ink">{t("No jobs yet")}</h2>
      <p className="mt-1 max-w-md text-sm text-ink-muted">
        {t(
          "The database is empty. Start a search from the Runs page, or run the CLI to populate it.",
        )}
      </p>
      <a href="#/runs" className={buttonClasses("primary", "sm", "mt-4")}>
        {t("Go to Runs")}
      </a>
    </div>
  );
}

function NoMatches({ onClear }: { onClear: () => void }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line bg-surface px-6 py-16 text-center">
      <h2 className="text-sm font-semibold text-ink">
        {t("No jobs match these filters")}
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        {t("Try widening your search or clearing the filters.")}
      </p>
      <Button variant="secondary" onClick={onClear} className="mt-4">
        {t("Clear filters")}
      </Button>
    </div>
  );
}
