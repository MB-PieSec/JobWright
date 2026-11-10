import { useCallback, useEffect, useState } from "react";
import {
  clearTelegramSettings,
  fetchNotifications,
  saveTelegramSettings,
  testTelegram,
} from "../api";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Skeleton } from "../components/Skeleton";
import type { ToastKind } from "../components/Toast";
import {
  AlertCircleIcon,
  BellIcon,
  CheckCircleIcon,
  ExternalLinkIcon,
  InfoIcon,
  LoaderIcon,
  RefreshIcon,
  SendIcon,
  TrashIcon,
} from "../components/icons";
import { cn } from "../lib/cn";
import { formatNumber } from "../lib/format";
import { useI18n, type Translate } from "../i18n";
import type {
  NotificationConfigSource,
  NotificationsState,
  TelegramTestResult,
} from "../types";

type Notify = (kind: ToastKind, message: string) => void;

interface NotificationsPageProps {
  notify: Notify;
}

function sourceLabel(source: NotificationConfigSource, t: Translate): string {
  if (source === "saved") return t("Saved token");
  if (source === "environment") return t("Environment token");
  return t("No token");
}

export function NotificationsPage({ notify }: NotificationsPageProps) {
  const { t, locale } = useI18n();
  const [state, setState] = useState<NotificationsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [busy, setBusy] = useState<"save" | "test" | "clear" | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TelegramTestResult | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError(null);

    fetchNotifications(controller.signal)
      .then((next) => {
        setState(next);
        setChatId(next.telegram.chatId);
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

  const reload = useCallback(() => setVersion((value) => value + 1), []);

  const handleSave = async () => {
    if (busy) return;

    const token = botToken.trim();
    const chat = chatId.trim();

    if (!chat) {
      setFormError(t("Enter a chat ID before saving."));
      return;
    }

    setBusy("save");
    setFormError(null);
    setTestResult(null);

    try {
      const next = await saveTelegramSettings({
        chatId: chat,
        ...(token ? { botToken: token } : {}),
      });
      setState(next);
      setBotToken("");
      setShowToken(false);
      notify("success", t("Telegram settings saved."));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setFormError(message);
      notify("error", message);
    } finally {
      setBusy(null);
    }
  };

  const handleTest = async () => {
    if (busy) return;

    const token = botToken.trim();
    const chat = chatId.trim();

    setBusy("test");
    setFormError(null);
    setTestResult(null);

    try {
      const result = await testTelegram({
        ...(token ? { botToken: token } : {}),
        ...(chat ? { chatId: chat } : {}),
      });
      setTestResult(result);
      notify(
        "success",
        t("Test message sent to {chatId}.", { chatId: result.chatId }),
      );
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setFormError(message);
      notify("error", message);
    } finally {
      setBusy(null);
    }
  };

  const handleClear = async () => {
    if (busy) return;

    setBusy("clear");
    setFormError(null);
    setTestResult(null);

    try {
      const next = await clearTelegramSettings();
      setState(next);
      setBotToken("");
      setShowToken(false);
      setChatId(next.telegram.chatId);
      notify("success", t("Saved Telegram settings removed."));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setFormError(message);
      notify("error", message);
    } finally {
      setBusy(null);
    }
  };

  const telegram = state?.telegram;
  const hasSavedSettings = Boolean(
    telegram?.hasSavedBotToken || telegram?.hasSavedChatId,
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-xl border border-line bg-linear-to-br from-accent-2-soft/70 via-surface to-accent-3-soft/50 p-5 shadow-sm">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -end-16 -top-20 h-44 w-44 rounded-full bg-accent-2/10 blur-2xl"
        />
        <div className="relative flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-ink">
              {t("Notifications")}
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              {t(
                "Send a summary to Telegram after each live apply run. Dry runs never notify.",
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
        <NotificationsPageSkeleton />
      ) : telegram ? (
        <>
          <section className="mt-5 rounded-lg border border-line bg-surface p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <span className="rounded-lg bg-accent-2-soft p-2 text-accent-2-text">
                  <BellIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-ink-subtle">
                    {t("Active channel")}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-ink">
                    {t("Telegram")}
                  </p>
                  <p
                    dir="ltr"
                    className="mt-0.5 truncate font-mono text-2xs text-ink-subtle"
                  >
                    {telegram.chatId || t("No chat ID")}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-2xs ring-1 ring-inset",
                    telegram.enabled
                      ? "bg-status-applied-soft text-status-applied ring-status-applied-ring"
                      : "bg-status-error-soft text-status-error ring-status-error-ring",
                  )}
                >
                  {telegram.enabled ? t("Enabled") : t("Disabled")}
                </span>
                <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-2xs text-ink-muted ring-1 ring-line ring-inset">
                  {sourceLabel(telegram.botTokenSource, t)}
                </span>
              </div>
            </div>
          </section>

          <div className="mt-4 grid gap-4 lg:grid-cols-5">
            <section className="min-w-0 rounded-lg border border-line bg-surface shadow-sm lg:col-span-3">
              <header className="border-b border-line px-4 py-3">
                <h2 className="text-sm font-semibold text-ink">
                  {t("Telegram bot")}
                </h2>
                <p className="mt-0.5 text-xs text-ink-subtle">
                  {t(
                    "Create a bot with @BotFather, then send it a message to get the chat ID.",
                  )}
                </p>
              </header>

              <div className="space-y-4 p-4">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink-muted">
                    {t("Bot token")}
                  </span>
                  <span className="flex gap-2">
                    <Input
                      type={showToken ? "text" : "password"}
                      value={botToken}
                      onChange={(event) => setBotToken(event.target.value)}
                      placeholder={
                        telegram.hasSavedBotToken
                          ? t(
                              "Saved token in use — paste a new one to replace it",
                            )
                          : telegram.hasEnvBotToken
                            ? t("Using {env}", { env: "TELEGRAM_BOT_TOKEN" })
                            : t("Paste your bot token")
                      }
                      dir="ltr"
                      spellCheck={false}
                      autoComplete="off"
                      className="font-mono text-xs"
                      disabled={busy !== null}
                    />
                    <Button
                      variant="secondary"
                      onClick={() => setShowToken((value) => !value)}
                      disabled={busy !== null}
                      className="shrink-0"
                    >
                      {showToken ? t("Hide") : t("Show")}
                    </Button>
                  </span>
                  <span className="mt-1 block text-2xs text-ink-subtle">
                    {telegram.hasSavedBotToken
                      ? t(
                          "A token is saved locally. Leave the field empty to keep using it.",
                        )
                      : telegram.hasEnvBotToken
                        ? t(
                            "Using {env} from the environment. Paste a token to store one here instead.",
                            { env: "TELEGRAM_BOT_TOKEN" },
                          )
                        : t(
                            "No bot token configured yet. Get one from @BotFather.",
                          )}
                  </span>
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink-muted">
                    {t("Chat ID")}
                  </span>
                  <Input
                    value={chatId}
                    onChange={(event) => setChatId(event.target.value)}
                    placeholder={t("Numeric chat ID or @channelname")}
                    dir="ltr"
                    spellCheck={false}
                    autoComplete="off"
                    className="font-mono text-xs"
                    disabled={busy !== null}
                  />
                  <span className="mt-1 block text-2xs text-ink-subtle">
                    {telegram.hasEnvChatId && !telegram.hasSavedChatId
                      ? t(
                          "Using {env} from the environment. Saving stores this value locally.",
                          { env: "TELEGRAM_CHAT_ID" },
                        )
                      : t(
                          "Message the bot once, then read the chat ID from getUpdates.",
                        )}
                  </span>
                </label>

                {formError && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger-text"
                  >
                    <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                    <span dir="auto" className="break-words">
                      {formError}
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
                      <p className="font-medium">{t("Message delivered")}</p>
                      <p className="mt-0.5 text-2xs">
                        {t("Telegram replied in {ms} ms ·", {
                          ms: formatNumber(testResult.latencyMs, locale),
                        })}{" "}
                        <span dir="ltr" className="font-mono">
                          {testResult.chatId}
                        </span>
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-2 border-t border-line pt-4">
                  <Button
                    variant="primary"
                    className="w-full"
                    onClick={() => void handleSave()}
                    disabled={busy !== null}
                  >
                    {busy === "save" ? (
                      <LoaderIcon className="h-4 w-4 motion-safe:animate-spin" />
                    ) : (
                      <BellIcon className="h-4 w-4" />
                    )}
                    {busy === "save"
                      ? t("Saving…")
                      : t("Save notification settings")}
                  </Button>

                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => void handleTest()}
                    disabled={busy !== null}
                  >
                    {busy === "test" ? (
                      <LoaderIcon className="h-4 w-4 motion-safe:animate-spin" />
                    ) : (
                      <SendIcon className="h-4 w-4" />
                    )}
                    {busy === "test" ? t("Sending…") : t("Send test message")}
                  </Button>

                  {hasSavedSettings && (
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={() => void handleClear()}
                      disabled={busy !== null}
                    >
                      {busy === "clear" ? (
                        <LoaderIcon className="h-4 w-4 motion-safe:animate-spin" />
                      ) : (
                        <TrashIcon className="h-4 w-4" />
                      )}
                      {t("Remove saved settings")}
                    </Button>
                  )}

                  <a
                    href="https://core.telegram.org/bots#how-do-i-create-a-bot"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1 text-2xs text-ink-subtle hover:text-ink focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                  >
                    {t("Telegram bot docs")}
                    <ExternalLinkIcon className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </section>

            <div className="min-w-0 space-y-4 lg:col-span-2">
              <section className="rounded-lg border border-line bg-surface p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-ink">
                  {t("Delivery")}
                </h2>
                <p className="mt-0.5 text-xs text-ink-subtle">
                  {t(
                    "One message per live apply run, sent after the browser closes.",
                  )}
                </p>
                <ul className="mt-3 space-y-2 text-xs text-ink-muted">
                  <li className="flex items-start gap-2">
                    <CheckCircleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-applied" />
                    <span>
                      {t(
                        "Applied, already applied, expired, error counts and duration.",
                      )}
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <InfoIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-subtle" />
                    <span>{t("Dry runs never send a notification.")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <InfoIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-subtle" />
                    <span>
                      {t(
                        "A failed notification is logged and never fails the run.",
                      )}
                    </span>
                  </li>
                </ul>
              </section>

              <section className="rounded-lg border border-line bg-surface p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-ink">
                  {t("Privacy")}
                </h2>
                <p className="mt-1 text-xs text-ink-muted">
                  {t(
                    "The token and chat ID are stored locally. The token is never sent back to this page — only whether one is saved.",
                  )}
                </p>
                <p className="mt-3 text-2xs text-ink-subtle">
                  {t(
                    "Environment fallback: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.",
                  )}
                </p>
              </section>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function NotificationsPageSkeleton() {
  return (
    <div className="mt-5 space-y-4">
      <Skeleton className="h-24 w-full" />
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-3 rounded-lg border border-line bg-surface p-4 lg:col-span-3">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-2 rounded-lg border border-line bg-surface p-4 lg:col-span-2">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    </div>
  );
}
