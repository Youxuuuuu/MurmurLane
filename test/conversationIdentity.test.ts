import test from "node:test";
import assert from "node:assert/strict";
import {
  createBubbleId,
  getConversationRenderId,
  getLegacyStableId,
  upsertConversationRecordByIdentity,
} from "../src/lib/conversationIdentity";
import {
  createWebChatLiveRecord,
  createWebChatDraftRecord,
  resolveThreadSubscriptionCursor,
  settleWebChatDrafts,
} from "../src/lib/webChatRecords";
import { mergeConversationRecords } from "../src/lib/conversationMerge";
import type { ConversationRecord } from "../src/types/conversation";

test("draft and canonical user records keep one render identity", () => {
  const draft = createWebChatDraftRecord({
    messageId: "message-1",
    text: "draft text",
    receivedAt: "2026-07-17T00:00:00.000Z",
  }, "draft-thread");
  const canonical: ConversationRecord = {
    id: "archive-record-91",
    messageId: "message-1",
    type: "user",
    threadId: "thread-1",
    turnId: "turn-1",
    text: "canonical text",
    meta: { messageId: "message-1", sourceKey: "web|message|message-1" },
  };

  assert.equal(getConversationRenderId(draft, "draft-thread"), "user:message-1");
  assert.equal(getConversationRenderId(canonical, "thread-1"), "user:message-1");

  const reconciled = upsertConversationRecordByIdentity([draft], canonical, "thread-1");
  assert.equal(reconciled.length, 1);
  assert.equal(reconciled[0].id, "archive-record-91");
  assert.equal(reconciled[0].text, "canonical text");
});

test("assistant identity follows its native item across transport and canonical turns", () => {
  const live: ConversationRecord = {
    id: "web-assistant-random",
    itemId: "item-7",
    type: "assistant",
    threadId: "thread-1",
    turnId: "turn-transport",
    text: "live",
  };
  const archived: ConversationRecord = {
    id: "claude:archive-id",
    itemId: "item-7",
    type: "assistant",
    threadId: "thread-1",
    turnId: "prompt-canonical",
    text: "archived",
    sourceKey: "claudecode|session.jsonl|14|assistant|assistant",
  };

  const expected = "assistant:thread-1:item-7";
  assert.equal(getConversationRenderId(live), expected);
  assert.equal(getConversationRenderId(archived), expected);
});

test("legacy identity uses sourceKey or record.id and never content", () => {
  const withSource: ConversationRecord = {
    id: "record-1",
    type: "assistant",
    threadId: "thread-legacy",
    text: "secret body",
    sourceKey: "claude|session|line-8|assistant",
  };
  const withId: ConversationRecord = {
    id: "record-2",
    type: "user",
    threadId: "thread-legacy",
    text: "another secret body",
  };

  assert.equal(getLegacyStableId(withSource), "claude|session|line-8|assistant");
  assert.equal(getLegacyStableId(withId), "record-2");
  assert.equal(getConversationRenderId(withSource).includes("secret body"), false);
  assert.equal(getConversationRenderId(withId).includes("another secret body"), false);
  assert.equal(createBubbleId(getConversationRenderId(withSource), "primary"),
    "legacy:assistant:thread-legacy:claude|session|line-8|assistant:bubble:primary");
});

test("settling a draft moves and updates the same logical message", () => {
  const draft = createWebChatDraftRecord({
    messageId: "message-2",
    text: "hello",
    receivedAt: "2026-07-17T00:00:00.000Z",
  }, "draft-thread");
  const settled = settleWebChatDrafts({ "draft-thread": [draft] }, {
    sourceThreadId: "draft-thread",
    targetThreadId: "thread-2",
    messageIds: ["message-2"],
    turnId: "turn-9",
    deliveryState: "sent",
  });

  assert.equal(settled["draft-thread"], undefined);
  assert.equal(settled["thread-2"].length, 1);
  assert.equal(getConversationRenderId(settled["thread-2"][0]), "user:message-2");
  assert.equal(settled["thread-2"][0].turnId, "turn-9");
  assert.equal(settled["thread-2"][0].meta?.deliveryState, "sent");
});

test("status snapshot advances a thread-scoped subscription cursor", () => {
  assert.equal(resolveThreadSubscriptionCursor(41, 52), 52);
  assert.equal(resolveThreadSubscriptionCursor(73, 52), 73);
});

test("protocol-v2 live records copy stable turn correlation into record metadata", () => {
  const live = createWebChatLiveRecord({
    protocolVersion: 2,
    kind: "message",
    threadId: "thread-1",
    turnId: "turn-transport-1",
    itemId: "claude:msg-native-1:0",
    requestId: "request-1",
    messageId: "message-1",
    logicalTurnId: "web:request-1",
    displayTurnId: "web:request-1",
    transportTurnId: "turn-transport-1",
    canonicalTurnId: "prompt-canonical-1",
    record: {
      id: "web-assistant-1",
      type: "assistant",
      text: "answer",
    },
  }, "thread-1");

  assert.equal(live.itemId, "claude:msg-native-1:0");
  assert.equal(live.meta?.requestId, "request-1");
  assert.equal(live.meta?.logicalTurnId, "web:request-1");
  assert.equal(live.meta?.displayTurnId, "web:request-1");
  assert.equal(live.meta?.transportTurnId, "turn-transport-1");
  assert.equal(live.meta?.canonicalTurnId, "prompt-canonical-1");
  assert.equal(live.meta?.webChatProtocolVersion, 2);
});

test("live and archived records reconcile without changing the logical mount key", () => {
  const live: ConversationRecord = {
    id: "web-assistant-item-1",
    itemId: "item-1",
    type: "assistant",
    threadId: "thread-1",
    turnId: "turn-transport-1",
    timestamp: "2026-07-17T00:00:02.000Z",
    text: "live text",
    meta: { itemId: "item-1", ephemeral: true, webChatLive: true },
  };
  const archived: ConversationRecord = {
    id: "archive-assistant-1",
    itemId: "item-1",
    sourceKey: "claudecode|session|9|assistant",
    type: "assistant",
    threadId: "thread-1",
    turnId: "prompt-canonical-1",
    timestamp: "2026-07-17T00:00:02.000Z",
    text: "canonical text",
    meta: { itemId: "item-1", sourceKey: "claudecode|session|9|assistant" },
  };
  const beforeKeys = new Set([getConversationRenderId(live)]);
  const reconciled = mergeConversationRecords([archived, live], "thread-1");
  const afterKeys = new Set(reconciled.map((record) => getConversationRenderId(record, "thread-1")));

  assert.equal(reconciled.length, 1);
  assert.deepEqual(afterKeys, beforeKeys);
  assert.equal(reconciled[0].id, "archive-assistant-1");
  assert.equal(reconciled[0].text, "canonical text");
  assert.equal(reconciled[0].meta?.webChatLive, undefined);
  assert.equal(reconciled[0].meta?.uiMergeKey, undefined);
});

test("legacy compatibility matching adopts itemId instead of content as identity", () => {
  const archivedLegacy: ConversationRecord = {
    id: "archive-legacy",
    sourceKey: "claudecode|session|10|assistant",
    type: "assistant",
    threadId: "thread-2",
    turnId: "turn-2",
    timestamp: "2026-07-17T00:00:02.000Z",
    text: "same text",
    meta: { sourceKey: "claudecode|session|10|assistant" },
  };
  const live: ConversationRecord = {
    id: "web-assistant-item-2",
    itemId: "item-2",
    type: "assistant",
    threadId: "thread-2",
    turnId: "turn-2",
    timestamp: "2026-07-17T00:00:02.100Z",
    text: "same text",
    meta: { itemId: "item-2", ephemeral: true },
  };
  const reconciled = mergeConversationRecords([archivedLegacy, live], "thread-2");

  assert.equal(reconciled.length, 1);
  assert.equal(getConversationRenderId(reconciled[0]), "assistant:thread-2:item-2");
  assert.equal(getConversationRenderId(reconciled[0]).includes("same text"), false);
});
