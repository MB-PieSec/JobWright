import { useI18n } from "../i18n";
import { cn } from "../lib/cn";
import { STATUS_BADGE_CLASSES, STATUS_LABELS } from "../lib/status";
import type { JobStatus } from "../types";

interface BadgeProps {
  status: JobStatus;
  className?: string;
}

export function Badge({ status, className }: BadgeProps) {
  const { t } = useI18n();
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        STATUS_BADGE_CLASSES[status],
        status === "expired" && "line-through",
        className,
      )}
    >
      {t(STATUS_LABELS[status])}
    </span>
  );
}
