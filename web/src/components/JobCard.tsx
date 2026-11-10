import type { Job } from "../types";
import { useI18n } from "../i18n";
import { formatDateTime } from "../lib/format";
import { Badge } from "./Badge";
import { ScoreBar } from "./ScoreBar";

interface JobCardProps {
  job: Job;
  onSelect: (job: Job) => void;
}

export function JobCard({ job, onSelect }: JobCardProps) {
  const { t, locale } = useI18n();
  return (
    <button
      type="button"
      onClick={() => onSelect(job)}
      className="block w-full rounded-lg border border-line bg-surface p-4 text-start shadow-sm hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas focus-visible:outline-none motion-safe:transition-colors motion-safe:duration-150"
    >
      <div
        dir="auto"
        className="truncate text-sm font-medium text-ink"
        title={job.title ?? job.url}
      >
        {job.title ?? job.url}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge status={job.status} />
        <span className="font-mono text-2xs text-ink-subtle">
          {job.platform}
        </span>
        <ScoreBar score={job.score} className="ms-auto" />
      </div>
      <div className="mt-2 text-xs text-ink-muted">
        {t("First seen {date}", {
          date: formatDateTime(job.first_seen_at, locale),
        })}
      </div>
    </button>
  );
}
