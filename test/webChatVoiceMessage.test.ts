import test from "node:test";
import assert from "node:assert/strict";

import { createWebChatApi } from "../src/data/chatApi";

test("web chat sends one Voice Draft as binary with stable command identity", async (t) => {
  const originalFetch = globalThis.fetch;
  let captured: { url: string; init?: RequestInit } | null = null;
  globalThis.fetch = async (url, init) => {
    captured = { url: String(url), init };
    return new Response(JSON.stringify({
      accepted: true,
      status: "accepted",
      requestId: "request-voice-1",
      messageId: "message-voice-1",
      threadId: "thread-1",
    }), { status: 202, headers: { "Content-Type": "application/json" } });
  };
  t.after(() => { globalThis.fetch = originalFetch; });
  const api = createWebChatApi({
    baseUrl: "http://127.0.0.1:8791",
    credential: "test-token",
    sendTimeoutMs: 15_000,
    uploadTimeoutMs: 120_000,
  });
  const blob = new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])], { type: "audio/webm;codecs=opus" });

  const result = await api.sendVoiceMessage({
    blob,
    requestId: "request-voice-1",
    messageId: "message-voice-1",
    threadId: "thread-1",
    clientId: "client-1",
    newThread: false,
    receivedAt: "2026-08-09T00:00:00.000Z",
  });

  assert.equal(captured?.url, "http://127.0.0.1:8791/api/chat/voice-messages");
  assert.equal(captured?.init?.body, blob);
  const headers = new Headers(captured?.init?.headers);
  assert.equal(headers.get("Content-Type"), "audio/webm;codecs=opus");
  assert.equal(headers.get("X-Cyberboss-Request-Id"), "request-voice-1");
  assert.equal(headers.get("X-Cyberboss-Message-Id"), "message-voice-1");
  assert.equal(headers.get("X-Cyberboss-Thread-Id"), "thread-1");
  assert.equal(headers.get("X-Cyberboss-Client-Id"), "client-1");
  assert.equal(headers.get("X-Cyberboss-New-Thread"), "false");
  assert.equal(result.accepted, true);
});

test("web chat exposes dedicated retry and transcript confirmation commands", async (t) => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
  globalThis.fetch = async (url, init) => {
    requests.push({ url: String(url), body: JSON.parse(String(init?.body || "{}")) });
    return new Response(JSON.stringify({ accepted: true, messageId: "message-voice-1" }), {
      status: 202,
      headers: { "Content-Type": "application/json" },
    });
  };
  t.after(() => { globalThis.fetch = originalFetch; });
  const api = createWebChatApi({ baseUrl: "", credential: "", sendTimeoutMs: 15_000, uploadTimeoutMs: 120_000 });

  await api.retryVoiceMessage({ messageId: "message-voice-1", requestId: "retry-1", clientId: "client-1" });
  await api.confirmVoiceTranscript({
    messageId: "message-voice-1",
    requestId: "confirm-1",
    clientId: "client-1",
    normalizedText: "修正后的文字",
  });

  assert.equal(requests[0].url, "/api/chat/voice-messages/message-voice-1/retry");
  assert.deepEqual(requests[0].body, { requestId: "retry-1", clientId: "client-1" });
  assert.equal(requests[1].url, "/api/chat/voice-messages/message-voice-1/transcript");
  assert.deepEqual(requests[1].body, { requestId: "confirm-1", clientId: "client-1", normalizedText: "修正后的文字" });
});
