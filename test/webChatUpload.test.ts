import test from "node:test";
import assert from "node:assert/strict";

import { uploadWebChatFile } from "../src/data/chatApi";

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
  const media = await uploadWebChatFile(blob, "小诗.txt", "file");

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
