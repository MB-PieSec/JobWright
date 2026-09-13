import type { NotificationChannel } from "./types.js";
import { TelegramNotifier } from "./telegram.js";

export function getActiveChannels(): NotificationChannel[] {
  const channels: NotificationChannel[] = [];

  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    channels.push(new TelegramNotifier(process.env.TELEGRAM_BOT_TOKEN, process.env.TELEGRAM_CHAT_ID));
  }

  // Future: if (process.env.SMS_...) channels.push(new SmsNotifier(...));
  // Future: if (process.env.EMAIL_...) channels.push(new EmailNotifier(...));

  return channels;
}