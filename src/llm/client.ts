import "dotenv/config";
import { getProvider, type LlmProvider, type ProviderId } from "./providers.js";

const REQUEST_TIMEOUT_MS = 60_000;
const TEST_TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 3;
const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

export interface LlmConfig {
  provider: ProviderId;
  model: string;
  apiKey: string;
}

export interface LlmRequestOptions {
  /** Ask the provider for a JSON object where it supports a JSON mode. */
  json?: boolean;
  maxTokens?: number;
  timeoutMs?: number;
}

interface OpenAiResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}

interface AnthropicResponse {
  content?: { type?: string; text?: string }[];
  error?: { message?: string };
}

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string; thought?: boolean }[] };
  }[];
  error?: { message?: string };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return (
    err.name === "TimeoutError" ||
    err.name === "AbortError" ||
    err instanceof TypeError
  );
}

function endpointFor(provider: LlmProvider, model: string): string {
  if (provider.kind === "gemini") {
    return `${provider.endpoint}/${encodeURIComponent(model)}:generateContent`;
  }
  return provider.endpoint;
}

function headersFor(
  provider: LlmProvider,
  apiKey: string,
): Record<string, string> {
  if (provider.kind === "anthropic") {
    return {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    };
  }

  if (provider.kind === "gemini") {
    return {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    };
  }

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
}

function bodyFor(
  provider: LlmProvider,
  model: string,
  prompt: string,
  options: Required<Pick<LlmRequestOptions, "json" | "maxTokens">>,
): unknown {
  if (provider.kind === "anthropic") {
    return {
      model,
      max_tokens: options.maxTokens,
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }],
    };
  }

  if (provider.kind === "gemini") {
    return {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: options.maxTokens,
        ...(options.json && provider.supportsJsonMode
          ? { responseMimeType: "application/json" }
          : {}),
      },
    };
  }

  const tokenField = provider.tokenParam ?? "max_tokens";
  return {
    model,
    temperature: 0.2,
    [tokenField]: options.maxTokens,
    ...(options.json && provider.supportsJsonMode
      ? { response_format: { type: "json_object" } }
      : {}),
    messages: [{ role: "user", content: prompt }],
  };
}

function contentFrom(provider: LlmProvider, data: unknown): string {
  if (provider.kind === "anthropic") {
    const response = data as AnthropicResponse;
    return (
      response.content
        ?.filter((part) => part.type === "text")
        .map((part) => part.text ?? "")
        .join("") ?? ""
    );
  }

  if (provider.kind === "gemini") {
    const response = data as GeminiResponse;
    return (
      response.candidates?.[0]?.content?.parts
        ?.filter((part) => !part.thought)
        .map((part) => part.text ?? "")
        .join("") ?? ""
    );
  }

  const response = data as OpenAiResponse;
  return response.choices?.[0]?.message?.content ?? "";
}

function errorDetail(provider: LlmProvider, data: unknown): string | undefined {
  const response = data as { error?: { message?: string } };
  const message = response.error?.message;
  return message ? `: ${message}` : undefined;
}

/**
 * Sends one prompt to the configured provider and returns the text response.
 *
 * OpenAI-compatible providers share one request shape; Anthropic and Gemini
 * have their own. Transient failures (429/5xx/network/timeouts) are retried
 * with exponential backoff so one flaky call doesn't abort a scoring batch.
 */
export async function complete(
  prompt: string,
  config: LlmConfig,
  options: LlmRequestOptions = {},
): Promise<string> {
  const provider = getProvider(config.provider);
  const apiKey = config.apiKey.trim();
  const model = config.model.trim() || provider.defaultModel;

  if (!apiKey) {
    throw new Error(
      `No API key configured for ${provider.label}. Add one in AI providers before running Jobwright.`,
    );
  }

  const requestOptions = {
    json: options.json ?? false,
    maxTokens: options.maxTokens ?? 2000,
  };
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const url = endpointFor(provider, model);
  const body = JSON.stringify(bodyFor(provider, model, prompt, requestOptions));

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: headersFor(provider, apiKey),
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        const text = await response.text();
        const error = new Error(
          `${provider.label} request failed (${response.status}): ${text.slice(0, 1000)}`,
        );

        if (RETRYABLE_STATUS.has(response.status) && attempt < MAX_ATTEMPTS) {
          lastError = error;
          await sleep(500 * 2 ** (attempt - 1));
          continue;
        }

        throw error;
      }

      const data = (await response.json()) as unknown;
      const content = contentFrom(provider, data);

      if (content.trim() === "") {
        throw new Error(
          `${provider.label} returned an empty response${errorDetail(provider, data) ?? ""}`,
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
    : new Error(
        `${provider.label} request failed after ${MAX_ATTEMPTS} attempts`,
      );
}

export interface LlmTestResult {
  text: string;
  latencyMs: number;
}

/** Tiny round-trip used by the AI providers page. */
export async function testConnection(
  config: LlmConfig,
): Promise<LlmTestResult> {
  const started = Date.now();
  const text = await complete("Reply with exactly: OK", config, {
    json: false,
    maxTokens: 64,
    timeoutMs: TEST_TIMEOUT_MS,
  });

  return { text, latencyMs: Date.now() - started };
}

/**
 * Backwards-compatible OpenRouter entry point used by older code and tests.
 * New callers should go through `llmComplete` so the saved provider settings
 * and any other provider can be used.
 */
export async function openRouterWrapper(prompt: string): Promise<string> {
  const apiKey = process.env.openRouterAPIKEY;
  if (!apiKey) {
    throw new Error(
      "openRouterAPIKEY is not set. Add it to .env (see .env.example) before running Jobwright.",
    );
  }

  const provider = getProvider("openrouter");
  const model = process.env.OPENROUTER_MODEL ?? provider.defaultModel;
  const useJsonMode = process.env.OPENROUTER_JSON_MODE !== "false";

  return complete(
    prompt,
    { provider: "openrouter", model, apiKey },
    { json: useJsonMode },
  );
}
