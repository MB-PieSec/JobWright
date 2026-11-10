import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

let tempDir: string;
let notifications: typeof import("../notifications/config.js");
let registry: typeof import("../notifications/registry.js");

beforeAll(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "jobwright-notifications-"));
  process.env.JOBWRIGHT_DB_PATH = path.join(tempDir, "test.db");
  vi.resetModules();
  notifications = await import("../notifications/config.js");
  registry = await import("../notifications/registry.js");
});

beforeEach(() => {
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
  vi.stubEnv("TELEGRAM_CHAT_ID", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

afterAll(async () => {
  delete process.env.JOBWRIGHT_DB_PATH;
  await rm(tempDir, { recursive: true, force: true });
});

describe("Telegram notification settings", () => {
  it("saves the token and chat ID without returning the token", async () => {
    const token = "123456789:AAHfake_token_for_tests_1234567890";

    const state = await notifications.saveTelegramConfig({
      botToken: token,
      chatId: "-1001234567890",
    });

    expect(state.telegram).toMatchObject({
      enabled: true,
      botTokenSource: "saved",
      hasSavedBotToken: true,
      hasEnvBotToken: false,
      chatId: "-1001234567890",
      chatIdSource: "saved",
      hasSavedChatId: true,
      hasEnvChatId: false,
    });
    expect(JSON.stringify(state)).not.toContain(token);
  });

  it("falls back to environment values after saved settings are cleared", async () => {
    vi.stubEnv(
      "TELEGRAM_BOT_TOKEN",
      "987654321:AAHenv_token_for_tests_0987654321",
    );
    vi.stubEnv("TELEGRAM_CHAT_ID", "@jobwright_channel");

    const state = await notifications.clearTelegramConfig();

    expect(state.telegram).toMatchObject({
      enabled: true,
      botTokenSource: "environment",
      hasSavedBotToken: false,
      hasEnvBotToken: true,
      chatId: "@jobwright_channel",
      chatIdSource: "environment",
      hasSavedChatId: false,
      hasEnvChatId: true,
    });
    expect(JSON.stringify(state)).not.toContain("AAHenv_token");
  });

  it("activates the Telegram channel from saved settings", async () => {
    await notifications.saveTelegramConfig({
      botToken: "111111111:AAHsaved_token_for_tests_1111111111",
      chatId: "42",
    });

    const channels = await registry.getActiveChannels();
    expect(channels).toHaveLength(1);
  });

  it("reports no channels when nothing is configured", async () => {
    await notifications.clearTelegramConfig();

    const channels = await registry.getActiveChannels();
    expect(channels).toHaveLength(0);
  });

  it("sends a test message without saving the pasted values", async () => {
    await notifications.clearTelegramConfig();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "ok",
    } as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);

    const token = "111111111:AAHpasted_token_for_tests_1111111111";
    const result = await notifications.testTelegramConnection({
      botToken: token,
      chatId: "42",
    });

    expect(result).toMatchObject({ ok: true, chatId: "42" });
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.telegram.org/bot${token}/sendMessage`,
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"chat_id":"42"'),
      }),
    );

    const state = await notifications.getNotificationsState();
    expect(state.telegram.hasSavedBotToken).toBe(false);
    expect(state.telegram.enabled).toBe(false);
  });

  it("rejects values that do not look like Telegram credentials", async () => {
    await expect(
      notifications.saveTelegramConfig({ botToken: "not-a-token" }),
    ).rejects.toThrow(/bot token/i);

    await expect(
      notifications.saveTelegramConfig({ chatId: "not a chat" }),
    ).rejects.toThrow(/chat ID/i);
  });

  it("never echoes the bot token in a test failure", async () => {
    const token = "222222222:AAHleaky_token_for_tests_2222222222";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error(`connect failed for ${token}`)),
    );

    await expect(
      notifications.testTelegramConnection({ botToken: token, chatId: "42" }),
    ).rejects.toThrow(/\[redacted\]/);
  });
});
