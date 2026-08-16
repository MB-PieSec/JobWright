import type { ApplyResult } from "../platforms/types.js";
import type { JobRecord } from "../db/upsertJob.js";

// ApplyResult.status ("success" | "alreadyApplied" | "error") and
// JobRecord.status ("applied" | "already_applied" | "error", among others)
// don't share the same casing/wording — this is the single place that
// translates between them, so nothing downstream has to know the mismatch exists.
export function mapApplyResultToStatus(
  result: ApplyResult
): JobRecord["status"] {
  switch (result.status) {
    case "success":
      return "applied";
    case "alreadyApplied":
      return "already_applied";
    case "error":
      return "error";
  }
}