import test from "node:test";
import assert from "node:assert/strict";

import { resolveWebChatAssetUrl } from "../src/data/chatApi";
import { getConversationMediaSrc } from "../src/lib/conversation";

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

test("archived user images and stickers use MurmurLane's local file API without Cyberboss", () => {
  const chatMediaUrl = "/api/chat/media?path=D%3A%5Cstudy%5C.cyberboss%5Cinbox%5C2026-07-19%5Casset";
  const items = [
    {
      kind: "image",
      fileName: "1000087452.jpg",
      relativePath: "inbox/2026-07-19/1000087452.jpg",
      path: "D:/study/.cyberboss/inbox/2026-07-19/1000087452.jpg",
      url: `${chatMediaUrl}.jpg`,
    },
    {
      kind: "image",
      fileName: "1000086022.gif",
      relativePath: "inbox/2026-07-19/1000086022.gif",
      path: "D:/study/.cyberboss/inbox/2026-07-19/1000086022.gif",
      url: `${chatMediaUrl}.gif`,
    },
  ];

  assert.deepEqual(items.map(getConversationMediaSrc), [
    "/api/file?path=inbox%2F2026-07-19%2F1000087452.jpg",
    "/api/file?path=inbox%2F2026-07-19%2F1000086022.gif",
  ]);
});

test("archived chat media can recover a local path from its persisted URL", () => {
  const assetUrl = "/api/chat/media?path=inbox%2F2026-07-19%2Furl-only.jpg";
  assert.equal(
    getConversationMediaSrc({ url: assetUrl }),
    "/api/file?path=inbox%2F2026-07-19%2Furl-only.jpg",
  );
});

test("chat media without any local path remains a remote fallback", () => {
  const assetUrl = "/api/chat/media?id=remote-only";
  assert.equal(getConversationMediaSrc({ url: assetUrl }), assetUrl);
});
