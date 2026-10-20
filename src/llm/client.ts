import "dotenv/config";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-4o-mini";
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_ATTEMPTS = 3;
const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return err.name === "TimeoutError" || err.name === "AbortError" || err instanceof TypeError;
}

/**
 * Generic prompt-in / text-out wrapper around OpenRouter.
 *
 * Retries transient failures (429/5xx/network/timeouts) with exponential
 * backoff so one flaky call doesn't abort an entire scoring batch.
 */
export async function openRouterWrapper(prompt: string): Promise<string> {
  const apiKey = process.env.openRouterAPIKEY;
  if (!apiKey) {
    throw new Error(
      "openRouterAPIKEY is not set. Add it to .env (see .env.example) before running Jobwright."
    );
  }

  const model = process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL;
  const useJsonMode = process.env.OPENROUTER_JSON_MODE !== "false";

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          max_tokens: 2000,
          ...(useJsonMode ? { response_format: { type: "json_object" } } : {}),
          messages: [{ role: "user", content: prompt }],
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        const body = await response.text();
        const error = new Error(
          `OpenRouter request failed (${response.status}): ${body}`
        );

        if (RETRYABLE_STATUS.has(response.status) && attempt < MAX_ATTEMPTS) {
          lastError = error;
          await sleep(500 * 2 ** (attempt - 1));
          continue;
        }

        throw error;
      }

      const data = (await response.json()) as ChatCompletionResponse;
      const content = data.choices?.[0]?.message?.content;

      if (typeof content !== "string" || content.trim() === "") {
        throw new Error(
          `OpenRouter returned an empty response${data.error?.message ? `: ${data.error.message}` : ""}`
        );
      }

      return content;
    } catch (err) {
      lastError = err;

      if (isRetryableNetworkError(err) && attempt < MAX_ATTEMPTS) {
        await sleep(500 * 2 ** (attempt - 1));
        continue;
      }

      throw err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`OpenRouter request failed after ${MAX_ATTEMPTS} attempts`);
}
