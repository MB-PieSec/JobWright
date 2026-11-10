import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

let tempDir: string;
let ai: typeof import("../llm/config.js");

beforeAll(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "jobwright-ai-"));
  process.env.JOBWRIGHT_DB_PATH = path.join(tempDir, "test.db");
  vi.resetModules();
  ai = await import("../llm/config.js");
});

afterAll(async () => {
  delete process.env.JOBWRIGHT_DB_PATH;
  await rm(tempDir, { recursive: true, force: true });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("AI provider settings", () => {
  it("saves provider, model and key without returning the key", async () => {
    const state = await ai.saveAiConfig({
      provider: "openrouter",
      model: "openai/gpt-4o-mini",
      apiKey: "sk-secret-test",
    });

    expect(state.active).toMatchObject({
      provider: "openrouter",
      model: "openai/gpt-4o-mini",
      keySource: "saved",
      configured: true,
    });
    expect(
      state.providers.find((provider) => provider.id === "openrouter")
        ?.hasSavedKey,
    ).toBe(true);
    expect(JSON.stringify(state)).not.toContain("sk-secret-test");
  });

  it("falls back to an environment key after the saved key is removed", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "env-secret-test");

    const state = await ai.clearAiKey("openrouter");

    expect(state.active.keySource).toBe("environment");
    expect(state.active.configured).toBe(true);
    expect(JSON.stringify(state)).not.toContain("env-secret-test");
  });

  it("reports a missing key when neither source is configured", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    vi.stubEnv("openRouterAPIKEY", "");

    const state = await ai.clearAiKey("openrouter");

    expect(state.active.keySource).toBeNull();
    expect(state.active.configured).toBe(false);
  });

  it("tests a pasted key without saving it", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: "OK" } }] }),
    } as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);

    const result = await ai.testAiConnection({
      provider: "openrouter",
      model: "openai/gpt-4o-mini",
      apiKey: "sk-pasted-test",
    });

    expect(result).toMatchObject({
      ok: true,
      provider: "openrouter",
      model: "openai/gpt-4o-mini",
      response: "OK",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer sk-pasted-test",
        }),
      }),
    );

    const state = await ai.getAiState();
    expect(
      state.providers.find((provider) => provider.id === "openrouter")
        ?.hasSavedKey,
    ).toBe(false);
  });
});
