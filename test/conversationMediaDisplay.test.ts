import test from "node:test";
import assert from "node:assert/strict";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { getConversationMediaDisplayGroups } from "../src/lib/conversationMediaDisplay";
import { getStableUserBubbleSegments } from "../src/lib/conversationBubbleSegments";
import { ConversationMediaGroup } from "../src/components/conversation/ConversationMediaGroup";
import type { ConversationRecord } from "../src/types/conversation";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

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
    align: "right",
    items: [{
      kind: "sticker",
      stickerId: "stk-1",
      fileName: "sticker.gif",
      url: "data:image/gif;base64,R0lGODlhAQABAAAAACw=",
    }],
  }));
  const imageMarkup = renderToStaticMarkup(createElement(ConversationMediaGroup, {
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
