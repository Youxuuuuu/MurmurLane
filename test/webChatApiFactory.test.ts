import test from "node:test";
import assert from "node:assert/strict";
import { createWebChatApi } from "../src/data/chatApi";

test("WebChat Adapter 只使用 Composition Root 注入的 URL、凭据与 Timeout", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  let requestedHeaders: Headers | undefined;
  globalThis.fetch = (async (url, init) => {
    requestedUrl = String(url);
    requestedHeaders = new Headers(init?.headers);
    return {
      ok: true,
      json: async () => ({ status: "idle" }),
    } as Response;
  }) as typeof fetch;

  try {
    const api = createWebChatApi({
      baseUrl: "https://chat.example.com/",
      credential: "chat-token",
      sendTimeoutMs: 15_000,
      uploadTimeoutMs: 120_000,
    });

    await api.fetchStatus("thread-1");

    assert.equal(
      requestedUrl,
      "https://chat.example.com/api/chat/status?threadId=thread-1",
    );
    assert.equal(
      requestedHeaders?.get("X-Cyberboss-Web-Token"),
      "chat-token",
    );
    assert.equal(
      requestedHeaders?.get("Authorization"),
      "Bearer chat-token",
    );
    assert.equal(api.sendTimeoutMs, 15_000);
    assert.equal(api.uploadTimeoutMs, 120_000);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
