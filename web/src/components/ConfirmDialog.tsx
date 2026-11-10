import { useRef, useState, type ReactNode } from "react";
import { useI18n } from "../i18n";
import { useBodyScrollLock, useFocusTrap } from "../hooks/useFocusTrap";
import { Button } from "./Button";
import { Input } from "./Input";

interface ConfirmDialogProps {
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  /** When set, the confirm button stays disabled until this text is typed. */
  requireText?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = "danger",
  requireText,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [typed, setTyped] = useState("");

  useFocusTrap(dialogRef, true, busy ? undefined : onCancel);
  useBodyScrollLock(true);

  const textSatisfied = !requireText || typed === requireText;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div
        className="absolute inset-0 bg-zinc-950/50 motion-safe:transition-opacity motion-safe:duration-150"
        onClick={busy ? undefined : onCancel}
        aria-hidden="true"
      />

      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-description"
        className="relative w-full max-w-md rounded-xl border border-line bg-surface p-5 shadow-sm"
      >
        <h2 id="confirm-title" className="text-base font-semibold text-ink">
          {title}
        </h2>

        <div
          id="confirm-description"
          className="mt-2 text-sm leading-6 text-ink-muted"
        >
          {description}
        </div>

        {requireText && (
          <div className="mt-4">
            <label
              htmlFor="confirm-text"
              className="block text-xs font-medium text-ink-muted"
            >
              {t("Type {text} to confirm", { text: requireText })}
            </label>
            <Input
              id="confirm-text"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              disabled={busy}
              className="mt-1"
            />
          </div>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            {cancelLabel ?? t("Cancel")}
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            onClick={onConfirm}
            disabled={busy || !textSatisfied}
          >
            {busy ? t("Working…") : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
