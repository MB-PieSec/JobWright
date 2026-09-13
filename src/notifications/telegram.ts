import type { NotificationChannel, ApplyRunSummary } from "./types.js";

export class TelegramNotifier implements NotificationChannel {
  constructor(private botToken: string, private chatId: string) {}

  async send(summary: ApplyRunSummary): Promise<void> {
    const durationSec = Math.round((summary.finishedAt.getTime() - summary.startedAt.getTime()) / 1000);
    const text =
      `Jobwright apply run finished\n` +
      `Applied: ${summary.applied}\n` +
      `Already applied: ${summary.alreadyApplied}\n` +
      `Expired: ${summary.expired}\n` +
      `Errors: ${summary.error}\n` +
      `Total processed: ${summary.total}\n` +
      `Duration: ${durationSec}s`;

    const res = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: this.chatId, text }),
    });

    if (!res.ok) {
      throw new Error(`Telegram API returned ${res.status}: ${await res.text()}`);
    }
  }
}