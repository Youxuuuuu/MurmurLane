import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAssistantTurnDisplayModel,
  expandRangeToAssistantTurnBoundaries,
} from "../src/lib/assistantTurnModel";
import type { ConversationRecord } from "../src/types/conversation";

function record(
  id: string,
  type: string,
  turnId: string,
  text: string,
): ConversationRecord {
  return {
    id,
    type,
    threadId: "thread-1",
    turnId,
    text,
    sourceKey: `source|${id}`,
    meta: { sourceKey: `source|${id}` },
  };
}

test("thinking-only and completed states retain one AssistantTurn identity", () => {
  const thinkingOne = record("thinking-1", "thinking", "turn-1", "first thought");
  const thinkingTwo = record("thinking-2", "thinking", "turn-1", "second thought");
  const initial = buildAssistantTurnDisplayModel([thinkingOne], "thread-1");
  const completed = buildAssistantTurnDisplayModel([
    thinkingOne,
    thinkingTwo,
    {
      ...record("assistant-1", "assistant", "turn-1", "answer"),
      itemId: "item-1",
      meta: { itemId: "item-1", sourceKey: "source|assistant-1" },
    },
  ], "thread-1");

  assert.equal(initial.length, 1);
  assert.equal(initial[0].kind, "assistant-turn");
  assert.equal(completed.length, 1);
  assert.equal(completed[0].kind, "assistant-turn");
  if (initial[0].kind !== "assistant-turn" || completed[0].kind !== "assistant-turn") return;
  assert.equal(initial[0].renderId, "assistant-turn:thread-1:turn-1");
  assert.equal(completed[0].renderId, initial[0].renderId);
  assert.equal(completed[0].thinkingPanelId, initial[0].thinkingPanelId);
  assert.deepEqual(
    completed[0].thinkingRecords.map((item) => item.id),
    ["thinking-1", "thinking-2"],
  );
  assert.equal(completed[0].entries.length, 3);
});

test("transport and canonical records share one display turn without a mount-key change", () => {
  const thinking: ConversationRecord = {
    ...record("thinking-correlated", "thinking", "prompt-canonical", "thought"),
    meta: {
      sourceKey: "source|thinking-correlated",
      logicalTurnId: "web:request-1",
      displayTurnId: "web:request-1",
      transportTurnId: "turn-transport",
      canonicalTurnId: "prompt-canonical",
    },
  };
  const liveAssistant: ConversationRecord = {
    ...record("assistant-live", "assistant", "turn-transport", "answer"),
    itemId: "claude:msg-native:0",
    meta: {
      itemId: "claude:msg-native:0",
      logicalTurnId: "web:request-1",
      displayTurnId: "web:request-1",
      transportTurnId: "turn-transport",
    },
  };
  const canonicalAssistant: ConversationRecord = {
    ...record("assistant-canonical", "assistant", "prompt-canonical", "answer"),
    itemId: "claude:msg-native:0",
    meta: {
      itemId: "claude:msg-native:0",
      sourceKey: "source|assistant-canonical",
      logicalTurnId: "web:request-1",
      displayTurnId: "web:request-1",
      transportTurnId: "turn-transport",
      canonicalTurnId: "prompt-canonical",
    },
  };

  const before = buildAssistantTurnDisplayModel([thinking, liveAssistant], "thread-1");
  const after = buildAssistantTurnDisplayModel([thinking, canonicalAssistant], "thread-1");
  assert.equal(before.length, 1);
  assert.equal(after.length, 1);
  assert.equal(before[0].renderId, "assistant-turn:thread-1:web:request-1");
  assert.equal(after[0].renderId, before[0].renderId);
  assert.equal(
    before[0].kind === "assistant-turn" ? before[0].thinkingPanelId : "",
    after[0].kind === "assistant-turn" ? after[0].thinkingPanelId : "",
  );
});

test("turn model keeps operations and assistant records in source order", () => {
  const records = [
    record("thinking-1", "thinking", "turn-1", "thought"),
    record("operation-1", "operation", "turn-1", "Read file"),
    { ...record("assistant-1", "assistant", "turn-1", "answer"), itemId: "item-1" },
  ];
  const [turn] = buildAssistantTurnDisplayModel(records, "thread-1");
  assert.equal(turn.kind, "assistant-turn");
  if (turn.kind !== "assistant-turn") return;
  assert.deepEqual(turn.entries.map((entry) => entry.record.id), [
    "thinking-1",
    "operation-1",
    "assistant-1",
  ]);
});

test("records without turnId stay independent legacy display items", () => {
  const legacyThinking = record("thinking-legacy", "thinking", "", "legacy thought");
  const legacyAssistant = record("assistant-legacy", "assistant", "", "legacy answer");
  const items = buildAssistantTurnDisplayModel(
    [legacyThinking, legacyAssistant],
    "thread-1",
  );
  assert.deepEqual(items.map((item) => item.kind), ["record", "record"]);
  assert.notEqual(items[0].renderId, items[1].renderId);
});

test("virtual range expands to include the complete AssistantTurn", () => {
  const records = [
    record("user-1", "user", "turn-user", "question"),
    record("thinking-1", "thinking", "turn-1", "thought"),
    record("operation-1", "operation", "turn-1", "Read file"),
    { ...record("assistant-1", "assistant", "turn-1", "answer"), itemId: "item-1" },
    record("user-2", "user", "turn-user-2", "next"),
  ];
  assert.deepEqual(
    expandRangeToAssistantTurnBoundaries(records, { start: 2, end: 3 }, "thread-1"),
    { start: 1, end: 4 },
  );
});
