import { useCallback, useEffect, useRef, useState } from "react";
import { fetchFsRoots, listFs } from "../api";
import { useI18n } from "../i18n";
import { cn } from "../lib/cn";
import { useBodyScrollLock, useFocusTrap } from "../hooks/useFocusTrap";
import type { FsListing, FsRootsResponse } from "../types";
import { Button } from "./Button";
import { Input } from "./Input";
import {
  AlertCircleIcon,
  ChevronLeftIcon,
  FolderIcon,
  HomeIcon,
  LoaderIcon,
  XIcon,
} from "./icons";

interface PathPickerProps {
  open: boolean;
  initialPath?: string | null;
  onClose: () => void;
  onSelect: (path: string) => void;
}

/**
 * Browses directories on the machine running the API. The web app cannot read
 * the filesystem itself, so this is backed by `/api/fs/list`; only directory
 * names and cookie-database markers are returned.
 */
export function PathPicker({
  open,
  initialPath,
  onClose,
  onSelect,
}: PathPickerProps) {
  const { t } = useI18n();
  const panelRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);

  const [roots, setRoots] = useState<FsRootsResponse | null>(null);
  const [listing, setListing] = useState<FsListing | null>(null);
  const [pathInput, setPathInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusTrap(panelRef, open, onClose);
  useBodyScrollLock(open);

  const load = useCallback((path?: string) => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);

    listFs(path)
      .then((next) => {
        if (id !== requestId.current) return;
        setListing(next);
        setPathInput(next.path);
      })
      .catch((caught: unknown) => {
        if (id !== requestId.current) return;
        setError(caught instanceof Error ? caught.message : String(caught));
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!open) return;

    const id = ++requestId.current;
    setLoading(true);
    setError(null);

    Promise.all([fetchFsRoots(), listFs(initialPath ?? undefined)])
      .then(([nextRoots, nextListing]) => {
        if (id !== requestId.current) return;
        setRoots(nextRoots);
        setListing(nextListing);
        setPathInput(nextListing.path);
      })
      .catch((caught: unknown) => {
        if (id !== requestId.current) return;
        setError(caught instanceof Error ? caught.message : String(caught));
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [open, initialPath]);

  if (!open) return null;

  const go = (path: string) => {
    if (!path.trim()) return;
    load(path.trim());
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center">
      <div
        className="absolute inset-0 bg-zinc-950/50 motion-safe:transition-opacity motion-safe:duration-150"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="path-picker-title"
        className="relative flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-line bg-surface shadow-sm"
      >
        <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <h2
              id="path-picker-title"
              className="text-base font-semibold text-ink"
            >
              {t("Find your browser folder")}
            </h2>
            <p className="mt-1 text-xs text-ink-muted">
              {t(
                "Pick the folder that contains Cookies (Chromium) or cookies.sqlite (Firefox). A browser user-data folder also works.",
              )}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={t("Close folder browser")}
          >
            <XIcon />
          </Button>
        </header>

        <div className="border-b border-line px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => go(roots?.home ?? "/")}
              disabled={!roots || loading}
            >
              <HomeIcon className="h-3.5 w-3.5" />
              {t("Home")}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => go(roots?.filesystemRoot ?? "/")}
              disabled={!roots || loading}
            >
              {t("Filesystem root")}
            </Button>
            {roots?.known.map((root) => (
              <Button
                key={root.path}
                variant="ghost"
                size="sm"
                onClick={() => go(root.path)}
                disabled={loading}
                title={root.path}
              >
                {root.name}
              </Button>
            ))}
          </div>

          <form
            className="mt-3 flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              go(pathInput);
            }}
          >
            <Button
              variant="secondary"
              size="icon"
              onClick={() => listing?.parent && go(listing.parent)}
              disabled={!listing?.parent || loading}
              aria-label={t("Go to parent folder")}
            >
              <ChevronLeftIcon className="h-4 w-4 rtl:rotate-180" />
            </Button>
            <Input
              value={pathInput}
              onChange={(event) => setPathInput(event.target.value)}
              aria-label={t("Folder path")}
              dir="ltr"
              spellCheck={false}
              autoComplete="off"
              className="font-mono text-xs"
            />
            <Button variant="secondary" type="submit" disabled={loading}>
              {t("Go")}
            </Button>
          </form>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2 sm:px-3">
          {error && (
            <div
              role="alert"
              className="m-2 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger-text"
            >
              <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <span dir="auto">{error}</span>
            </div>
          )}

          {loading && !listing ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-ink-subtle">
              <LoaderIcon className="h-4 w-4 motion-safe:animate-spin" />
              {t("Loading folders…")}
            </div>
          ) : listing && listing.entries.length === 0 ? (
            <p className="px-3 py-10 text-center text-sm text-ink-subtle">
              {t(
                "This folder has no subfolders. You can still select it below.",
              )}
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {listing?.entries.map((entry) => (
                <li key={entry.path}>
                  <button
                    type="button"
                    onClick={() => go(entry.path)}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-start hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none motion-safe:transition-colors motion-safe:duration-150"
                  >
                    <FolderIcon className="h-4 w-4 shrink-0 text-ink-subtle" />
                    <span
                      dir="auto"
                      className="min-w-0 flex-1 truncate text-sm text-ink"
                    >
                      {entry.name}
                    </span>
                    {entry.hasCookies && (
                      <span className="shrink-0 rounded-full bg-status-applied-soft px-2 py-0.5 text-2xs font-medium text-status-applied ring-1 ring-status-applied-ring ring-inset">
                        {t("Cookies")}
                      </span>
                    )}
                    {entry.isBrowserRoot && (
                      <span className="hidden shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-2xs font-medium text-accent-text ring-1 ring-accent/30 ring-inset sm:inline">
                        {t("Browser")}
                      </span>
                    )}
                    <ChevronLeftIcon className="h-3.5 w-3.5 shrink-0 rotate-180 text-ink-subtle rtl:rotate-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {listing?.truncated && (
            <p className="px-3 py-2 text-xs text-ink-subtle">
              {t(
                "Only the first 500 folders are shown. Type a path above to go directly to a subfolder.",
              )}
            </p>
          )}
        </div>

        <footer className="flex flex-col gap-3 border-t border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            <p className="text-2xs text-ink-subtle">{t("Selected folder")}</p>
            <p
              dir="ltr"
              className={cn(
                "truncate font-mono text-xs text-ink-muted",
                !listing && "text-ink-subtle",
              )}
              title={listing?.path}
            >
              {listing?.path ?? "—"}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button variant="secondary" onClick={onClose}>
              {t("Cancel")}
            </Button>
            <Button
              variant="primary"
              disabled={!listing || loading}
              onClick={() => listing && onSelect(listing.path)}
            >
              {t("Use this folder")}
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
