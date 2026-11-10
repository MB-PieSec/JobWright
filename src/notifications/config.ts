import { sendTelegramMessage } from "./telegram.js";

export type ConfigSource = "saved" | "environment" | null;

const TOKEN_KEY = "notifications.telegram.botToken";
const CHAT_ID_KEY = "notifications.telegram.chatId";

export interface TelegramState {
  /** True when both a bot token and a chat ID resolve from some source. */
  enabled: boolean;
  botTokenSource: ConfigSource;
  hasSavedBotToken: boolean;
  hasEnvBotToken: boolean;
  chatId: string;
  chatIdSource: ConfigSource;
  hasSavedChatId: boolean;
  hasEnvChatId: boolean;
}

export interface NotificationsState {
  telegram: TelegramState;
}

export interface ResolvedTelegram {
  botToken: string;
  chatId: string;
  botTokenSource: ConfigSource;
  chatIdSource: ConfigSource;
}

/*
 * Settings are loaded lazily so importing notification code (including from
 * unit tests or the CLI) never opens the database as a side effect.
 */
async function readSetting<T>(key: string): Promise<T | null> {
  const { getSetting } = await import("../settings/store.js");
  return getSetting<T>(key);
}

async function writeSetting(key: string, value: unknown): Promise<void> {
  const { setSetting } = await import("../settings/store.js");
  setSetting(key, value);
}

async function removeSetting(key: string): Promise<void> {
  const { deleteSetting } = await import("../settings/store.js");
  deleteSetting(key);
}

function envToken(): string {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
}

function envChatId(): string {
  return process.env.TELEGRAM_CHAT_ID?.trim() ?? "";
}

/**
 * Saved values win over environment variables, matching the AI provider rules:
 * the user can replace a stale `.env` value from the UI without a restart.
 */
export async function getTelegramConfig(): Promise<ResolvedTelegram> {
  const savedToken = (await readSetting<string>(TOKEN_KEY))?.trim() ?? "";
  const savedChatId = (await readSetting<string>(CHAT_ID_KEY))?.trim() ?? "";
  const fromEnvToken = envToken();
  const fromEnvChatId = envChatId();

  return {
    botToken: savedToken || fromEnvToken,
    chatId: savedChatId || fromEnvChatId,
    botTokenSource: savedToken ? "saved" : fromEnvToken ? "environment" : null,
    chatIdSource: savedChatId ? "saved" : fromEnvChatId ? "environment" : null,
  };
}

export async function getNotificationsState(): Promise<NotificationsState> {
  const telegram = await getTelegramConfig();
  const savedToken = await readSetting<string>(TOKEN_KEY);
  const savedChatId = await readSetting<string>(CHAT_ID_KEY);

  return {
    telegram: {
      enabled: Boolean(telegram.botToken && telegram.chatId),
      botTokenSource: telegram.botTokenSource,
      hasSavedBotToken: Boolean(savedToken),
      hasEnvBotToken: Boolean(envToken()),
      chatId: telegram.chatId,
      chatIdSource: telegram.chatIdSource,
      hasSavedChatId: Boolean(savedChatId),
      hasEnvChatId: Boolean(envChatId()),
    },
  };
}

export interface SaveTelegramInput {
  /** A string saves/replaces the token; null removes the saved token. */
  botToken?: string | null;
  /** A string saves/replaces the chat ID; null removes the saved chat ID. */
  chatId?: string | null;
}

export function validateBotToken(token: string): void {
  if (!/^\d+:[A-Za-z0-9_-]+$/.test(token)) {
    throw new Error(
      "That does not look like a Telegram bot token. It should look like 123456789:AA…",
    );
  }
}

export function validateChatId(chatId: string): void {
  if (!/^(-?\d+|@[A-Za-z][A-Za-z0-9_]{4,})$/.test(chatId)) {
    throw new Error(
      "That does not look like a Telegram chat ID. Use a numeric ID or @channelname.",
    );
  }
}

export async function saveTelegramConfig(
  input: SaveTelegramInput,
): Promise<NotificationsState> {
  if (input.botToken === null) {
    await removeSetting(TOKEN_KEY);
  } else if (typeof input.botToken === "string") {
    const token = input.botToken.trim();
    if (!token) throw new Error("The bot token cannot be empty.");
    validateBotToken(token);
    await writeSetting(TOKEN_KEY, token);
  }

  if (input.chatId === null) {
    await removeSetting(CHAT_ID_KEY);
  } else if (typeof input.chatId === "string") {
    const chatId = input.chatId.trim();
    if (!chatId) throw new Error("The chat ID cannot be empty.");
    validateChatId(chatId);
    await writeSetting(CHAT_ID_KEY, chatId);
  }

  return getNotificationsState();
}

export async function clearTelegramConfig(): Promise<NotificationsState> {
  await removeSetting(TOKEN_KEY);
  await removeSetting(CHAT_ID_KEY);
  return getNotificationsState();
}

export interface TestTelegramInput {
  /** Pasted values take precedence over saved/environment settings. */
  botToken?: string;
  chatId?: string;
}

export interface TestTelegramResult {
  ok: true;
  chatId: string;
  latencyMs: number;
}

export async function testTelegramConnection(
  input: TestTelegramInput = {},
): Promise<TestTelegramResult> {
  const resolved = await getTelegramConfig();
  const botToken = input.botToken?.trim() || resolved.botToken;
  const chatId = input.chatId?.trim() || resolved.chatId;

  if (!botToken) {
    throw new Error(
      "No Telegram bot token configured. Add one above or set TELEGRAM_BOT_TOKEN.",
    );
  }
  validateBotToken(botToken);

  if (!chatId) {
    throw new Error(
      "No Telegram chat ID configured. Add one above or set TELEGRAM_CHAT_ID.",
    );
  }
  validateChatId(chatId);

  const startedAt = Date.now();

  try {
    await sendTelegramMessage(
      botToken,
      chatId,
      "JobWright test message — Telegram notifications are working.",
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Never let a network/library error echo the token back to the browser.
    throw new Error(message.split(botToken).join("[redacted]"));
  }

  return { ok: true, chatId, latencyMs: Date.now() - startedAt };
}
