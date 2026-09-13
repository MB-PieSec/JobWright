import type { NotificationChannel, ApplyRunSummary } from "./types.js";

export async function notifyAll(channels: NotificationChannel[], summary: ApplyRunSummary): Promise<void> {
  const results = await Promise.allSettled(channels.map((c) => c.send(summary)));

  results.forEach((result, i) => {
    if (result.status === "rejected") {
      console.error(`Notification channel ${i} failed:`, result.reason);
    }
  });
}