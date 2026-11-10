import { useI18n } from "../i18n";
import { cn } from "../lib/cn";
import { formatNumber } from "../lib/format";
import { scoreTone } from "../lib/status";

interface ScoreBarProps {
  score: number | null;
  className?: string;
}

export function ScoreBar({ score, className }: ScoreBarProps) {
  const { t, locale } = useI18n();
  if (score === null) {
    return (
      <span
        className={cn("font-mono text-sm text-ink-subtle", className)}
        aria-label={t("No score")}
      >
        —
      </span>
    );
  }

  const clamped = Math.max(0, Math.min(100, score));

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="w-8 shrink-0 text-end font-mono text-xs text-ink tabular-nums">
        {formatNumber(clamped, locale)}
      </span>
      <div
        className="h-1 w-20 overflow-hidden rounded-full bg-surface-hover"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t("Score {score} of 100", {
          score: formatNumber(clamped, locale),
        })}
      >
        <div
          className={cn("h-full rounded-full", scoreTone(clamped))}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
