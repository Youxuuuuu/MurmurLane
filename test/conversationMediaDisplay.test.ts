import test from "node:test";
import assert from "node:assert/strict";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";

import {
  getConversationStickerFallbackSrc,
} from "../src/lib/conversation";
import { getConversationMediaDisplayGroups } from "../src/lib/conversationMediaDisplay";
import { getStableUserBubbleSegments } from "../src/lib/conversationBubbleSegments";
import { ChatBubble } from "../src/components/conversation/ChatBubble";
import { ConversationFileCard } from "../src/components/conversation/ConversationFileCard";
import { ConversationMediaGroup } from "../src/components/conversation/ConversationMediaGroup";
import type {
  ConversationRecord,
} from "../src/types/conversation";

(globalThis as typeof globalThis & { React: typeof React }).React = React;
const mediaUrls = {
  resolveLocalFile: (path: string) =>
    `/api/file?path=${encodeURIComponent(path)}`,
  resolveWebChatAsset: (path: string) => path,
};

test("live bubble segment media uses the same sticker and photo classification", () => {
  const record: ConversationRecord = {
    id: "web-user-media",
    type: "user",
    meta: {
      bubbleSegments: [
        {
          segmentId: "segment-media",
          text: "",
          attachments: [
            {
              kind: "sticker",
              isImage: true,
              fileName: "sticker.gif",
              path: "D:/inbox/sticker.gif",
            },
            {
              kind: "image",
              isImage: true,
              fileName: "first.jpg",
              path: "D:/inbox/first.jpg",
            },
            {
              kind: "image",
              isImage: true,
              fileName: "second.jpg",
              path: "D:/inbox/second.jpg",
            },
          ],
        },
      ],
    },
  };

  const [segment] = getStableUserBubbleSegments(record);
  const groups = getConversationMediaDisplayGroups(segment.attachments);

  assert.equal(groups.stickers.length, 1);
  assert.deepEqual(groups.images.map((item) => item.fileName), [
    "first.jpg",
    "second.jpg",
  ]);
  assert.equal(groups.files.length, 0);
});

test("duplicate sticker metadata renders once across attachment collections", () => {
  const duplicateSticker = {
    kind: "sticker",
    isImage: true,
    fileName: "sticker.gif",
    path: "D:/inbox/sticker.gif",
  };
  const groups = getConversationMediaDisplayGroups([
    duplicateSticker,
    { ...duplicateSticker, sourceType: "sticker", mediaKey: "sticker-copy" },
  ]);

  assert.equal(groups.stickers.length, 1);
  assert.equal(groups.images.length, 0);
});

test("the shared media group keeps stickers small and routes two images through PhotoStack", () => {
  const stickerMarkup = renderToStaticMarkup(createElement(ConversationMediaGroup, {
    mediaUrls,
    align: "right",
    items: [{
      kind: "sticker",
      stickerId: "stk-1",
      fileName: "sticker.gif",
      url: "data:image/gif;base64,R0lGODlhAQABAAAAACw=",
    }],
  }));
  const imageMarkup = renderToStaticMarkup(createElement(ConversationMediaGroup, {
    mediaUrls,
    align: "right",
    items: [
      { kind: "image", fileName: "first.jpg", url: "data:image/jpeg;base64,AA==" },
      { kind: "image", fileName: "second.jpg", url: "data:image/jpeg;base64,AQ==" },
    ],
  }));

  assert.match(stickerMarkup, /data-conversation-media="sticker"/);
  assert.match(stickerMarkup, /h-\[92px\] w-\[92px\]/);
  assert.doesNotMatch(stickerMarkup, /border-black/);
  assert.match(imageMarkup, /data-media-count="2"/);
  assert.match(imageMarkup, /展开 2 张图片/);
});

function renderFileRecord(record: ConversationRecord) {
  return renderToStaticMarkup(createElement(ChatBubble, {
    mediaUrls,
    message: record,
    messages: [record],
    page: { color: "#725f87", line: "#ded7e6" },
    userProfile: { name: "User" },
    threadProfile: { name: "Assistant" },
  }));
}

test("WebChat bubble segment files use the shared file card", () => {
  const record: ConversationRecord = {
    id: "webchat-segment-file",
    type: "user",
    meta: {
      bubbleSegments: [{
        segmentId: "segment-file",
        text: "",
        attachments: [{
          kind: "file",
          fileName: "segment.txt",
          relativePath: "inbox/segment.txt",
          fileMeta: "12 KB",
        }],
      }],
    },
  };

  const [segment] = getStableUserBubbleSegments(record);
  const markup = renderToStaticMarkup(createElement(ConversationMediaGroup, {
    mediaUrls,
    align: "right",
    items: segment.attachments,
  }));

  assert.match(markup, /data-conversation-media="file-card"/);
  assert.match(markup, />segment\.txt</);
  assert.match(markup, />12 KB</);
});

test("WebChat canonical, Codex import, and ClaudeCode import files use FileCard", () => {
  const records: ConversationRecord[] = [
    {
      id: "webchat-canonical-file",
      type: "user",
      meta: { files: [{ kind: "file", fileName: "canonical.pdf", fileMeta: "PDF" }] },
    },
    {
      id: "codex-import-file",
      type: "assistant",
      meta: { files: [{ kind: "file", fileName: "codex.json", relativePath: "inbox/codex.json" }] },
    },
    {
      id: "claudecode-import-file",
      type: "assistant",
      meta: { files: [{ kind: "file", fileName: "claude.md", relativePath: "inbox/claude.md" }] },
    },
  ];

  records.forEach((record) => {
    const markup = renderFileRecord(record);
    assert.match(markup, /data-conversation-media="file-card"/);
  });
});

test("user and assistant media files render the identical shared card", () => {
  const item = {
    kind: "file",
    fileName: "parity.zip",
    relativePath: "inbox/parity.zip",
    fileMeta: "4 MB",
  };
  const userMarkup = renderToStaticMarkup(createElement(ConversationFileCard, {
    item,
    page: { color: "#725f87", line: "#ded7e6" },
  }));
  const assistantMarkup = renderToStaticMarkup(createElement(ConversationFileCard, {
    item,
    page: { color: "#725f87", line: "#ded7e6" },
  }));

  assert.equal(userMarkup, assistantMarkup);
  assert.match(userMarkup, /data-conversation-media="file-card"/);
});

test("canonical sticker paths do not opt into the basename history fallback", () => {
  assert.equal(getConversationStickerFallbackSrc({
    kind: "sticker",
    stickerId: "stk_001",
    fileName: "stk_001.gif",
    relativePath: "stickers/assets/stk_001.gif",
  }, mediaUrls), "");
});

test("legacy basename-only sticker paths can retry through stickers assets", () => {
  assert.equal(getConversationStickerFallbackSrc({
    kind: "sticker",
    stickerId: "stk_001",
    fileName: "stk_001.gif",
    relativePath: "stk_001.gif",
  }, mediaUrls), "/api/file?path=stickers%2Fassets%2Fstk_001.gif");
  assert.equal(getConversationStickerFallbackSrc({
    kind: "image",
    fileName: "photo.gif",
    relativePath: "photo.gif",
  }, mediaUrls), "");
  assert.equal(getConversationStickerFallbackSrc({
    kind: "file",
    fileName: "notes.txt",
    relativePath: "notes.txt",
  }, mediaUrls), "");
});

test("conversation file rendering has no runtime or provider visual branch", () => {
  const componentSources = [
    "ConversationFileCard.tsx",
    "ConversationMediaGroup.tsx",
    "ChatBubble.tsx",
  ].map((fileName) =>
    readFileSync(new URL(`../src/components/conversation/${fileName}`, import.meta.url), "utf8"),
  ).join("\n");

  assert.doesNotMatch(componentSources, /\bruntimeId\b|\bprovider\b/);
});
