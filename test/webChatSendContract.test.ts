import test from "node:test";
import assert from "node:assert/strict";

import { buildWebChatSendEnvelope } from "../src/lib/webChatSendContract";
import { createWebChatDraftRecord } from "../src/lib/webChatRecords";
import { getConversationRenderId } from "../src/lib/conversationIdentity";
import { getStableUserBubbleSegments } from "../src/lib/conversationBubbleSegments";

test("one click produces one request, one logical message, and one segment", () => {
  const envelope = buildWebChatSendEnvelope({
    requestId: "request-1",
    messageId: "message-1",
    clientId: "client-1",
    messages: [{ segmentId: "segment-1", text: "hello" }],
    receivedAt: "2026-07-18T00:00:00.000Z",
  });

  assert.equal(envelope.requestId, "request-1");
  assert.equal(envelope.messageId, "message-1");
  assert.equal(envelope.logicalTurnId, "web:request-1");
  assert.equal(envelope.messages.length, 1);
  assert.equal(envelope.messages[0].messageId, "message-1");
  assert.deepEqual(envelope.messages[0].bubbleSegments, [
    { segmentId: "segment-1", text: "hello" },
  ]);
});

test("three staged drafts remain segments of one logical user message", () => {
  const envelope = buildWebChatSendEnvelope({
    requestId: "request-3",
    messageId: "message-3",
    clientId: "client-3",
    messages: [
      { segmentId: "segment-a", text: "first" },
      { segmentId: "segment-b", text: "second" },
      { segmentId: "segment-c", text: "third" },
    ],
    receivedAt: "2026-07-18T00:00:00.000Z",
  });

  assert.equal(envelope.messages.length, 1);
  assert.equal(envelope.messages[0].text, "first\n\nsecond\n\nthird");
  assert.deepEqual(
    envelope.messages[0].bubbleSegments.map((segment) => segment.segmentId),
    ["segment-a", "segment-b", "segment-c"],
  );
  assert.ok(envelope.messages[0].bubbleSegments.every(
    (segment) => !Object.hasOwn(segment, "messageId"),
  ));

  const draft = createWebChatDraftRecord(
    envelope.messages[0],
    "thread-3",
    {
      requestId: envelope.requestId,
      logicalTurnId: envelope.logicalTurnId,
    },
  );
  assert.equal(getConversationRenderId(draft), "user:message-3");
  assert.equal(draft.meta?.bubbleSegments?.length, 3);
  assert.deepEqual(
    draft.meta?.bubbleSegments?.map((segment) => segment.segmentId),
    ["segment-a", "segment-b", "segment-c"],
  );
  assert.deepEqual(
    getStableUserBubbleSegments(draft).map((segment) => segment.segmentId),
    ["segment-a", "segment-b", "segment-c"],
  );
});

test("content cannot replace required stable identities", () => {
  assert.throws(() => buildWebChatSendEnvelope({
    requestId: "request-missing-segment",
    messageId: "message-missing-segment",
    clientId: "client-1",
    messages: [{ text: "same text is not an identity" }],
  }), /segmentId/);
});

test("one logical message cannot contain duplicate segment identities", () => {
  assert.throws(() => buildWebChatSendEnvelope({
    requestId: "request-duplicate-segment",
    messageId: "message-duplicate-segment",
    clientId: "client-1",
    messages: [
      { segmentId: "segment-1", text: "first" },
      { segmentId: "segment-1", text: "second" },
    ],
  }), /unique segmentId/);
});
