import { complete, testConnection } from "./client.js";
import {
  getProvider,
  isProviderId,
  PROVIDERS,
  type LlmProvider,
  type ProviderId,
} from "./providers.js";

export type AiKeySource = "saved" | "environment" | null;

export interface AiActiveConfig {
  provider: ProviderId;
  model: string;
  keySource: AiKeySource;
  configured: boolean;
}

export interface AiProviderState {
  id: ProviderId;
  label: string;
  description: string;
  docsUrl: string;
  defaultModel: string;
  models: readonly string[];
  envKeys: readonly string[];
  keySource: AiKeySource;
  hasSavedKey: boolean;
  hasEnvKey: boolean;
}

export interface AiState {
  active: AiActiveConfig;
  providers: AiProviderState[];
}

export interface ActiveProviderConfig {
  provider: LlmProvider;
  model: string;
  apiKey: string;
  keySource: AiKeySource;
}

interface ResolvedKey {
  apiKey: string;
  keySource: AiKeySource;
  hasSavedKey: boolean;
  hasEnvKey: boolean;
}

/*
 * Settings are loaded lazily so importing the LLM client (including from unit
 * tests) never opens the database as a side effect.
 */
async function readSetting<T>(key: string): Promise<T | null> {
  const { getSetting } = await import("../settings/store.js");
  return getSetting<T>(key);
}

async function writeSetting(key: string, value: unknown): Promise<void> {
  const { setSetting } = await import("../settings/store.js");
  setSetting(key, value);
}

async function deleteSetting(key: string): Promise<void> {
  const { deleteSetting: removeSetting } = await import("../settings/store.js");
  removeSetting(key);
}

function envKeyFor(provider: LlmProvider): string {
  for (const name of provider.envKeys) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return "";
}

function defaultProviderId(): ProviderId {
  const withEnv = PROVIDERS.find((provider) =>
    provider.envKeys.some((name) => Boolean(process.env[name]?.trim())),
  );
  return withEnv?.id ?? "openrouter";
}

async function resolveKey(provider: LlmProvider): Promise<ResolvedKey> {
  const savedKey = (
    await readSetting<string>(`ai.keys.${provider.id}`)
  )?.trim();
  const envKey = envKeyFor(provider);

  if (savedKey) {
    return {
      apiKey: savedKey,
      keySource: "saved",
      hasSavedKey: true,
      hasEnvKey: Boolean(envKey),
    };
  }

  return {
    apiKey: envKey,
    keySource: envKey ? "environment" : null,
    hasSavedKey: false,
    hasEnvKey: Boolean(envKey),
  };
}

/**
 * Resolves the provider/model/key used by resume parsing and job scoring.
 * A key saved in the web UI wins over an environment variable so the user can
 * replace a stale key without editing `.env` and restarting the server.
 */
export async function getActiveAiConfig(): Promise<ActiveProviderConfig> {
  const savedProvider = await readSetting<string>("ai.provider");
  const providerId =
    savedProvider && isProviderId(savedProvider)
      ? savedProvider
      : defaultProviderId();
  const provider = getProvider(providerId);

  const savedModel = (await readSetting<string>("ai.model"))?.trim();
  const envModel = provider.modelEnv
    ? process.env[provider.modelEnv]?.trim()
    : undefined;
  const model =
    savedProvider === providerId && savedModel
      ? savedModel
      : envModel || provider.defaultModel;

  const key = await resolveKey(provider);

  return {
    provider,
    model,
    apiKey: key.apiKey,
    keySource: key.keySource,
  };
}

export async function getAiState(): Promise<AiState> {
  const active = await getActiveAiConfig();

  const providers = await Promise.all(
    PROVIDERS.map(async (provider): Promise<AiProviderState> => {
      const key = await resolveKey(provider);
      return {
        id: provider.id,
        label: provider.label,
        description: provider.description,
        docsUrl: provider.docsUrl,
        defaultModel: provider.defaultModel,
        models: provider.models,
        envKeys: provider.envKeys,
        keySource: key.keySource,
        hasSavedKey: key.hasSavedKey,
        hasEnvKey: key.hasEnvKey,
      };
    }),
  );

  return {
    active: {
      provider: active.provider.id,
      model: active.model,
      keySource: active.keySource,
      configured: Boolean(active.apiKey),
    },
    providers,
  };
}

export interface SaveAiConfigInput {
  provider: ProviderId;
  model: string;
  /** A string saves/replaces the key; null removes the saved key. */
  apiKey?: string | null;
}

export async function saveAiConfig(input: SaveAiConfigInput): Promise<AiState> {
  const provider = getProvider(input.provider);
  const model = input.model.trim() || provider.defaultModel;

  await writeSetting("ai.provider", provider.id);
  await writeSetting("ai.model", model);

  if (input.apiKey === null) {
    await deleteSetting(`ai.keys.${provider.id}`);
  } else if (typeof input.apiKey === "string") {
    const key = input.apiKey.trim();
    if (!key) {
      throw new Error("The API key cannot be empty.");
    }
    await writeSetting(`ai.keys.${provider.id}`, key);
  }

  return getAiState();
}

export async function clearAiKey(providerId: ProviderId): Promise<AiState> {
  const provider = getProvider(providerId);
  await deleteSetting(`ai.keys.${provider.id}`);
  return getAiState();
}

/** Runs resume parsing and job scoring through the active provider. */
export async function llmComplete(prompt: string): Promise<string> {
  const active = await getActiveAiConfig();

  if (!active.apiKey) {
    const envHint = active.provider.envKeys[0]
      ? ` or set ${active.provider.envKeys[0]}`
      : "";
    throw new Error(
      `No API key configured for ${active.provider.label}. Add one in AI providers${envHint} before running Jobwright.`,
    );
  }

  return complete(
    prompt,
    {
      provider: active.provider.id,
      model: active.model,
      apiKey: active.apiKey,
    },
    { json: true },
  );
}

export interface TestAiInput {
  provider: ProviderId;
  model: string;
  /** A pasted key takes precedence over the saved/environment key. */
  apiKey?: string;
}

export interface TestAiResult {
  ok: true;
  provider: ProviderId;
  model: string;
  latencyMs: number;
  response: string;
}

export async function testAiConnection(
  input: TestAiInput,
): Promise<TestAiResult> {
  const provider = getProvider(input.provider);
  const resolved = await resolveKey(provider);
  const apiKey = input.apiKey?.trim() || resolved.apiKey;
  const model = input.model.trim() || provider.defaultModel;

  if (!apiKey) {
    const envHint = provider.envKeys[0] ? ` or set ${provider.envKeys[0]}` : "";
    throw new Error(
      `No API key configured for ${provider.label}. Paste one above${envHint}.`,
    );
  }

  const result = await testConnection({
    provider: provider.id,
    model,
    apiKey,
  });

  return {
    ok: true,
    provider: provider.id,
    model,
    latencyMs: result.latencyMs,
    response: result.text.trim().slice(0, 200),
  };
}
