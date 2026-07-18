import test from "node:test";
import assert from "node:assert/strict";

import { resolveWebChatAssetUrl } from "../src/data/chatApi";

test("web chat media URLs carry authentication without changing persisted media", () => {
  const persistedUrl = "/api/chat/media?path=D%3A%5Cstudy%5C.cyberboss%5Cinbox%5Cphoto.jpg";
  const resolved = resolveWebChatAssetUrl(persistedUrl, "token with + symbols");
  const query = new URLSearchParams(resolved.slice(resolved.indexOf("?") + 1));

  assert.equal(resolved.startsWith("/api/chat/media?"), true);
  assert.equal(query.get("path"), "D:\\study\\.cyberboss\\inbox\\photo.jpg");
  assert.equal(query.get("token"), "token with + symbols");
  assert.equal(persistedUrl.includes("token"), false);
});

test("web chat media URLs remain unchanged when chat authentication is disabled", () => {
  const assetUrl = "/api/chat/media?path=inbox%2Fphoto.jpg";
  assert.equal(resolveWebChatAssetUrl(assetUrl, ""), assetUrl);
});
