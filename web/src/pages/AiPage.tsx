import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchAiState,
  removeAiKey,
  saveAiSettings,
  testAiConnection,
} from "../api";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Skeleton } from "../components/Skeleton";
import type { ToastKind } from "../components/Toast";
import {
  AlertCircleIcon,
  CheckCircleIcon,
  ExternalLinkIcon,
  KeyIcon,
  LoaderIcon,
  RefreshIcon,
  SparklesIcon,
  TrashIcon,
} from "../components/icons";
import { cn } from "../lib/cn";
import { formatNumber } from "../lib/format";
import { useI18n, type Translate } from "../i18n";
import type {
  AiKeySource,
  AiProviderId,
  AiProviderInfo,
  AiState,
  AiTestResult,
} from "../types";

type Notify = (kind: ToastKind, message: string) => void;

interface AiPageProps {
  notify: Notify;
}

function keySourceLabel(source: AiKeySource, t: Translate): string {
  if (source === "saved") return t("Saved key");
  if (source === "environment") return t("Environment key");
  return t("No key");
}

function KeyBadge({ provider }: { provider: AiProviderInfo }) {
  const { t } = useI18n();
  const tone = provider.hasSavedKey
    ? "bg-accent-soft text-accent-text ring-accent/30"
    : provider.hasEnvKey
      ? "bg-status-applied-soft text-status-applied ring-status-applied-ring"
      : "bg-surface-sunken text-ink-subtle ring-line";

  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-2xs ring-1 ring-inset",
        tone,
      )}
    >
      {keySourceLabel(provider.keySource, t)}
    </span>
  );
}

export function AiPage({ notify }: AiPageProps) {
  const { t, locale } = useI18n();
  const [state, setState] = useState<AiState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const [selectedId, setSelectedId] = useState<AiProviderId | null>(null);
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testResult, setTestResult] = useState<AiTestResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError(null);

    fetchAiState(controller.signal)
      .then((next) => {
        setState(next);
        setLoading(false);
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === "AbortError") {
          return;
        }
        setLoadError(caught instanceof Error ? caught.message : String(caught));
        setLoading(false);
      });

    return () => controller.abort();
  }, [version]);

  useEffect(() => {
    if (!state || selectedId !== null) return;
    setSelectedId(state.active.provider);
    setModel(state.active.model);
  }, [state, selectedId]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);

  const selectedProvider = useMemo(
    () =>
      state?.providers.find((provider) => provider.id === selectedId) ?? null,
    [state, selectedId],
  );

  const activeProvider = useMemo(
    () =>
      state?.providers.find(
        (provider) => provider.id === state.active.provider,
      ),
    [state],
  );

  const handleSelect = (provider: AiProviderInfo) => {
    if (busy) return;

    setSelectedId(provider.id);
    setModel(
      provider.id === state?.active.provider
        ? state.active.model
        : provider.defaultModel,
    );
    setApiKey("");
    setShowKey(false);
    setTestResult(null);
    setTestError(null);
  };

  const handleTestAndSave = async () => {
    if (!selectedProvider || !model.trim() || busy) return;

    setBusy(true);
    setTestError(null);
    setTestResult(null);

    try {
      const key = apiKey.trim();
      const result = await testAiConnection({
        provider: selectedProvider.id,
        model: model.trim(),
        apiKey: key || undefined,
      });

      const next = await saveAiSettings({
        provider: selectedProvider.id,
        model: model.trim(),
        apiKey: key || undefined,
      });

      setState(next);
      setSelectedId(next.active.provider);
      setModel(next.active.model);
      setApiKey("");
      setTestResult(result);
      notify(
        "success",
        t("{label} responded in {ms} ms. Settings saved.", {
          label: selectedProvider.label,
          ms: formatNumber(result.latencyMs, locale),
        }),
      );
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setTestError(message);
      notify("error", message);
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveKey = async () => {
    if (!selectedProvider || busy) return;

    setBusy(true);
    setTestError(null);
    setTestResult(null);

    try {
      const next = await removeAiKey(selectedProvider.id);
      setState(next);
      notify(
        "success",
        t("Saved key removed for {label}.", {
          label: selectedProvider.label,
        }),
      );
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setTestError(message);
      notify("error", message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-xl border border-line bg-linear-to-br from-accent-2-soft/70 via-surface to-accent-3-soft/50 p-5 shadow-sm">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -end-16 -top-20 h-44 w-44 rounded-full bg-accent-2/10 blur-2xl"
        />
        <div className="relative flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-ink">
              {t("AI providers")}
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              {t(
                "Choose the LLM used for resume parsing and job scoring. Keys are stored locally and never sent back to this page.",
              )}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={reload} disabled={loading}>
            <RefreshIcon className="h-3.5 w-3.5" />
            {t("Refresh")}
          </Button>
        </div>
      </section>

      {loadError && (
        <div
          role="alert"
          className="mt-4 flex flex-col gap-3 rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger-text sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2">
            <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span dir="auto">{loadError}</span>
          </div>
          <Button variant="secondary" size="sm" onClick={reload}>
            {t("Retry")}
          </Button>
        </div>
      )}

      {loading && !state ? (
        <AiPageSkeleton />
      ) : state ? (
        <>
          <section className="mt-5 rounded-lg border border-line bg-surface p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <span className="rounded-lg bg-accent-soft p-2 text-accent-text">
                  <SparklesIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-ink-subtle">
                    {t("Active provider")}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-ink">
                    {activeProvider?.label ?? state.active.provider}
                  </p>
                  <p
                    dir="ltr"
                    className="mt-0.5 truncate font-mono text-2xs text-ink-subtle"
                  >
                    {state.active.model}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-2xs ring-1 ring-inset",
                    state.active.configured
                      ? "bg-status-applied-soft text-status-applied ring-status-applied-ring"
                      : "bg-status-error-soft text-status-error ring-status-error-ring",
                  )}
                >
                  {state.active.configured ? t("Ready") : t("Key missing")}
                </span>
                <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-2xs text-ink-muted ring-1 ring-line ring-inset">
                  {keySourceLabel(state.active.keySource, t)}
                </span>
              </div>
            </div>
          </section>

          <div className="mt-4 grid gap-4 lg:grid-cols-5">
            <section className="rounded-lg border border-line bg-surface shadow-sm lg:col-span-3">
              <header className="border-b border-line px-4 py-3">
                <h2 className="text-sm font-semibold text-ink">
                  {t("Providers")}
                </h2>
                <p className="mt-0.5 text-xs text-ink-subtle">
                  {t(
                    "Select a service, then paste its API key and test the connection.",
                  )}
                </p>
              </header>

              <div className="grid gap-2 p-4 sm:grid-cols-2">
                {state.providers.map((provider) => {
                  const selected = provider.id === selectedId;
                  return (
                    <button
                      key={provider.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => handleSelect(provider)}
                      disabled={busy}
                      className={cn(
                        "rounded-lg border p-3 text-start motion-safe:transition-colors motion-safe:duration-150",
                        selected
                          ? "border-accent/60 bg-accent-soft"
                          : "border-line hover:bg-surface-hover",
                        busy && "cursor-not-allowed opacity-70",
                      )}
                    >
                      <span className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium text-ink">
                          {provider.label}
                        </span>
                        <KeyBadge provider={provider} />
                      </span>
                      <span className="mt-1 block text-2xs leading-5 text-ink-subtle">
                        {provider.description}
                      </span>
                      <span
                        dir="ltr"
                        className="mt-2 block truncate font-mono text-2xs text-ink-subtle"
                      >
                        {provider.defaultModel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-lg border border-line bg-surface shadow-sm lg:sticky lg:top-20 lg:col-span-2 lg:self-start">
              <header className="border-b border-line px-4 py-3">
                <h2 className="text-sm font-semibold text-ink">
                  {t("Connection")}
                </h2>
                <p className="mt-0.5 text-xs text-ink-subtle">
                  {t(
                    "Test first, then save. A successful test is required before the settings are stored.",
                  )}
                </p>
              </header>

              {selectedProvider ? (
                <div className="space-y-4 p-4">
                  <div>
                    <p className="text-xs font-medium text-ink-muted">
                      {t("Provider")}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                      {selectedProvider.label}
                      {selectedProvider.id === state.active.provider && (
                        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-2xs text-accent-text ring-1 ring-accent/30 ring-inset">
                          {t("Active")}
                        </span>
                      )}
                    </p>
                  </div>

                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-ink-muted">
                      {t("Model")}
                    </span>
                    <Input
                      value={model}
                      onChange={(event) => setModel(event.target.value)}
                      placeholder={selectedProvider.defaultModel}
                      dir="ltr"
                      spellCheck={false}
                      autoComplete="off"
                      className="font-mono text-xs"
                      disabled={busy}
                    />
                    <span className="mt-2 flex flex-wrap gap-1.5">
                      {selectedProvider.models.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => setModel(suggestion)}
                          disabled={busy}
                          className={cn(
                            "rounded-md px-2 py-1 font-mono text-2xs ring-1 ring-inset motion-safe:transition-colors motion-safe:duration-150",
                            model === suggestion
                              ? "bg-accent-soft text-accent-text ring-accent/40"
                              : "bg-surface-sunken text-ink-muted ring-line hover:bg-surface-hover",
                          )}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </span>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-ink-muted">
                      {t("API key")}
                    </span>
                    <span className="flex gap-2">
                      <Input
                        type={showKey ? "text" : "password"}
                        value={apiKey}
                        onChange={(event) => setApiKey(event.target.value)}
                        placeholder={
                          selectedProvider.hasSavedKey
                            ? t(
                                "Saved key in use — paste a new one to replace it",
                              )
                            : selectedProvider.hasEnvKey
                              ? t("Using {env}", {
                                  env: selectedProvider.envKeys[0],
                                })
                              : t("Paste your API key")
                        }
                        dir="ltr"
                        spellCheck={false}
                        autoComplete="off"
                        className="font-mono text-xs"
                        disabled={busy}
                      />
                      <Button
                        variant="secondary"
                        onClick={() => setShowKey((value) => !value)}
                        disabled={busy}
                        className="shrink-0"
                      >
                        {showKey ? t("Hide") : t("Show")}
                      </Button>
                    </span>
                    <span className="mt-1 block text-2xs text-ink-subtle">
                      {selectedProvider.hasSavedKey
                        ? t(
                            "A key is saved for this provider. Leave the field empty to keep using it.",
                          )
                        : selectedProvider.hasEnvKey
                          ? t(
                              "Using {env} from the environment. Paste a key to store one here instead.",
                              { env: selectedProvider.envKeys[0] },
                            )
                          : t("No key configured for this provider yet.")}
                    </span>
                  </label>

                  {testError && (
                    <div
                      role="alert"
                      className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger-text"
                    >
                      <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                      <span dir="auto" className="break-words">
                        {testError}
                      </span>
                    </div>
                  )}

                  {testResult && (
                    <div
                      role="status"
                      className="flex items-start gap-2 rounded-lg border border-status-applied-ring bg-status-applied-soft p-3 text-sm text-status-applied"
                    >
                      <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium">{t("Connection works")}</p>
                        <p className="mt-0.5 text-2xs">
                          {t("Replied in {ms} ms ·", {
                            ms: formatNumber(testResult.latencyMs, locale),
                          })}{" "}
                          <span dir="ltr" className="font-mono">
                            {testResult.model}
                          </span>
                        </p>
                        {testResult.response && (
                          <p
                            dir="auto"
                            className="mt-1 font-mono text-2xs break-words"
                          >
                            {testResult.response}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-2 border-t border-line pt-4">
                    <Button
                      variant="primary"
                      className="w-full"
                      onClick={() => void handleTestAndSave()}
                      disabled={busy || !model.trim()}
                    >
                      {busy ? (
                        <LoaderIcon className="h-4 w-4 motion-safe:animate-spin" />
                      ) : (
                        <KeyIcon className="h-4 w-4" />
                      )}
                      {busy
                        ? t("Testing connection…")
                        : t("Test connection & save")}
                    </Button>

                    {selectedProvider.hasSavedKey && (
                      <Button
                        variant="secondary"
                        className="w-full"
                        onClick={() => void handleRemoveKey()}
                        disabled={busy}
                      >
                        <TrashIcon className="h-4 w-4" />
                        {t("Remove saved key")}
                      </Button>
                    )}

                    <a
                      href={selectedProvider.docsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1 text-2xs text-ink-subtle hover:text-ink focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                    >
                      {t("Provider API docs")}
                      <ExternalLinkIcon className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              ) : (
                <p className="p-4 text-sm text-ink-subtle">
                  {t("Select a provider to configure it.")}
                </p>
              )}
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}

function AiPageSkeleton() {
  return (
    <div className="mt-5 space-y-4">
      <Skeleton className="h-24 w-full" />
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-2 rounded-lg border border-line bg-surface p-4 lg:col-span-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </div>
        <div className="space-y-3 rounded-lg border border-line bg-surface p-4 lg:col-span-2">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
}
