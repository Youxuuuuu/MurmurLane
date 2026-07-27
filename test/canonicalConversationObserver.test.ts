import assert from "node:assert/strict";
import test from "node:test";
import {
  createCanonicalConversationObserver,
} from "../src/workspaces/conversation";
import type { ConversationRecord } from "../src/types/conversation";

function assistantRecord(
  id: string,
  text = "新回复",
): ConversationRecord {
  return {
    id,
    type: "assistant",
    role: "assistant",
    text,
    timestamp: "2026-07-27T10:00:00.000Z",
    threadId: "thread-b",
  };
}

const context = {
  active: false,
  pageMode: "chat",
  selectedThreadId: "thread-a",
  threadProfiles: {},
  now: 42,
};

test("Conversation Workspace 首次同步和补载不会产生未读通知", () => {
  const observer = createCanonicalConversationObserver();
  assert.deepEqual(
    observer.observe(
      [{ date: "2026.07.27", records: [assistantRecord("one")] }],
      "baseline",
      context,
    ),
    [],
  );
  assert.deepEqual(
    observer.observe(
      [{ date: "2026.07.26", records: [assistantRecord("older")] }],
      "cache-fill",
      context,
    ),
    [],
  );
  assert.deepEqual(
    observer.observe(
      [{ date: "2026.07.27", records: [assistantRecord("one")] }],
      "background-refresh",
      context,
    ),
    [],
  );
});

test("Conversation Workspace 在基线后的文件刷新中识别新 Canonical 消息", () => {
  const observer = createCanonicalConversationObserver();
  observer.observe(
    [{ date: "2026.07.27", records: [assistantRecord("one")] }],
    "baseline",
    context,
  );
  observer.observe(
    [{ date: "2026.07.27", records: [assistantRecord("one")] }],
    "background-refresh",
    context,
  );

  const notifications = observer.observe(
    [
      {
        date: "2026.07.27",
        records: [
          assistantRecord("one"),
          assistantRecord("two", "第二条回复"),
        ],
      },
    ],
    "background-refresh",
    context,
  );

  assert.equal(notifications.length, 1);
  assert.deepEqual(notifications[0], {
    notification: {
      threadId: "thread-b",
      date: "2026.07.27",
      name: "对话 thread",
      avatar: "",
      message: "第二条回复",
      count: 1,
      version: 42,
    },
    enqueue: true,
  });
});

test("Conversation Workspace 不为当前正在查看的线程产生通知", () => {
  const observer = createCanonicalConversationObserver();
  observer.observe(
    [{ date: "2026.07.27", records: [assistantRecord("one")] }],
    "baseline",
    context,
  );
  observer.observe(
    [{ date: "2026.07.27", records: [assistantRecord("one")] }],
    "background-refresh",
    context,
  );

  assert.deepEqual(
    observer.observe(
      [
        {
          date: "2026.07.27",
          records: [
            assistantRecord("one"),
            assistantRecord("two"),
          ],
        },
      ],
      "background-refresh",
      {
        ...context,
        active: true,
        selectedThreadId: "thread-b",
      },
    ),
    [],
  );
});
