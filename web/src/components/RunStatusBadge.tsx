import { useI18n } from "../i18n";
import { cn } from "../lib/cn";
import type { RunStatus } from "../types";

const CLASSES: Record<RunStatus, string> = {
  queued:
    "bg-status-filtered-soft text-status-filtered ring-status-filtered-ring",
  running: "bg-status-scored-soft text-status-scored ring-status-scored-ring",
  completed:
    "bg-status-applied-soft text-status-applied ring-status-applied-ring",
  failed: "bg-status-error-soft text-status-error ring-status-error-ring",
  cancelled:
    "bg-status-expired-soft text-status-expired ring-status-expired-ring",
};

const LABELS: Record<RunStatus, string> = {
  queued: "Queued",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Stopped",
};

export function RunStatusBadge({
  status,
  className,
}: {
  status: RunStatus;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        CLASSES[status],
        className,
      )}
    >
      {status === "running" && (
        <span
          className="h-1.5 w-1.5 rounded-full bg-current motion-safe:animate-pulse"
          aria-hidden="true"
        />
      )}
      {t(LABELS[status])}
    </span>
  );
}
