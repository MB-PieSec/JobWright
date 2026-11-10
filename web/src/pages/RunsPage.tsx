import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  fetchRuns,
  startRun,
  type ApplyRunInput,
  type SearchRunInput,
  type StartRunInput,
} from "../api";
import { Button } from "../components/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Input } from "../components/Input";
import { RunLogPanel } from "../components/RunLogPanel";
import { RunStatusBadge } from "../components/RunStatusBadge";
import { Select } from "../components/Select";
import { Skeleton } from "../components/Skeleton";
import type { ToastKind } from "../components/Toast";
import {
  AlertCircleIcon,
  LoaderIcon,
  PlayIcon,
  RefreshIcon,
  SearchIcon,
} from "../components/icons";
import { formatDateTime, formatNumber } from "../lib/format";
import {
  describeRun,
  describeRunParams,
  formatDuration,
  runDurationSeconds,
  runKindLabel,
} from "../lib/runs";
import { useI18n } from "../i18n";
import { PLATFORMS, type Run, type RunsResponse } from "../types";

type Notify = (kind: ToastKind, message: string) => void;

interface RunsPageProps {
  notify: Notify;
}

function toInt(
  value: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

export function RunsPage({ notify }: RunsPageProps) {
  const { t, locale } = useI18n();
  const [runs, setRuns] = useState<RunsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const [activeRunId, setActiveRunId] = useState<number | null>(null);
  const [starting, setStarting] = useState<"search" | "apply" | null>(null);
  const [pendingApply, setPendingApply] = useState<ApplyRunInput | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetchRuns({ limit: 50 }, controller.signal)
      .then((data) => {
        setRuns(data);
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

  const submit = useCallback(
    async (input: StartRunInput) => {
      setStarting(input.kind);
      try {
        const { runId } = await startRun(input);
        notify(
          "success",
          t("{kind} run #{id} queued.", {
            kind: runKindLabel(input.kind, t),
            id: formatNumber(runId, locale),
          }),
        );
        setActiveRunId(runId);
        reload();
      } catch (caught) {
        notify(
          "error",
          caught instanceof Error ? caught.message : String(caught),
        );
      } finally {
        setStarting(null);
        setConfirmBusy(false);
        setPendingApply(null);
      }
    },
    [notify, reload, t, locale],
  );

  const requestApply = useCallback(
    (input: ApplyRunInput) => {
      if (input.liveApply) {
        setPendingApply(input);
        return;
      }
      void submit(input);
    },
    [submit],
  );

  const handleRunDone = useCallback(() => reload(), [reload]);

  const handleRunResumed = useCallback(
    (runId: number) => {
      setActiveRunId(runId);
      reload();
    },
    [reload],
  );

  const confirmApply = useCallback(() => {
    if (!pendingApply) return;
    setConfirmBusy(true);
    void submit(pendingApply);
  }, [pendingApply, submit]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-xl border border-line bg-linear-to-br from-accent-soft/70 via-surface to-accent-3-soft/50 p-5 shadow-sm">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -end-16 -top-20 h-44 w-44 rounded-full bg-accent-3/10 blur-2xl"
        />
        <div className="relative">
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            {t("Runs")}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {t(
              "Search the job boards, score matches, and apply — with a live event log.",
            )}
          </p>
        </div>
      </section>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <RunFormCard
          title={t("Search & score")}
          description={t(
            "Scrape listings, filter them, and score each job against your profile.",
          )}
        >
          <SearchForm
            busy={starting === "search"}
            onStart={(input) => void submit(input)}
            notify={notify}
          />
        </RunFormCard>

        <RunFormCard
          title={t("Apply")}
          description={t(
            "Revisit scored jobs and submit applications. Dry runs only report what would happen.",
          )}
        >
          <ApplyForm
            busy={starting === "apply"}
            onStart={requestApply}
            notify={notify}
          />
        </RunFormCard>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <section className="min-w-0 rounded-lg border border-line bg-surface shadow-sm lg:col-span-3">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-ink">
                {t("Recent runs")}
              </h2>
              <p className="mt-0.5 text-xs text-ink-subtle">
                {runs
                  ? t("{count} total", {
                      count: formatNumber(runs.total, locale),
                    })
                  : t("Loading…")}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={reload}
              disabled={loading}
            >
              <RefreshIcon className="h-3.5 w-3.5" />
              {t("Refresh")}
            </Button>
          </header>

          <div className="p-3">
            {error ? (
              <div
                role="alert"
                className="flex flex-col gap-3 rounded-lg border border-danger/30 bg-danger-soft p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-2 text-sm text-danger-text">
                  <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span dir="auto">{error}</span>
                </div>
                <Button variant="secondary" size="sm" onClick={reload}>
                  {t("Retry")}
                </Button>
              </div>
            ) : loading && !runs ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-16 w-full" />
                ))}
              </div>
            ) : runs && runs.data.length === 0 ? (
              <div className="rounded-lg border border-dashed border-line px-4 py-12 text-center">
                <p className="text-sm font-medium text-ink">
                  {t("No runs yet")}
                </p>
                <p className="mt-1 text-sm text-ink-muted">
                  {t("Start a search above to populate the database.")}
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {runs?.data.map((run) => (
                  <li key={run.id}>
                    <RunRow
                      run={run}
                      active={run.id === activeRunId}
                      onSelect={() => setActiveRunId(run.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <div className="min-w-0 lg:col-span-2">
          <RunLogPanel
            runId={activeRunId}
            notify={notify}
            onClose={() => setActiveRunId(null)}
            onDone={handleRunDone}
            onResumed={handleRunResumed}
          />
        </div>
      </div>

      {pendingApply && (
        <ConfirmDialog
          title={t("Start a live apply run?")}
          description={
            <>
              {t(
                "This run will use your imported browser cookies to sign in and",
              )}{" "}
              <span className="font-medium text-ink">
                {t("submit real applications")}
              </span>{" "}
              {t(
                "on Jobinja and Jobvision. Make sure your cookies are fresh and your profile is up to date.",
              )}
            </>
          }
          confirmLabel={t("Start live apply")}
          requireText="APPLY"
          tone="danger"
          busy={confirmBusy || starting === "apply"}
          onConfirm={confirmApply}
          onCancel={() => {
            if (confirmBusy) return;
            setPendingApply(null);
          }}
        />
      )}
    </div>
  );
}

function RunRow({
  run,
  active,
  onSelect,
}: {
  run: Run;
  active: boolean;
  onSelect: () => void;
}) {
  const { t, locale } = useI18n();
  const duration = runDurationSeconds(run);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`flex w-full min-w-0 flex-col gap-1.5 rounded-lg border p-3 text-start focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none motion-safe:transition-colors motion-safe:duration-150 ${
        active
          ? "border-accent/50 bg-linear-to-r from-accent-soft to-accent-2-soft rtl:bg-linear-to-l"
          : "border-line hover:bg-surface-hover"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-ink-subtle">#{run.id}</span>
        <span className="text-sm font-medium text-ink">
          {runKindLabel(run.kind, t)}
        </span>
        <RunStatusBadge status={run.status} />
        <span className="ms-auto text-2xs text-ink-subtle">
          {formatDateTime(run.finished_at ?? run.created_at, locale)}
        </span>
      </div>

      <p dir="auto" className="truncate text-xs text-ink-muted">
        {describeRunParams(run, t, locale)}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p dir="auto" className="truncate text-xs text-ink-subtle">
          {describeRun(run, t, locale)}
        </p>
        {duration !== null && (
          <span className="shrink-0 font-mono text-2xs text-ink-subtle">
            {formatDuration(duration, locale)}
          </span>
        )}
      </div>
    </button>
  );
}

function RunFormCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-line bg-surface p-4 shadow-sm">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        <p className="mt-0.5 text-xs text-ink-subtle">{description}</p>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-muted">
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-1 block text-2xs text-ink-subtle">{hint}</span>
      )}
    </label>
  );
}

function CheckboxRow({
  checked,
  onChange,
  label,
  description,
  tone = "default",
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description: string;
  tone?: "default" | "danger";
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 motion-safe:transition-colors motion-safe:duration-150 ${
        tone === "danger" && checked
          ? "border-danger/40 bg-danger-soft"
          : "border-line hover:bg-surface-hover"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className={`mt-0.5 h-4 w-4 rounded focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${
          tone === "danger" ? "accent-danger" : "accent-accent"
        }`}
      />
      <span className="min-w-0">
        <span className="block text-xs font-medium text-ink">{label}</span>
        <span className="mt-0.5 block text-2xs text-ink-subtle">
          {description}
        </span>
      </span>
    </label>
  );
}

function SearchForm({
  busy,
  onStart,
  notify,
}: {
  busy: boolean;
  onStart: (input: SearchRunInput) => void;
  notify: Notify;
}) {
  const { t } = useI18n();
  const [platform, setPlatform] = useState<string>("jobinja");
  const [keyword, setKeyword] = useState("backend");
  const [maxPages, setMaxPages] = useState("3");
  const [minScore, setMinScore] = useState("70");
  const [reasoningLength, setReasoningLength] = useState("200");
  const [hardMatch, setHardMatch] = useState(false);
  const [skipFilters, setSkipFilters] = useState(false);
  const [experienceTolerance, setExperienceTolerance] = useState("");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    if (!keyword.trim()) {
      notify("error", t("Enter a keyword to search for."));
      return;
    }

    const toleranceText = experienceTolerance.trim();
    const tolerance = toleranceText === "" ? undefined : Number(toleranceText);

    if (
      tolerance !== undefined &&
      (!Number.isFinite(tolerance) || tolerance < 0 || tolerance > 20)
    ) {
      notify(
        "error",
        t("Experience tolerance must be between 0 and 20 years."),
      );
      return;
    }

    onStart({
      kind: "search",
      platform,
      keyword: keyword.trim(),
      maxPages: toInt(maxPages, 3, 1, 50),
      minScore: toInt(minScore, 70, 0, 100),
      reasoningLength: toInt(reasoningLength, 200, 1, 2000),
      hardMatch,
      skipFilters,
      ...(tolerance !== undefined ? { experienceTolerance: tolerance } : {}),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("Platform")}>
          <Select
            value={platform}
            onChange={(event) => setPlatform(event.target.value)}
            disabled={busy}
          >
            {PLATFORMS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("Keyword")}>
          <Input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="backend"
            dir="auto"
            disabled={busy}
          />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Field label={t("Max pages")}>
          <Input
            type="number"
            min={1}
            max={50}
            value={maxPages}
            onChange={(event) => setMaxPages(event.target.value)}
            disabled={busy}
          />
        </Field>
        <Field label={t("Min score")}>
          <Input
            type="number"
            min={0}
            max={100}
            value={minScore}
            onChange={(event) => setMinScore(event.target.value)}
            disabled={busy}
          />
        </Field>
        <Field label={t("Reasoning")}>
          <Input
            type="number"
            min={1}
            max={2000}
            value={reasoningLength}
            onChange={(event) => setReasoningLength(event.target.value)}
            disabled={busy}
          />
        </Field>
      </div>

      <Field
        label={t("Experience tolerance (years)")}
        hint={t("Leave empty to disable the experience filter.")}
      >
        <Input
          type="number"
          min={0}
          max={20}
          step={0.5}
          value={experienceTolerance}
          onChange={(event) => setExperienceTolerance(event.target.value)}
          placeholder={t("Off")}
          disabled={busy}
        />
      </Field>

      <div className="grid gap-2 sm:grid-cols-2">
        <CheckboxRow
          checked={hardMatch}
          onChange={setHardMatch}
          label={t("Hard match")}
          description={t("Reject jobs that fail required-skill checks.")}
        />
        <CheckboxRow
          checked={skipFilters}
          onChange={setSkipFilters}
          label={t("Skip filters")}
          description={t(
            "Score every job, including location and experience misses.",
          )}
        />
      </div>

      <Button
        type="submit"
        variant="primary"
        disabled={busy}
        className="w-full sm:w-auto"
      >
        {busy ? (
          <LoaderIcon className="h-4 w-4 motion-safe:animate-spin" />
        ) : (
          <SearchIcon className="h-4 w-4" />
        )}
        {busy ? t("Starting…") : t("Start search")}
      </Button>
    </form>
  );
}

function ApplyForm({
  busy,
  onStart,
  notify,
}: {
  busy: boolean;
  onStart: (input: ApplyRunInput) => void;
  notify: Notify;
}) {
  const { t } = useI18n();
  const [minScore, setMinScore] = useState("70");
  const [maxApplies, setMaxApplies] = useState("0");
  const [retryErrors, setRetryErrors] = useState(false);
  const [liveApply, setLiveApply] = useState(false);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    if (minScore.trim() === "" || maxApplies.trim() === "") {
      notify("error", t("Fill in the score and apply limit."));
      return;
    }

    onStart({
      kind: "apply",
      liveApply,
      retryErrors,
      maxApplies: toInt(maxApplies, 0, 0, 100000),
      minScore: toInt(minScore, 70, 0, 100),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("Min score")}>
          <Input
            type="number"
            min={0}
            max={100}
            value={minScore}
            onChange={(event) => setMinScore(event.target.value)}
            disabled={busy}
          />
        </Field>
        <Field label={t("Max applies")} hint={t("0 means no cap.")}>
          <Input
            type="number"
            min={0}
            value={maxApplies}
            onChange={(event) => setMaxApplies(event.target.value)}
            disabled={busy}
          />
        </Field>
      </div>

      <CheckboxRow
        checked={retryErrors}
        onChange={setRetryErrors}
        label={t("Retry errored jobs")}
        description={t("Include jobs whose previous apply attempt failed.")}
      />

      <CheckboxRow
        checked={liveApply}
        onChange={setLiveApply}
        label={t("Live apply")}
        description={t(
          "Submit real applications. Requires a fresh cookies.json.",
        )}
        tone="danger"
      />

      <Button
        type="submit"
        variant={liveApply ? "danger" : "primary"}
        disabled={busy}
        className="w-full sm:w-auto"
      >
        {busy ? (
          <LoaderIcon className="h-4 w-4 motion-safe:animate-spin" />
        ) : (
          <PlayIcon className="h-4 w-4" />
        )}
        {busy
          ? t("Starting…")
          : liveApply
            ? t("Start live apply")
            : t("Start dry run")}
      </Button>
    </form>
  );
}
