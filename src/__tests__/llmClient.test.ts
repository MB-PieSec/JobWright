import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openRouterWrapper } from "../llm/client.js";

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
    await expect(openRouterWrapper("hi")).rejects.toThrow(/openRouterAPIKEY is not set/);
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
    const fetchMock = vi.fn().mockResolvedValue(errorResponse(401, "unauthorized"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(openRouterWrapper("hi")).rejects.toThrow(/OpenRouter request failed \(401\)/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("treats an empty completion as an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse("")));
    await expect(openRouterWrapper("hi")).rejects.toThrow(/empty response/);
  });
});
