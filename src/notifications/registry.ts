import type { NotificationChannel } from "./types.js";
import { TelegramNotifier } from "./telegram.js";

/**
 * Builds the active channel list from saved settings and environment
 * variables. Configuration is read lazily so importing this module does not
 * open the database.
 */
export async function getActiveChannels(): Promise<NotificationChannel[]> {
  const { getTelegramConfig } = await import("./config.js");
  const telegram = await getTelegramConfig();

  const channels: NotificationChannel[] = [];

  if (telegram.botToken && telegram.chatId) {
    channels.push(new TelegramNotifier(telegram.botToken, telegram.chatId));
  }

  // Future: if (process.env.SMS_...) channels.push(new SmsNotifier(...));
  // Future: if (process.env.EMAIL_...) channels.push(new EmailNotifier(...));

  return channels;
}
