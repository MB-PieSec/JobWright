import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n";
import { cn } from "../lib/cn";
import { formatDate, formatNumber } from "../lib/format";
import { STATUS_LABELS } from "../lib/status";
import {
  JOB_STATUSES,
  PLATFORMS,
  SORT_KEYS,
  type Filters,
  type JobStatus,
  type SortKey,
} from "../types";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Input } from "./Input";
import { Select } from "./Select";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  SearchIcon,
  XIcon,
} from "./icons";

const SORT_LABELS: Record<SortKey, string> = {
  score: "Score",
  updated: "Updated",
  seen: "First seen",
  title: "Title",
  platform: "Platform",
};

interface FilterBarProps {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  onClear: () => void;
  active: boolean;
}

export function FilterBar({
  filters,
  onChange,
  onClear,
  active,
}: FilterBarProps) {
  const { t } = useI18n();
  const togglePlatform = (platform: string) => {
    onChange({
      platforms: filters.platforms.includes(platform)
        ? filters.platforms.filter((value) => value !== platform)
        : [...filters.platforms, platform],
    });
  };

  return (
    <section
      aria-label={t("Filters")}
      className="relative z-30 border-b border-line bg-surface/80 backdrop-blur"
    >
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full sm:w-64 sm:shrink-0">
            <Input
              type="search"
              value={filters.q}
              onChange={(event) => onChange({ q: event.target.value })}
              placeholder={t("Search title or URL")}
              aria-label={t("Search jobs")}
              dir="auto"
              leadingIcon={<SearchIcon className="h-4 w-4" />}
            />
          </div>

          <StatusFilter
            selected={filters.statuses}
            onChange={(statuses) => onChange({ statuses })}
          />

          <div
            className="flex shrink-0 items-center gap-1"
            role="group"
            aria-label={t("Filter by platform")}
          >
            {PLATFORMS.map((platform) => {
              const isActive = filters.platforms.includes(platform);
              return (
                <button
                  key={platform}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => togglePlatform(platform)}
                  className={cn(
                    "inline-flex min-h-10 items-center rounded-full px-3 text-xs font-medium ring-1 ring-inset focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas focus-visible:outline-none motion-safe:transition-colors motion-safe:duration-150 md:min-h-0 md:py-1.5",
                    isActive
                      ? "bg-accent-soft text-accent-text ring-accent/30"
                      : "bg-surface text-ink-muted ring-line hover:bg-surface-hover hover:text-ink",
                  )}
                >
                  {platform}
                </button>
              );
            })}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="w-32">
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                value={filters.minScore}
                onChange={(event) => onChange({ minScore: event.target.value })}
                placeholder={t("Min score")}
                aria-label={t("Minimum score")}
              />
            </div>
            <span className="text-xs text-ink-subtle" aria-hidden="true">
              –
            </span>
            <div className="w-32">
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                value={filters.maxScore}
                onChange={(event) => onChange({ maxScore: event.target.value })}
                placeholder={t("Max score")}
                aria-label={t("Maximum score")}
              />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="w-36">
              <Input
                type="date"
                value={filters.seenAfter}
                onChange={(event) =>
                  onChange({ seenAfter: event.target.value })
                }
                aria-label={t("Seen after")}
              />
            </div>
            <span className="text-xs text-ink-subtle" aria-hidden="true">
              –
            </span>
            <div className="w-36">
              <Input
                type="date"
                value={filters.seenBefore}
                onChange={(event) =>
                  onChange({ seenBefore: event.target.value })
                }
                aria-label={t("Seen before")}
              />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Select
              value={filters.sort}
              onChange={(event) =>
                onChange({ sort: event.target.value as SortKey })
              }
              aria-label={t("Sort by")}
              className="w-32"
            >
              {SORT_KEYS.map((key) => (
                <option key={key} value={key}>
                  {t(SORT_LABELS[key])}
                </option>
              ))}
            </Select>
            <Button
              variant="secondary"
              size="icon"
              aria-label={
                filters.order === "asc"
                  ? t("Sort descending")
                  : t("Sort ascending")
              }
              onClick={() =>
                onChange({ order: filters.order === "asc" ? "desc" : "asc" })
              }
            >
              {filters.order === "asc" ? <ArrowUpIcon /> : <ArrowDownIcon />}
            </Button>
          </div>

          {active && (
            <Button variant="ghost" onClick={onClear}>
              {t("Clear filters")}
            </Button>
          )}
        </div>

        <ActiveFilterChips
          filters={filters}
          onChange={onChange}
          onClear={onClear}
        />
      </div>
    </section>
  );
}

interface StatusFilterProps {
  selected: JobStatus[];
  onChange: (statuses: JobStatus[]) => void;
}

function StatusFilter({ selected, onChange }: StatusFilterProps) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        containerRef.current?.querySelector("button")?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const toggle = (status: JobStatus) => {
    onChange(
      selected.includes(status)
        ? selected.filter((value) => value !== status)
        : [...selected, status],
    );
  };

  return (
    <div ref={containerRef} className="relative shrink-0">
      <Button
        variant="secondary"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="true"
        aria-expanded={open}
        className="w-full justify-between md:w-auto"
      >
        <span>
          {selected.length > 0
            ? t("Status ({count})", {
                count: formatNumber(selected.length, locale),
              })
            : t("Status")}
        </span>
        <ChevronDownIcon className="h-4 w-4 text-ink-subtle" />
      </Button>

      {open && (
        <div
          role="group"
          aria-label={t("Filter by status")}
          className="absolute z-40 mt-1 w-64 rounded-lg border border-line bg-surface p-1 shadow-sm"
        >
          <div className="max-h-80 overflow-y-auto">
            {JOB_STATUSES.map((status) => (
              <label
                key={status}
                className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-surface-hover md:min-h-0"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(status)}
                  onChange={() => toggle(status)}
                  className="h-4 w-4 rounded accent-accent focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none"
                />
                <Badge status={status} />
              </label>
            ))}
          </div>

          {selected.length > 0 && (
            <div className="mt-1 border-t border-line pt-1">
              <button
                type="button"
                onClick={() => onChange([])}
                className="w-full rounded-md px-2 py-2 text-start text-xs font-medium text-ink-muted hover:bg-surface-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
              >
                {t("Clear status")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ActiveFilterChipsProps {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  onClear: () => void;
}

function ActiveFilterChips({
  filters,
  onChange,
  onClear,
}: ActiveFilterChipsProps) {
  const { t, locale } = useI18n();
  const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];

  if (filters.q.trim()) {
    chips.push({
      key: "q",
      label: t("Search: {query}", { query: filters.q.trim() }),
      onRemove: () => onChange({ q: "" }),
    });
  }

  for (const status of filters.statuses) {
    chips.push({
      key: `status-${status}`,
      label: t(STATUS_LABELS[status]),
      onRemove: () =>
        onChange({
          statuses: filters.statuses.filter((value) => value !== status),
        }),
    });
  }

  for (const platform of filters.platforms) {
    chips.push({
      key: `platform-${platform}`,
      label: platform,
      onRemove: () =>
        onChange({
          platforms: filters.platforms.filter((value) => value !== platform),
        }),
    });
  }

  if (filters.minScore !== "") {
    chips.push({
      key: "minScore",
      label: t("Score ≥ {score}", {
        score: formatNumber(Number(filters.minScore), locale),
      }),
      onRemove: () => onChange({ minScore: "" }),
    });
  }

  if (filters.maxScore !== "") {
    chips.push({
      key: "maxScore",
      label: t("Score ≤ {score}", {
        score: formatNumber(Number(filters.maxScore), locale),
      }),
      onRemove: () => onChange({ maxScore: "" }),
    });
  }

  if (filters.seenAfter) {
    chips.push({
      key: "seenAfter",
      label: t("Seen after {date}", {
        date: formatDate(filters.seenAfter, locale),
      }),
      onRemove: () => onChange({ seenAfter: "" }),
    });
  }

  if (filters.seenBefore) {
    chips.push({
      key: "seenBefore",
      label: t("Seen before {date}", {
        date: formatDate(filters.seenBefore, locale),
      }),
      onRemove: () => onChange({ seenBefore: "" }),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex min-h-10 items-center gap-1 rounded-full bg-surface-hover py-0.5 ps-2.5 pe-1 text-xs text-ink-muted md:min-h-0"
        >
          <span dir="auto">{chip.label}</span>
          <button
            type="button"
            onClick={chip.onRemove}
            aria-label={t("Remove filter: {label}", { label: chip.label })}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-subtle hover:bg-line hover:text-ink focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none md:h-5 md:w-5"
          >
            <XIcon className="h-3 w-3" />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onClear}
        className="rounded-full px-2 py-1 text-xs font-medium text-ink-subtle hover:text-ink focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none md:min-h-0"
      >
        {t("Clear all")}
      </button>
    </div>
  );
}
