import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchBrowsers,
  fetchSettings,
  importCookies,
  saveSettings,
} from "../api";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { PathPicker } from "../components/PathPicker";
import { Select } from "../components/Select";
import { Skeleton } from "../components/Skeleton";
import type { ToastKind } from "../components/Toast";
import {
  AlertCircleIcon,
  CheckCircleIcon,
  FolderIcon,
  InfoIcon,
  LoaderIcon,
  RefreshIcon,
  UploadIcon,
} from "../components/icons";
import { cn } from "../lib/cn";
import { formatDateTime, formatNumber } from "../lib/format";
import { useI18n } from "../i18n";
import type {
  BrowserId,
  CookieImportResult,
  DetectedBrowser,
  SettingsResponse,
} from "../types";

type Notify = (kind: ToastKind, message: string) => void;

interface SettingsPageProps {
  notify: Notify;
}

export function SettingsPage({ notify }: SettingsPageProps) {
  const { t, locale } = useI18n();
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [browsers, setBrowsers] = useState<DetectedBrowser[] | null>(null);
  const [platform, setPlatform] = useState<string>("linux");

  const [selectedBrowserId, setSelectedBrowserId] =
    useState<BrowserId>("brave");
  const [selectedProfilePath, setSelectedProfilePath] = useState("");
  const [autoImport, setAutoImport] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [savingDebug, setSavingDebug] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [version, setVersion] = useState(0);

  const initialized = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    Promise.all([
      fetchSettings(controller.signal),
      fetchBrowsers(controller.signal),
    ])
      .then(([nextSettings, nextBrowsers]) => {
        setSettings(nextSettings);
        setBrowsers(nextBrowsers.browsers);
        setPlatform(nextBrowsers.platform);
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === "AbortError") {
          return;
        }
        setError(caught instanceof Error ? caught.message : String(caught));
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [version]);

  useEffect(() => {
    if (initialized.current || !settings || !browsers) return;
    initialized.current = true;

    const source = settings.cookies.source;
    const preferred =
      browsers.find(
        (browser) =>
          browser.installed && browser.supported && browser.profiles.length > 0,
      ) ??
      browsers.find((browser) => browser.supported) ??
      browsers[0];

    const browserId = source?.browserId ?? preferred?.id ?? "brave";
    const browser = browsers.find((item) => item.id === browserId);
    const profile =
      browser?.profiles.find((item) => item.isDefault) ?? browser?.profiles[0];

    setSelectedBrowserId(browserId);
    setSelectedProfilePath(source?.profilePath ?? profile?.path ?? "");
    setAutoImport(source?.autoImport ?? false);
    setDebugMode(settings.browser.debugMode);
  }, [settings, browsers]);

  const reload = useCallback(() => {
    initialized.current = false;
    setVersion((value) => value + 1);
  }, []);

  const selectedBrowser = browsers?.find(
    (browser) => browser.id === selectedBrowserId,
  );
  const profiles = selectedBrowser?.profiles ?? [];
  const knownProfile = profiles.some(
    (profile) => profile.path === selectedProfilePath,
  );

  const handleBrowserChange = (browserId: BrowserId) => {
    setSelectedBrowserId(browserId);
    const browser = browsers?.find((item) => item.id === browserId);
    const profile =
      browser?.profiles.find((item) => item.isDefault) ?? browser?.profiles[0];
    setSelectedProfilePath(profile?.path ?? "");
    setImportError(null);
  };

  const handleImport = async () => {
    if (!selectedBrowser) return;

    setImporting(true);
    setImportError(null);

    try {
      const result = await importCookies({
        browserId: selectedBrowserId,
        ...(selectedProfilePath.trim()
          ? { profilePath: selectedProfilePath.trim() }
          : {}),
      });

      notify(
        "success",
        t(
          result.cookieCount === 1
            ? "Imported {count} cookie from {browser}."
            : "Imported {count} cookies from {browser}.",
          {
            count: formatNumber(result.cookieCount, locale),
            browser: result.browserName,
          },
        ),
      );

      setSelectedProfilePath(result.profilePath);

      // Remember the source so auto-import can refresh it later. A failure
      // here must not hide the fact that the cookies were written.
      try {
        const saved = await saveSettings({
          cookiesSource: {
            browserId: selectedBrowserId,
            profilePath: result.profilePath,
            autoImport,
          },
        });
        setSettings(saved);
      } catch (saveError) {
        notify(
          "error",
          t("Cookies imported, but saving the source failed: {error}", {
            error:
              saveError instanceof Error
                ? saveError.message
                : String(saveError),
          }),
        );
        const refreshed = await fetchSettings().catch(() => null);
        if (refreshed) setSettings(refreshed);
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setImportError(message);
      notify("error", message);
    } finally {
      setImporting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await saveSettings({
        cookiesSource: selectedProfilePath.trim()
          ? {
              browserId: selectedBrowserId,
              profilePath: selectedProfilePath.trim(),
              autoImport,
            }
          : null,
      });
      setSettings(saved);
      notify("success", t("Settings saved."));
    } catch (caught) {
      notify(
        "error",
        caught instanceof Error ? caught.message : String(caught),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDebugModeChange = async (enabled: boolean) => {
    if (savingDebug) return;

    setDebugMode(enabled);
    setSavingDebug(true);

    try {
      const saved = await saveSettings({ browserDebugMode: enabled });
      setSettings(saved);
      notify(
        "success",
        enabled
          ? t("Debug mode on — the browser window will be visible.")
          : t("Debug mode off — runs are headless."),
      );
    } catch (caught) {
      setDebugMode(!enabled);
      notify(
        "error",
        caught instanceof Error ? caught.message : String(caught),
      );
    } finally {
      setSavingDebug(false);
    }
  };

  const lastImport = settings?.cookies.lastImport ?? null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-xl border border-line bg-linear-to-br from-accent-soft/70 via-surface to-accent-3-soft/50 p-5 shadow-sm">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -end-16 -top-20 h-44 w-44 rounded-full bg-accent/10 blur-2xl"
        />
        <div className="relative flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-ink">
              {t("Settings")}
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              {t(
                "Import session cookies from your browser so live apply runs can sign in.",
              )}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={reload} disabled={loading}>
            <RefreshIcon className="h-3.5 w-3.5" />
            {t("Refresh detection")}
          </Button>
        </div>
      </section>

      {platform !== "linux" && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-line bg-surface p-3 text-xs text-ink-muted">
          <InfoIcon className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle" />
          <p>
            {t(
              "Chromium cookie decryption is currently Linux-only. Firefox cookies are plaintext and work on every platform. Windows and macOS support is planned next.",
            )}
          </p>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mt-4 flex flex-col gap-3 rounded-lg border border-danger/30 bg-danger-soft p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2">
            <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-danger-text" />
            <div>
              <p className="text-sm font-medium text-danger-text">
                {t("Could not load settings")}
              </p>
              <p dir="auto" className="mt-0.5 text-sm text-danger-text">
                {error}
              </p>
            </div>
          </div>
          <Button variant="secondary" onClick={reload} className="shrink-0">
            {t("Retry")}
          </Button>
        </div>
      )}

      {loading && !settings ? (
        <SettingsSkeleton />
      ) : settings && browsers ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-5">
          <section className="rounded-lg border border-line bg-surface p-4 shadow-sm lg:col-span-3">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-ink">
                {t("Browser cookie source")}
              </h2>
              <p className="mt-0.5 text-xs text-ink-subtle">
                {t(
                  "Only jobinja.ir and jobvision.ir cookies are read. Values are never sent back to this page.",
                )}
              </p>
            </div>

            <fieldset>
              <legend className="mb-2 text-xs font-medium text-ink-muted">
                {t("Browser")}
              </legend>
              <div className="space-y-2">
                {browsers.map((browser) => {
                  const active = browser.id === selectedBrowserId;
                  return (
                    <label
                      key={browser.id}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-lg border p-3 motion-safe:transition-colors motion-safe:duration-150",
                        active
                          ? "border-accent/50 bg-linear-to-r from-accent-soft to-accent-2-soft rtl:bg-linear-to-l"
                          : "border-line hover:bg-surface-hover",
                        !browser.supported && "cursor-not-allowed opacity-60",
                      )}
                    >
                      <input
                        type="radio"
                        name="cookie-browser"
                        value={browser.id}
                        checked={active}
                        disabled={!browser.supported}
                        onChange={() => handleBrowserChange(browser.id)}
                        className="mt-0.5 h-4 w-4 accent-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-ink">
                            {browser.name}
                          </span>
                          <BrowserStateBadge browser={browser} />
                        </span>
                        <span
                          dir="auto"
                          className="mt-0.5 block text-2xs text-ink-subtle"
                        >
                          {browser.note ??
                            t(
                              browser.profiles.length === 1
                                ? "{count} profile found"
                                : "{count} profiles found",
                              {
                                count: formatNumber(
                                  browser.profiles.length,
                                  locale,
                                ),
                              },
                            )}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="mt-4 space-y-3 border-t border-line pt-4">
              {profiles.length > 0 && (
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink-muted">
                    {t("Profile")}
                  </span>
                  <Select
                    value={knownProfile ? selectedProfilePath : ""}
                    onChange={(event) =>
                      setSelectedProfilePath(event.target.value)
                    }
                    disabled={importing}
                  >
                    <option value="">{t("Custom folder…")}</option>
                    {profiles.map((profile) => (
                      <option key={profile.id} value={profile.path}>
                        {profile.name}
                        {profile.isDefault ? ` (${t("Default")})` : ""}
                      </option>
                    ))}
                  </Select>
                </label>
              )}

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-muted">
                  {t("Profile or browser folder")}
                </span>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={selectedProfilePath}
                    onChange={(event) =>
                      setSelectedProfilePath(event.target.value)
                    }
                    placeholder={t(
                      "Auto-detect the default profile, or browse…",
                    )}
                    dir="ltr"
                    spellCheck={false}
                    autoComplete="off"
                    className="font-mono text-xs"
                    disabled={importing}
                  />
                  <Button
                    variant="secondary"
                    onClick={() => setPickerOpen(true)}
                    disabled={importing}
                    className="shrink-0"
                  >
                    <FolderIcon className="h-4 w-4" />
                    {t("Browse…")}
                  </Button>
                </div>
                <span className="mt-1 block text-2xs text-ink-subtle">
                  {t(
                    "If the browser was not detected, browse to its installation folder and pick the profile that contains the cookie database.",
                  )}
                </span>
              </label>

              {importError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-soft p-3 text-xs text-danger-text"
                >
                  <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span dir="auto">{importError}</span>
                </div>
              )}

              <Button
                variant="primary"
                onClick={() => void handleImport()}
                disabled={importing || !selectedBrowser?.supported}
              >
                {importing ? (
                  <LoaderIcon className="h-4 w-4 motion-safe:animate-spin" />
                ) : (
                  <UploadIcon className="h-4 w-4" />
                )}
                {importing ? t("Importing…") : t("Import cookies")}
              </Button>
            </div>
          </section>

          <div className="min-w-0 space-y-4 lg:col-span-2">
            <section className="rounded-lg border border-line bg-surface p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-ink">
                  {t("Last import")}
                </h2>
                {lastImport && (
                  <CheckCircleIcon className="h-4 w-4 text-status-applied" />
                )}
              </div>

              {lastImport ? (
                <ImportSummary result={lastImport} />
              ) : (
                <p className="mt-3 rounded-lg border border-dashed border-line px-3 py-6 text-center text-xs text-ink-subtle">
                  {t("No cookies imported yet.")}
                </p>
              )}
            </section>

            <section className="rounded-lg border border-line bg-surface p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-ink">
                {t("Automation")}
              </h2>
              <p className="mt-0.5 text-xs text-ink-subtle">
                {t(
                  "Refresh cookies from the selected browser before each live apply run.",
                )}
              </p>

              <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-lg border border-line p-2.5 hover:bg-surface-hover motion-safe:transition-colors motion-safe:duration-150">
                <input
                  type="checkbox"
                  checked={autoImport}
                  onChange={(event) => setAutoImport(event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded accent-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                />
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-ink">
                    {t("Auto-import before live apply")}
                  </span>
                  <span className="mt-0.5 block text-2xs text-ink-subtle">
                    {t(
                      "A failed import is logged and the run continues with the existing cookies file.",
                    )}
                  </span>
                </span>
              </label>

              <Button
                variant="secondary"
                onClick={() => void handleSave()}
                disabled={saving}
                className="mt-3 w-full"
              >
                {saving ? t("Saving…") : t("Save settings")}
              </Button>
            </section>

            <section className="rounded-lg border border-line bg-surface p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-ink">
                {t("Debug mode")}
              </h2>
              <p className="mt-0.5 text-xs text-ink-subtle">
                {t(
                  "Show the browser window while search and live apply runs. Slower and needs a display; off runs headless (default).",
                )}
              </p>

              <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-lg border border-line p-2.5 hover:bg-surface-hover motion-safe:transition-colors motion-safe:duration-150">
                <input
                  type="checkbox"
                  checked={debugMode}
                  disabled={savingDebug}
                  onChange={(event) =>
                    void handleDebugModeChange(event.target.checked)
                  }
                  className="mt-0.5 h-4 w-4 rounded accent-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                />
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-ink">
                    {t("Show the browser window")}
                  </span>
                  <span className="mt-0.5 block text-2xs text-ink-subtle">
                    {debugMode
                      ? t("Runs are headful and visible.")
                      : t("Runs are headless (default).")}
                  </span>
                </span>
              </label>

              <p className="mt-2 text-2xs text-ink-subtle">
                {t(
                  "Applies to CLI runs too, because they share this database.",
                )}
              </p>
            </section>

            <section className="rounded-lg border border-line bg-surface p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-ink">
                {t("Cookie file")}
              </h2>
              <p className="mt-0.5 text-xs text-ink-subtle">
                {t("Puppeteer reads this owner-only file.")}
              </p>
              <p
                dir="ltr"
                className="mt-2 font-mono text-xs break-all text-ink-muted"
              >
                {settings.cookies.path}
              </p>
            </section>
          </div>
        </div>
      ) : null}

      <PathPicker
        open={pickerOpen}
        initialPath={selectedProfilePath || null}
        onClose={() => setPickerOpen(false)}
        onSelect={(path) => {
          setSelectedProfilePath(path);
          setPickerOpen(false);
          setImportError(null);
        }}
      />
    </div>
  );
}

function BrowserStateBadge({ browser }: { browser: DetectedBrowser }) {
  const { t } = useI18n();
  if (!browser.supported) {
    return (
      <span className="rounded-full bg-status-filtered-soft px-2 py-0.5 text-2xs font-medium text-status-filtered ring-1 ring-status-filtered-ring ring-inset">
        {t("Unsupported OS")}
      </span>
    );
  }

  if (!browser.installed) {
    return (
      <span className="rounded-full bg-status-scored-low-soft px-2 py-0.5 text-2xs font-medium text-status-scored-low ring-1 ring-status-scored-low-ring ring-inset">
        {t("Not detected")}
      </span>
    );
  }

  return (
    <span className="rounded-full bg-status-applied-soft px-2 py-0.5 text-2xs font-medium text-status-applied ring-1 ring-status-applied-ring ring-inset">
      {t("Found")}
    </span>
  );
}

function ImportSummary({ result }: { result: CookieImportResult }) {
  const { t, locale } = useI18n();
  return (
    <div className="mt-3 space-y-2">
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <div>
          <dt className="text-ink-subtle">{t("Browser")}</dt>
          <dd className="mt-0.5 text-ink">{result.browserName}</dd>
        </div>
        <div>
          <dt className="text-ink-subtle">{t("Cookies")}</dt>
          <dd className="mt-0.5 font-mono text-ink tabular-nums">
            {formatNumber(result.cookieCount, locale)}
            {result.skipped > 0 && (
              <span className="text-ink-subtle">
                {" "}
                ·{" "}
                {t("{count} skipped", {
                  count: formatNumber(result.skipped, locale),
                })}
              </span>
            )}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-ink-subtle">{t("Imported")}</dt>
          <dd className="mt-0.5 text-ink">
            {formatDateTime(result.importedAt, locale)}
          </dd>
        </div>
      </dl>

      <div>
        <p className="text-2xs text-ink-subtle">{t("Domains")}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {result.domains.map((domain) => (
            <span
              key={domain}
              className="rounded-full bg-surface-hover px-2 py-0.5 font-mono text-2xs text-ink-muted"
            >
              {domain}
            </span>
          ))}
        </div>
      </div>

      <p
        dir="ltr"
        className="truncate font-mono text-2xs text-ink-subtle"
        title={result.profilePath}
      >
        {result.profilePath}
      </p>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-5">
      <div className="rounded-lg border border-line bg-surface p-4 shadow-sm lg:col-span-3">
        <Skeleton className="h-4 w-40" />
        <div className="mt-4 space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
        <Skeleton className="mt-4 h-10 w-full" />
      </div>
      <div className="space-y-4 lg:col-span-2">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  );
}
