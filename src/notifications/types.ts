export interface ApplyRunSummary {
  applied: number;
  alreadyApplied: number;
  expired: number;
  error: number;
  total: number;
  startedAt: Date;
  finishedAt: Date;
}

export interface NotificationChannel {
  send(summary: ApplyRunSummary): Promise<void>;
}
