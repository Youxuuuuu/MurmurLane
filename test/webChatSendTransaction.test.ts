import test from "node:test";
import assert from "node:assert/strict";

import {
  createWebChatSendTransaction,
  transitionWebChatSendTransaction,
} from "../src/lib/webChatSendTransaction";
import { buildWebChatSendEnvelope } from "../src/lib/webChatSendContract";
import {
  WebChatHttpError,
  WebChatSendTimeoutError,
  isAmbiguousWebChatSendError,
} from "../src/data/chatApi";
import {
  createWebChatDraftRecord,
  settleWebChatDrafts,
} from "../src/lib/webChatRecords";
import { getConversationRenderId } from "../src/lib/conversationIdentity";

test("send transaction keeps request, message, turn, and segment identity across retry", () => {
  const envelope = buildWebChatSendEnvelope({
    requestId: "request-1",
    messageId: "message-1",
    clientId: "client-1",
    threadId: "thread-1",
    messages: [
      { segmentId: "segment-a", text: "first" },
      { segmentId: "segment-b", text: "second" },
    ],
  });
  const initial = createWebChatSendTransaction(envelope);
  const submitting = transitionWebChatSendTransaction(initial, { type: "submit" });
  const unknown = transitionWebChatSendTransaction(submitting, {
    type: "unknown",
    error: "network timeout",
  });
  const retrying = transitionWebChatSendTransaction(unknown, { type: "retry" });
  const accepted = transitionWebChatSendTransaction(retrying, { type: "accepted" });

  assert.deepEqual(
    [initial.state, submitting.state, unknown.state, retrying.state, accepted.state],
    ["staging", "submitting", "unknown", "submitting", "accepted"],
  );
  assert.equal(accepted.attempts, 2);
  assert.equal(accepted.envelope.requestId, "request-1");
  assert.equal(accepted.envelope.messageId, "message-1");
  assert.equal(accepted.envelope.logicalTurnId, "web:request-1");
  assert.deepEqual(
    accepted.envelope.messages[0].bubbleSegments.map((segment) => segment.segmentId),
    ["segment-a", "segment-b"],
  );
});

test("failed and unknown sends may retry while accepted sends cannot", () => {
  const envelope = buildWebChatSendEnvelope({
    requestId: "request-2",
    messageId: "message-2",
    clientId: "client-2",
    messages: [{ segmentId: "segment-2", text: "hello" }],
  });
  const submitting = transitionWebChatSendTransaction(
    createWebChatSendTransaction(envelope),
    { type: "submit" },
  );
  const failed = transitionWebChatSendTransaction(submitting, {
    type: "failed",
    error: "bad request",
  });
  assert.equal(transitionWebChatSendTransaction(failed, { type: "retry" }).state, "submitting");
  const accepted = transitionWebChatSendTransaction(submitting, { type: "accepted" });
  assert.throws(
    () => transitionWebChatSendTransaction(accepted, { type: "retry" }),
    /cannot retry accepted/,
  );
});

test("delivery state changes and retry preserve one mounted logical message", () => {
  const envelope = buildWebChatSendEnvelope({
    requestId: "request-stable",
    messageId: "message-stable",
    clientId: "client-stable",
    threadId: "thread-stable",
    messages: [{ segmentId: "segment-stable", text: "hello" }],
  });
  const draft = createWebChatDraftRecord(
    envelope.messages[0],
    "thread-stable",
    { requestId: envelope.requestId, logicalTurnId: envelope.logicalTurnId },
  );
  const renderId = getConversationRenderId(draft, "thread-stable");
  let records = { "thread-stable": [draft] };

  for (const deliveryState of ["submitting", "unknown", "submitting", "sent"] as const) {
    records = settleWebChatDrafts(records, {
      sourceThreadId: "thread-stable",
      messageIds: [envelope.messageId],
      deliveryState,
    });
    assert.equal(records["thread-stable"].length, 1);
    assert.equal(
      getConversationRenderId(records["thread-stable"][0], "thread-stable"),
      renderId,
    );
  }
});

test("only transport-ambiguous errors enter recovery", () => {
  assert.equal(isAmbiguousWebChatSendError(new WebChatSendTimeoutError()), true);
  assert.equal(isAmbiguousWebChatSendError(new TypeError("network failed")), true);
  assert.equal(isAmbiguousWebChatSendError(new WebChatHttpError(400, "bad request")), false);
  assert.equal(isAmbiguousWebChatSendError(new Error("application failure")), false);
});
