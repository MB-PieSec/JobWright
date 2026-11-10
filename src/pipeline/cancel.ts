/**
 * Thrown by a pipeline when its AbortSignal has been tripped. The run manager
 * treats this as a user stop rather than a failure.
 */
export class RunCancelledError extends Error {
  constructor(message = "Run cancelled") {
    super(message);
    this.name = "RunCancelledError";
  }
}

/**
 * Pipelines check this at safe boundaries (before launching the browser and
 * between jobs) so a stop never interrupts an in-flight page or LLM call.
 */
export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new RunCancelledError();
  }
}
