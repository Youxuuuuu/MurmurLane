import test from "node:test";
import assert from "node:assert/strict";

import {
  createWebChatPendingUpload,
  resolvePendingWebChatMessages,
  toOptimisticWebChatMessages,
} from "../src/lib/webChatPendingUploads";

test("choosing an attachment creates a local candidate without a server path", () => {
  const file = new Blob(["local-only"], { type: "text/html" });
  const pending = createWebChatPendingUpload(file, {
    fileName: "page.html",
    kind: "file",
  });
  const [optimistic] = toOptimisticWebChatMessages([{
    segmentId: "segment-file",
    text: "",
    attachments: [pending],
  }]);

  assert.equal(pending.file, file);
  assert.equal(Object.hasOwn(pending, "path"), false);
  assert.equal(Object.hasOwn(pending, "url"), false);
  assert.equal(optimistic.attachments?.[0].fileName, "page.html");
  assert.equal(Object.hasOwn(optimistic.attachments?.[0] || {}, "file"), false);
});

test("pending attachments upload sequentially only when the send transaction prepares", async () => {
  const first = createWebChatPendingUpload(
    new Blob(["first"], { type: "image/jpeg" }),
    { fileName: "first.jpg", kind: "image" },
  );
  const second = createWebChatPendingUpload(
    new Blob(["second"], { type: "image/jpeg" }),
    { fileName: "second.jpg", kind: "image" },
  );
  let active = 0;
  let maxActive = 0;
  const uploaded: string[] = [];

  const [message] = await resolvePendingWebChatMessages([{
    segmentId: "segment-images",
    text: "一起发送",
    attachments: [first, second],
  }], async (_file, fileName, kind) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, 0));
    uploaded.push(fileName);
    active -= 1;
    return {
      kind,
      fileName,
      path: `D:/state/inbox/${fileName}`,
    };
  });

  assert.equal(maxActive, 1);
  assert.deepEqual(uploaded, ["first.jpg", "second.jpg"]);
  assert.deepEqual(
    message.attachments?.map((item) => item.fileName),
    ["first.jpg", "second.jpg"],
  );
  assert.ok(message.attachments?.every((item) => !Object.hasOwn(item, "file")));
});

test("retry reuses attachments that already uploaded before a later failure", async () => {
  const first = createWebChatPendingUpload(
    new Blob(["first"], { type: "image/jpeg" }),
    { fileName: "first.jpg", kind: "image" },
  );
  const second = createWebChatPendingUpload(
    new Blob(["second"], { type: "image/jpeg" }),
    { fileName: "second.jpg", kind: "image" },
  );
  const messages = [{
    segmentId: "segment-retry",
    text: "",
    attachments: [first, second],
  }];
  const cache = new Map();
  const attempts: string[] = [];
  let failSecond = true;
  const upload = async (_file: Blob, fileName: string, kind: string) => {
    attempts.push(fileName);
    if (fileName === "second.jpg" && failSecond) {
      throw new Error("temporary failure");
    }
    return { kind, fileName, path: `D:/state/inbox/${fileName}` };
  };

  await assert.rejects(
    resolvePendingWebChatMessages(messages, upload, cache),
    /temporary failure/,
  );
  failSecond = false;
  const [resolved] = await resolvePendingWebChatMessages(messages, upload, cache);

  assert.deepEqual(attempts, ["first.jpg", "second.jpg", "second.jpg"]);
  assert.deepEqual(
    resolved.attachments?.map((item) => item.fileName),
    ["first.jpg", "second.jpg"],
  );
});
