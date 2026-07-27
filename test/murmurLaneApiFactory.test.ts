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
