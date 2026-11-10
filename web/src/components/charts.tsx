import { cn } from "../lib/cn";
import { formatNumber } from "../lib/format";

export interface DonutSegment {
  label: string;
  value: number;
  /** Tailwind text color class; the arc uses `stroke="currentColor"`. */
  colorClass: string;
  /** Tailwind background class for the legend swatch. */
  swatchClass: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  centerLabel: string;
  centerValue: string | number;
  ariaLabel: string;
  locale?: string;
}

/**
 * Dependency-free donut chart. `pathLength={100}` lets the dash values be
 * plain percentages, so no circumference math or inline styles are needed.
 */
export function DonutChart({
  segments,
  centerLabel,
  centerValue,
  ariaLabel,
  locale = "en-US",
}: DonutChartProps) {
  const visible = segments.filter((segment) => segment.value > 0);
  const total = visible.reduce((sum, segment) => sum + segment.value, 0);

  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <div
        className="relative h-36 w-36 shrink-0"
        role="img"
        aria-label={ariaLabel}
      >
        <svg viewBox="0 0 120 120" className="h-full w-full">
          <circle
            cx="60"
            cy="60"
            r="42"
            fill="none"
            strokeWidth="14"
            className="stroke-surface-hover"
          />
          {total > 0 && (
            <g transform="rotate(-90 60 60)">
              {visible.map((segment) => {
                const percent = (segment.value / total) * 100;
                const dash = Math.max(0, percent - 0.8);
                const element = (
                  <circle
                    key={segment.label}
                    cx="60"
                    cy="60"
                    r="42"
                    fill="none"
                    strokeWidth="14"
                    pathLength={100}
                    strokeDasharray={`${dash} ${100 - dash}`}
                    strokeDashoffset={-offset}
                    stroke="currentColor"
                    className={segment.colorClass}
                  >
                    <title>
                      {segment.label}: {formatNumber(segment.value, locale)} (
                      {formatNumber(Math.round(percent), locale)}%)
                    </title>
                  </circle>
                );
                offset += percent;
                return element;
              })}
            </g>
          )}
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-xl font-semibold text-ink tabular-nums">
            {typeof centerValue === "number"
              ? formatNumber(centerValue, locale)
              : centerValue}
          </span>
          <span className="mt-0.5 text-2xs text-ink-subtle">{centerLabel}</span>
        </div>
      </div>

      <ul className="w-full min-w-0 space-y-1.5">
        {segments.map((segment) => {
          const percent =
            total > 0 ? Math.round((segment.value / total) * 100) : 0;
          return (
            <li key={segment.label} className="flex items-center gap-2 text-xs">
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  segment.swatchClass,
                )}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate text-ink-muted">
                {segment.label}
              </span>
              <span className="font-mono text-ink tabular-nums">
                {formatNumber(segment.value, locale)}
              </span>
              <span className="w-9 text-end font-mono text-2xs text-ink-subtle tabular-nums">
                {formatNumber(percent, locale)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export interface ChartSeries {
  label: string;
  /** Tailwind fill class, e.g. `fill-accent`. */
  fillClass: string;
  /** Tailwind background class for the legend swatch. */
  swatchClass: string;
}

export interface ColumnDatum {
  label: string;
  /** One value per series, in the same order as `series`. */
  values: number[];
}

interface ColumnChartProps {
  data: ColumnDatum[];
  series: ChartSeries[];
  ariaLabel: string;
  /** Show every nth label to keep dense series readable. */
  labelEvery?: number;
  locale?: string;
}

/**
 * Stacked column chart drawn with SVG rects. Values are scaled to a 0–100
 * viewBox, so the bars stay crisp without any inline sizing.
 */
export function ColumnChart({
  data,
  series,
  ariaLabel,
  labelEvery = 1,
  locale = "en-US",
}: ColumnChartProps) {
  const totals = data.map((datum) =>
    datum.values.reduce((sum, value) => sum + value, 0),
  );
  const max = Math.max(1, ...totals);
  const empty = totals.every((total) => total === 0);

  return (
    <div>
      <div
        className="flex h-40 items-stretch gap-1"
        role="img"
        aria-label={ariaLabel}
      >
        {data.map((datum, index) => {
          let cumulative = 0;
          return (
            <div
              key={`${datum.label}-${index}`}
              className="flex min-w-0 flex-1 flex-col"
            >
              <div className="relative flex min-h-0 flex-1 items-end">
                {empty ? (
                  <div className="h-px w-full bg-line" />
                ) : (
                  <svg
                    viewBox="0 0 10 100"
                    preserveAspectRatio="none"
                    className="h-full w-full overflow-visible"
                  >
                    {series.map((entry, seriesIndex) => {
                      const value = datum.values[seriesIndex] ?? 0;
                      if (value <= 0) return null;
                      const height = (value / max) * 100;
                      const y = 100 - cumulative - height;
                      cumulative += height;
                      return (
                        <rect
                          key={entry.label}
                          x="1"
                          y={y}
                          width="8"
                          height={height}
                          rx="0.6"
                          className={entry.fillClass}
                        >
                          <title>
                            {datum.label} · {entry.label}:{" "}
                            {formatNumber(value, locale)}
                          </title>
                        </rect>
                      );
                    })}
                  </svg>
                )}
              </div>
              <span className="mt-1.5 block truncate text-center text-2xs text-ink-subtle tabular-nums">
                {index % labelEvery === 0 ? datum.label : "\u00A0"}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {series.map((entry) => (
          <span
            key={entry.label}
            className="inline-flex items-center gap-1.5 text-xs text-ink-muted"
          >
            <span
              className={cn("h-2 w-2 rounded-sm", entry.swatchClass)}
              aria-hidden="true"
            />
            {entry.label}
          </span>
        ))}
      </div>
    </div>
  );
}
