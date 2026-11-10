import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n";
import { cn } from "../lib/cn";
import type { Route } from "../hooks/useHashRoute";
import { useBodyScrollLock, useFocusTrap } from "../hooks/useFocusTrap";
import { Button } from "./Button";
import {
  BellIcon,
  DatabaseIcon,
  FileTextIcon,
  OverviewIcon,
  PlayIcon,
  SettingsIcon,
  SparklesIcon,
  XIcon,
} from "./icons";

interface NavItem {
  id: Route;
  label: string;
  description: string;
  icon: typeof OverviewIcon;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: "overview",
    label: "Overview",
    description: "Stats, charts and recent activity",
    icon: OverviewIcon,
  },
  {
    id: "jobs",
    label: "Jobs",
    description: "Browse the scraped job database",
    icon: DatabaseIcon,
  },
  {
    id: "runs",
    label: "Runs",
    description: "Search and apply to jobs",
    icon: PlayIcon,
  },
  {
    id: "resume",
    label: "Resume",
    description: "Upload and inspect your profile",
    icon: FileTextIcon,
  },
  {
    id: "ai",
    label: "AI providers",
    description: "Keys, models and connection tests",
    icon: SparklesIcon,
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Telegram alerts after live apply runs",
    icon: BellIcon,
  },
  {
    id: "settings",
    label: "Settings",
    description: "Cookies and browser import",
    icon: SettingsIcon,
  },
];

interface NavDrawerProps {
  open: boolean;
  route: Route;
  onNavigate: (route: Route) => void;
  onClose: () => void;
}

export function NavDrawer({
  open,
  route,
  onNavigate,
  onClose,
}: NavDrawerProps) {
  const { t } = useI18n();
  const panelRef = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useFocusTrap(panelRef, open, onClose);
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) {
      setShown(false);
      return;
    }
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className={cn(
          "absolute inset-0 bg-zinc-950/40 motion-safe:transition-opacity motion-safe:duration-200",
          shown ? "opacity-100" : "opacity-0",
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("Main navigation")}
        className={cn(
          "absolute inset-y-0 start-0 flex w-72 max-w-[85vw] flex-col border-e border-line bg-surface shadow-sm ease-out motion-safe:transition-transform motion-safe:duration-200",
          shown ? "translate-x-0" : "-translate-x-full rtl:translate-x-full",
        )}
      >
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-4">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-accent via-accent-2 to-accent-3 font-mono text-xs font-semibold text-white shadow-sm"
              aria-hidden="true"
            >
              JW
            </span>
            <div>
              <p className="text-sm font-semibold tracking-tight text-ink">
                JobWright
              </p>
              <p className="text-2xs text-ink-subtle">
                {t("Local job assistant")}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={t("Close navigation")}
          >
            <XIcon />
          </Button>
        </header>

        <nav aria-label={t("Primary")} className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = route === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onNavigate(item.id);
                      onClose();
                    }}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-start focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none motion-safe:transition-colors motion-safe:duration-150",
                      active
                        ? "bg-linear-to-r from-accent-soft to-accent-2-soft text-accent-text rtl:bg-linear-to-l"
                        : "text-ink-muted hover:bg-surface-hover hover:text-ink",
                    )}
                  >
                    {active && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-2 start-0 w-0.5 rounded-full bg-linear-to-b from-accent to-accent-2"
                      />
                    )}
                    <Icon
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        active ? "text-accent-text" : "text-ink-subtle",
                      )}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">
                        {t(item.label)}
                      </span>
                      <span
                        className={cn(
                          "mt-0.5 block text-xs",
                          active ? "text-accent-text/80" : "text-ink-subtle",
                        )}
                      >
                        {t(item.description)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <footer className="border-t border-line px-4 py-3">
          <p className="text-2xs text-ink-subtle">
            {t("Running locally · data never leaves this machine")}
          </p>
        </footer>
      </div>
    </div>
  );
}
