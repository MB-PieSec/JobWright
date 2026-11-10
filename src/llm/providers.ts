export const PROVIDER_IDS = [
  "openrouter",
  "openai",
  "anthropic",
  "gemini",
  "groq",
  "deepseek",
  "mistral",
  "xai",
  "together",
] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

export type ProviderKind = "openai" | "anthropic" | "gemini";

export interface LlmProvider {
  id: ProviderId;
  label: string;
  description: string;
  kind: ProviderKind;
  /** Full chat-completions URL for `openai` providers; API root otherwise. */
  endpoint: string;
  envKeys: readonly string[];
  modelEnv?: string;
  defaultModel: string;
  /** Suggestions only — the UI keeps the model field editable. */
  models: readonly string[];
  docsUrl: string;
  supportsJsonMode: boolean;
  /** OpenAI's newer models prefer this over `max_tokens`. */
  tokenParam?: "max_tokens" | "max_completion_tokens";
}

export const PROVIDERS: readonly LlmProvider[] = [
  {
    id: "openrouter",
    label: "OpenRouter",
    description:
      "One key for many models. Good default for trying different providers without separate accounts.",
    kind: "openai",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    envKeys: ["OPENROUTER_API_KEY", "openRouterAPIKEY"],
    modelEnv: "OPENROUTER_MODEL",
    defaultModel: "openai/gpt-4o-mini",
    models: [
      "openai/gpt-4o-mini",
      "openai/gpt-4.1-mini",
      "anthropic/claude-sonnet-4.5",
      "google/gemini-2.5-flash",
      "meta-llama/llama-3.3-70b-instruct",
      "deepseek/deepseek-chat",
    ],
    docsUrl: "https://openrouter.ai/docs/api-reference/overview",
    supportsJsonMode: true,
    tokenParam: "max_tokens",
  },
  {
    id: "openai",
    label: "OpenAI",
    description: "Direct access to GPT models using an OpenAI platform key.",
    kind: "openai",
    endpoint: "https://api.openai.com/v1/chat/completions",
    envKeys: ["OPENAI_API_KEY"],
    modelEnv: "OPENAI_MODEL",
    defaultModel: "gpt-4o-mini",
    models: ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4.1", "o4-mini"],
    docsUrl: "https://platform.openai.com/docs/api-reference/chat",
    supportsJsonMode: true,
    tokenParam: "max_completion_tokens",
  },
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    description: "Claude models through the Anthropic Messages API.",
    kind: "anthropic",
    endpoint: "https://api.anthropic.com/v1/messages",
    envKeys: ["ANTHROPIC_API_KEY"],
    modelEnv: "ANTHROPIC_MODEL",
    defaultModel: "claude-sonnet-4-5",
    models: [
      "claude-sonnet-4-5",
      "claude-haiku-4-5",
      "claude-opus-4-1",
      "claude-3-5-haiku-latest",
    ],
    docsUrl: "https://docs.anthropic.com/en/api/messages",
    supportsJsonMode: false,
  },
  {
    id: "gemini",
    label: "Google Gemini",
    description: "Gemini models through Google AI Studio keys.",
    kind: "gemini",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models",
    envKeys: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
    modelEnv: "GEMINI_MODEL",
    defaultModel: "gemini-2.5-flash",
    models: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
    docsUrl: "https://ai.google.dev/gemini-api/docs/text-generation",
    supportsJsonMode: true,
  },
  {
    id: "groq",
    label: "Groq",
    description: "Very fast inference for open-weight models.",
    kind: "openai",
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    envKeys: ["GROQ_API_KEY"],
    modelEnv: "GROQ_MODEL",
    defaultModel: "llama-3.3-70b-versatile",
    models: [
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "openai/gpt-oss-120b",
      "qwen/qwen3-32b",
    ],
    docsUrl: "https://console.groq.com/docs/api-reference",
    supportsJsonMode: true,
    tokenParam: "max_tokens",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    description:
      "Low-cost chat and reasoning models with an OpenAI-compatible API.",
    kind: "openai",
    endpoint: "https://api.deepseek.com/chat/completions",
    envKeys: ["DEEPSEEK_API_KEY"],
    modelEnv: "DEEPSEEK_MODEL",
    defaultModel: "deepseek-chat",
    models: ["deepseek-chat", "deepseek-reasoner"],
    docsUrl: "https://api-docs.deepseek.com/",
    supportsJsonMode: true,
    tokenParam: "max_tokens",
  },
  {
    id: "mistral",
    label: "Mistral AI",
    description:
      "Mistral's hosted models through its OpenAI-compatible endpoint.",
    kind: "openai",
    endpoint: "https://api.mistral.ai/v1/chat/completions",
    envKeys: ["MISTRAL_API_KEY"],
    modelEnv: "MISTRAL_MODEL",
    defaultModel: "mistral-small-latest",
    models: [
      "mistral-small-latest",
      "mistral-large-latest",
      "open-mistral-nemo",
    ],
    docsUrl: "https://docs.mistral.ai/api/",
    supportsJsonMode: true,
    tokenParam: "max_tokens",
  },
  {
    id: "xai",
    label: "xAI (Grok)",
    description: "Grok models through xAI's OpenAI-compatible API.",
    kind: "openai",
    endpoint: "https://api.x.ai/v1/chat/completions",
    envKeys: ["XAI_API_KEY"],
    modelEnv: "XAI_MODEL",
    defaultModel: "grok-3-mini",
    models: ["grok-3-mini", "grok-3", "grok-4-fast"],
    docsUrl: "https://docs.x.ai/docs/api-reference",
    supportsJsonMode: true,
    tokenParam: "max_tokens",
  },
  {
    id: "together",
    label: "Together AI",
    description:
      "Open-weight models hosted by Together, with an OpenAI-compatible API.",
    kind: "openai",
    endpoint: "https://api.together.xyz/v1/chat/completions",
    envKeys: ["TOGETHER_API_KEY"],
    modelEnv: "TOGETHER_MODEL",
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    models: [
      "meta-llama/Llama-3.3-70B-Instruct-Turbo",
      "Qwen/Qwen2.5-72B-Instruct-Turbo",
      "deepseek-ai/DeepSeek-V3",
    ],
    docsUrl: "https://docs.together.ai/reference/chat-completions",
    supportsJsonMode: true,
    tokenParam: "max_tokens",
  },
];

const PROVIDERS_BY_ID = new Map(
  PROVIDERS.map((provider) => [provider.id, provider]),
);

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === "string" && PROVIDERS_BY_ID.has(value as ProviderId);
}

export function getProvider(id: ProviderId): LlmProvider {
  const provider = PROVIDERS_BY_ID.get(id);
  if (!provider) {
    throw new Error(`Unknown AI provider "${id}"`);
  }
  return provider;
}
