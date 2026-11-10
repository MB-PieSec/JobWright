import type { Job } from "../types";
import { useI18n } from "../i18n";
import { formatDateTime } from "../lib/format";
import { Badge } from "./Badge";
import { ScoreBar } from "./ScoreBar";
import { TableSkeleton } from "./Skeleton";

interface JobsTableProps {
  jobs: Job[];
  loading: boolean;
  onSelect: (job: Job) => void;
  skeletonRows?: number;
}

export function JobsTable({
  jobs,
  loading,
  onSelect,
  skeletonRows = 8,
}: JobsTableProps) {
  const { t, locale } = useI18n();
  return (
    <table className="hidden w-full table-fixed border-collapse md:table">
      <caption className="sr-only">{t("Scraped jobs")}</caption>
      <thead className="sticky top-0 z-10 bg-surface">
        <tr className="border-b border-line text-xs text-ink-subtle">
          <th scope="col" className="w-auto px-3 py-2.5 text-start font-medium">
            {t("Title")}
          </th>
          <th scope="col" className="w-28 px-3 py-2.5 text-start font-medium">
            {t("Platform")}
          </th>
          <th scope="col" className="w-40 px-3 py-2.5 text-start font-medium">
            {t("Status")}
          </th>
          <th scope="col" className="w-32 px-3 py-2.5 text-end font-medium">
            {t("Score")}
          </th>
          <th scope="col" className="w-40 px-3 py-2.5 text-start font-medium">
            {t("First seen")}
          </th>
          <th scope="col" className="w-40 px-3 py-2.5 text-start font-medium">
            {t("Updated")}
          </th>
        </tr>
      </thead>

      {loading ? (
        <TableSkeleton rows={skeletonRows} />
      ) : (
        <tbody>
          {jobs.map((job) => (
            <tr
              key={job.id}
              tabIndex={0}
              onClick={() => onSelect(job)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(job);
                }
              }}
              className="h-14 cursor-pointer border-b border-line hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none focus-visible:ring-inset motion-safe:transition-colors motion-safe:duration-150"
            >
              <td className="px-3">
                <div
                  dir="auto"
                  className="truncate text-sm font-medium text-ink"
                  title={job.title ?? job.url}
                >
                  {job.title ?? job.url}
                </div>
              </td>
              <td className="px-3">
                <span className="font-mono text-xs text-ink-muted">
                  {job.platform}
                </span>
              </td>
              <td className="px-3">
                <Badge status={job.status} />
              </td>
              <td className="px-3">
                <div className="flex justify-end">
                  <ScoreBar score={job.score} />
                </div>
              </td>
              <td className="px-3 text-xs whitespace-nowrap text-ink-muted">
                {formatDateTime(job.first_seen_at, locale)}
              </td>
              <td className="px-3 text-xs whitespace-nowrap text-ink-muted">
                {formatDateTime(job.updated_at, locale)}
              </td>
            </tr>
          ))}
        </tbody>
      )}
    </table>
  );
}
