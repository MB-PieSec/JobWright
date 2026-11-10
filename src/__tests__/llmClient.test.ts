import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { complete, openRouterWrapper } from "../llm/client.js";

function jsonResponse(content: string): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content } }] }),
  } as unknown as Response;
}

function errorResponse(status: number, body = "nope"): Response {
  return {
    ok: false,
    status,
    text: async () => body,
  } as unknown as Response;
}

describe("openRouterWrapper", () => {
  beforeEach(() => {
    vi.stubEnv("openRouterAPIKEY", "test-key");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("throws a clear error when the API key is missing", async () => {
    vi.stubEnv("openRouterAPIKEY", "");
    await expect(openRouterWrapper("hi")).rejects.toThrow(
      /openRouterAPIKEY is not set/,
    );
  });

  it("retries a transient 5xx and returns the eventual response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(503))
      .mockResolvedValueOnce(jsonResponse('{"score": 50}'));
    vi.stubGlobal("fetch", fetchMock);

    await expect(openRouterWrapper("hi")).resolves.toBe('{"score": 50}');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry non-transient errors such as 401", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(errorResponse(401, "unauthorized"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(openRouterWrapper("hi")).rejects.toThrow(
      /OpenRouter request failed \(401\)/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("treats an empty completion as an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse("")));
    await expect(openRouterWrapper("hi")).rejects.toThrow(/empty response/);
  });
});

describe("complete", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("calls OpenAI-compatible providers with a bearer token and JSON mode", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse('{"score": 50}'));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      complete(
        "score this",
        { provider: "openai", model: "gpt-4o-mini", apiKey: "sk-openai" },
        { json: true },
      ),
    ).resolves.toBe('{"score": 50}');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(init.headers).toMatchObject({ Authorization: "Bearer sk-openai" });
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: "gpt-4o-mini",
      max_completion_tokens: 2000,
      response_format: { type: "json_object" },
    });
  });

  it("uses the Anthropic messages shape and headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        content: [{ type: "text", text: '{"score": 75}' }],
      }),
    } as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      complete("score this", {
        provider: "anthropic",
        model: "claude-sonnet-4-5",
        apiKey: "sk-ant",
      }),
    ).resolves.toBe('{"score": 75}');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(init.headers).toMatchObject({
      "x-api-key": "sk-ant",
      "anthropic-version": "2023-06-01",
    });
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
    });
  });

  it("uses the Gemini generateContent shape and headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{"score": 90}' }] } }],
      }),
    } as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      complete(
        "score this",
        { provider: "gemini", model: "gemini-2.5-flash", apiKey: "gem-key" },
        { json: true },
      ),
    ).resolves.toBe('{"score": 90}');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    );
    expect(init.headers).toMatchObject({ "x-goog-api-key": "gem-key" });
    expect(JSON.parse(String(init.body))).toMatchObject({
      generationConfig: { responseMimeType: "application/json" },
    });
  });

  it("rejects an empty API key before making a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      complete("hi", {
        provider: "groq",
        model: "llama-3.3-70b-versatile",
        apiKey: " ",
      }),
    ).rejects.toThrow(/No API key configured for Groq/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
