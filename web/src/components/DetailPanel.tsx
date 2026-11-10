import { useEffect, useRef, useState } from "react";
import type { Job } from "../types";
import { useI18n } from "../i18n";
import { formatDateTime } from "../lib/format";
import { useBodyScrollLock, useFocusTrap } from "../hooks/useFocusTrap";
import { Badge } from "./Badge";
import { Button, buttonClasses } from "./Button";
import { ScoreBar } from "./ScoreBar";
import { ExternalLinkIcon, TrashIcon, XIcon } from "./icons";

interface DetailPanelProps {
  job: Job;
  onClose: () => void;
  onDelete: (job: Job) => void;
  /** True while a confirm dialog sits on top; keeps Escape/focus from firing twice. */
  suspended?: boolean;
}

export function DetailPanel({
  job,
  onClose,
  onDelete,
  suspended = false,
}: DetailPanelProps) {
  const { t, locale } = useI18n();
  const panelRef = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useFocusTrap(panelRef, !suspended, onClose);
  useBodyScrollLock(true);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="fixed inset-0 z-40">
      <div
        className="absolute inset-0 bg-zinc-950/40 motion-safe:transition-opacity motion-safe:duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-detail-title"
        className={`absolute inset-y-0 end-0 flex w-full max-w-lg flex-col border-s border-line bg-surface shadow-sm ease-out motion-safe:transition-transform motion-safe:duration-200 ${
          shown ? "translate-x-0" : "translate-x-full rtl:-translate-x-full"
        }`}
      >
        <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h2
              id="job-detail-title"
              dir="auto"
              className="text-base font-semibold break-words text-ink"
            >
              {job.title ?? t("Untitled job")}
            </h2>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-subtle">
              <span className="font-mono">#{job.id}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{job.platform}</span>
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={t("Close details")}
          >
            <XIcon />
          </Button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <Badge status={job.status} />
            <ScoreBar score={job.score} />
          </div>

          <div>
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClasses("secondary", "md")}
            >
              <ExternalLinkIcon className="h-4 w-4" />
              {t("Open posting")}
            </a>
            <p
              dir="ltr"
              className="mt-2 font-mono text-xs break-all text-ink-subtle"
            >
              {job.url}
            </p>
          </div>

          <section aria-labelledby="reasoning-heading">
            <h3
              id="reasoning-heading"
              className="text-xs font-medium tracking-wide text-ink-subtle uppercase"
            >
              {t("LLM reasoning")}
            </h3>
            {job.reasoning ? (
              <p
                dir="auto"
                className="mt-2 rounded-lg border border-line bg-canvas p-3 text-sm leading-6 whitespace-pre-wrap text-ink-muted"
              >
                {job.reasoning}
              </p>
            ) : (
              <p className="mt-2 text-sm text-ink-subtle">
                {t("No reasoning recorded.")}
              </p>
            )}
          </section>

          {job.error_reason && (
            <div
              role="alert"
              className="rounded-lg border border-danger/30 bg-danger-soft p-3"
            >
              <p className="text-xs font-medium text-danger-text">
                {t("Error")}
              </p>
              <p
                dir="auto"
                className="mt-1 text-sm leading-6 break-words whitespace-pre-wrap text-danger-text"
              >
                {job.error_reason}
              </p>
            </div>
          )}

          <dl className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <dt className="text-ink-subtle">{t("First seen")}</dt>
              <dd className="mt-0.5 text-ink-muted">
                {formatDateTime(job.first_seen_at, locale)}
              </dd>
            </div>
            <div>
              <dt className="text-ink-subtle">{t("Updated")}</dt>
              <dd className="mt-0.5 text-ink-muted">
                {formatDateTime(job.updated_at, locale)}
              </dd>
            </div>
          </dl>
        </div>

        <footer className="border-t border-line px-4 py-3 sm:px-6">
          <Button
            variant="danger"
            onClick={() => onDelete(job)}
            className="w-full sm:w-auto"
          >
            <TrashIcon className="h-4 w-4" />
            {t("Delete job")}
          </Button>
        </footer>
      </div>
    </div>
  );
}
