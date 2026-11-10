import { useEffect, useRef, useState } from "react";
import type { PipelineEvent } from "../types";

export type RunStreamState = "idle" | "connecting" | "live" | "done" | "error";

const EVENT_TYPES: PipelineEvent["type"][] = [
  "run_started",
  "jobs_found",
  "job_skipped",
  "job_filtered",
  "job_scored",
  "job_error",
  "apply_result",
  "apply_dry_run",
  "apply_skipped",
  "run_finished",
  "run_failed",
  "run_cancelled",
  "run_resumed",
];

function isTerminal(event: PipelineEvent): boolean {
  return (
    event.type === "run_finished" ||
    event.type === "run_failed" ||
    event.type === "run_cancelled"
  );
}

interface RunStream {
  events: PipelineEvent[];
  state: RunStreamState;
  error: string | null;
}

/**
 * Subscribes to a run's SSE stream. The server emits named events, so each
 * type needs its own listener; `onmessage` alone would never fire.
 */
export function useRunEvents(
  runId: number | null,
  onDone?: (runId: number) => void,
): RunStream {
  const [stream, setStream] = useState<RunStream>({
    events: [],
    state: "idle",
    error: null,
  });
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (runId === null) {
      setStream({ events: [], state: "idle", error: null });
      return;
    }

    setStream({ events: [], state: "connecting", error: null });

    const source = new EventSource(`/api/runs/${runId}/events`);
    // React StrictMode mounts effects twice in development. The server honours
    // Last-Event-ID, but a duplicate connection can still replay an event, so
    // keep a local guard as well.
    const seen = new Set<string>();
    let finished = false;

    const handleEvent = (message: MessageEvent<string>) => {
      const sequence = message.lastEventId;
      if (sequence && seen.has(sequence)) return;
      if (sequence) seen.add(sequence);

      let event: PipelineEvent;
      try {
        event = JSON.parse(message.data) as PipelineEvent;
      } catch {
        return;
      }

      setStream((current) => ({
        events: [...current.events, event],
        state: isTerminal(event) ? "done" : "live",
        error: event.type === "run_failed" ? event.error : current.error,
      }));

      if (isTerminal(event)) {
        finished = true;
        source.close();
        onDoneRef.current?.(runId);
      }
    };

    for (const type of EVENT_TYPES) {
      source.addEventListener(type, handleEvent as EventListener);
    }

    source.onopen = () => {
      setStream((current) =>
        current.state === "connecting"
          ? { ...current, state: "live" }
          : current,
      );
    };

    source.onerror = () => {
      if (finished) return;
      // EventSource reconnects on its own; only surface a closed connection.
      if (source.readyState === EventSource.CLOSED) {
        setStream((current) => ({
          ...current,
          state: "error",
          error: "Lost connection to the run stream.",
        }));
      }
    };

    return () => {
      finished = true;
      source.close();
    };
  }, [runId]);

  return stream;
}
