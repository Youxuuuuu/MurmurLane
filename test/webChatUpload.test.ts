import test from "node:test";
import assert from "node:assert/strict";

import {
  createWebChatApi,
  WebChatUploadTimeoutError,
} from "../src/data/chatApi";

const webChatApi = createWebChatApi({
  baseUrl: "",
  credential: "",
  sendTimeoutMs: 15_000,
  uploadTimeoutMs: 120_000,
});

test("web chat uploads a Blob as binary without base64 or JSON expansion", async (t) => {
  const originalFetch = globalThis.fetch;
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  globalThis.fetch = async (input, init) => {
    capturedUrl = String(input);
    capturedInit = init;
    return new Response(JSON.stringify({
      media: {
        kind: "file",
        fileName: "小诗.txt",
        contentType: "text/plain",
      },
    }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const blob = new Blob(["hello"], { type: "text/plain" });
  const media = await webChatApi.uploadFile(blob, "小诗.txt", "file");

  assert.equal(capturedUrl.endsWith("/api/chat/uploads"), true);
  assert.equal(capturedInit?.method, "POST");
  assert.equal(capturedInit?.body, blob);
  assert.equal(typeof capturedInit?.body === "string", false);
  const headers = new Headers(capturedInit?.headers);
  assert.equal(headers.get("Content-Type"), "text/plain");
  assert.equal(
    decodeURIComponent(headers.get("X-Cyberboss-File-Name") || ""),
    "小诗.txt",
  );
  assert.equal(headers.get("X-Cyberboss-Media-Kind"), "file");
  assert.equal(media.fileName, "小诗.txt");
});

test("web chat attachment upload has a terminal timeout", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => {
      reject(new DOMException("aborted", "AbortError"));
    }, { once: true });
  });
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  await assert.rejects(
    webChatApi.uploadFile(
      new Blob(["wait"], { type: "text/plain" }),
      "wait.txt",
      "file",
      { timeoutMs: 5 },
    ),
    WebChatUploadTimeoutError,
  );
});
