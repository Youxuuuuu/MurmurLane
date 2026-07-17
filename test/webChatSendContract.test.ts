import test from "node:test";
import assert from "node:assert/strict";

import { buildWebChatSendEnvelope } from "../src/lib/webChatSendContract";

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
});

test("content cannot replace required stable identities", () => {
  assert.throws(() => buildWebChatSendEnvelope({
    requestId: "request-missing-segment",
    messageId: "message-missing-segment",
    clientId: "client-1",
    messages: [{ text: "same text is not an identity" }],
  }), /segmentId/);
});
