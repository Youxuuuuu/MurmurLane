import test from "node:test";
import assert from "node:assert/strict";
import { createMurmurLaneApi } from "../src/data/api";

test("MurmurLane Data Adapter 只使用 Composition Root 注入的 URL 与浏览器凭据", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  let requestedHeaders: Headers | undefined;
  globalThis.fetch = (async (url, init) => {
    requestedUrl = String(url);
    requestedHeaders = new Headers(init?.headers);
    return {
      ok: true,
      json: async () => ({ conversations: [] }),
    } as Response;
  }) as typeof fetch;

  try {
    const api = createMurmurLaneApi({
      baseUrl: "https://murmur.example.com/",
      editCredential: "edit-token",
      diagnostics: { development: false },
    });

    await api.fetchDateIndex();

    assert.equal(
      requestedUrl,
      "https://murmur.example.com/api/index/dates",
    );
    assert.equal(
      requestedHeaders?.get("X-MurmurLane-Edit-Token"),
      "edit-token",
    );
    assert.equal(api.hasEditCredential, true);
    assert.equal(
      api.resolveFileUrl("D:\\data\\image.jpg"),
      "https://murmur.example.com/api/file?path=D%3A%5Cdata%5Cimage.jpg",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("MurmurLane Data Adapter 通过自己的受保护端点删除对话归档", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  let requestedMethod = "";
  let requestedHeaders: Headers | undefined;
  globalThis.fetch = (async (url, init) => {
    requestedUrl = String(url);
    requestedMethod = String(init?.method || "GET");
    requestedHeaders = new Headers(init?.headers);
    return Response.json({
      ok: true,
      threadId: "thread/delete",
      deletedRecordCount: 2,
      touchedDates: ["2026-07-31"],
      deletedSourceKeys: ["source-a", "source-b"],
    });
  }) as typeof fetch;

  try {
    const api = createMurmurLaneApi({
      baseUrl: "https://murmur.example.com/",
      editCredential: "edit-token",
      diagnostics: { development: false },
    });

    const result = await api.deleteConversationThread("thread/delete");

    assert.equal(
      requestedUrl,
      "https://murmur.example.com/api/conversations/thread/thread%2Fdelete",
    );
    assert.equal(requestedMethod, "DELETE");
    assert.equal(
      requestedHeaders?.get("X-MurmurLane-Edit-Token"),
      "edit-token",
    );
    assert.equal(result.deletedRecordCount, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
