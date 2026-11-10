import type { NotificationChannel, ApplyRunSummary } from "./types.js";

/**
 * Sends one message through the Telegram Bot API. Shared by the run notifier
 * and the "send test message" endpoint so both behave identically.
 */
export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
): Promise<void> {
  const res = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    },
  );

  if (!res.ok) {
    throw new Error(`Telegram API returned ${res.status}: ${await res.text()}`);
  }
}

export class TelegramNotifier implements NotificationChannel {
  constructor(
    private botToken: string,
    private chatId: string,
  ) {}

  async send(summary: ApplyRunSummary): Promise<void> {
    const durationSec = Math.round(
      (summary.finishedAt.getTime() - summary.startedAt.getTime()) / 1000,
    );
    const text =
      `Jobwright apply run finished\n` +
      `Applied: ${summary.applied}\n` +
      `Already applied: ${summary.alreadyApplied}\n` +
      `Expired: ${summary.expired}\n` +
      `Errors: ${summary.error}\n` +
      `Total processed: ${summary.total}\n` +
      `Duration: ${durationSec}s`;

    await sendTelegramMessage(this.botToken, this.chatId, text);
  }
}
