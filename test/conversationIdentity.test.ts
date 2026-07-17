import test from "node:test";
import assert from "node:assert/strict";
import {
  createBubbleId,
  getConversationRenderId,
  getLegacyStableId,
  upsertConversationRecordByIdentity,
} from "../src/lib/conversationIdentity";
import {
  createWebChatDraftRecord,
  settleWebChatDrafts,
} from "../src/lib/webChatRecords";
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

test("assistant identity is item-scoped inside its turn", () => {
  const live: ConversationRecord = {
    id: "web-assistant-random",
    itemId: "item-7",
    type: "assistant",
    threadId: "thread-1",
    turnId: "turn-2",
    text: "live",
  };
  const archived: ConversationRecord = {
    id: "claude:archive-id",
    itemId: "item-7",
    type: "assistant",
    threadId: "thread-1",
    turnId: "turn-2",
    text: "archived",
    sourceKey: "claudecode|session.jsonl|14|assistant|assistant",
  };

  const expected = "assistant:thread-1:turn-2:item-7";
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
