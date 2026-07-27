import test from "node:test";
import assert from "node:assert/strict";
import {
  createConversationWorkspaceOutput,
  createConversationWorkspaceState,
  reduceConversationWorkspaceState,
} from "../src/workspaces/conversation";

test("Conversation Workspace 只通过 View Model 与 Commands 暴露页面契约", () => {
  const viewModel = {
    messages: [{ id: "message-1" }],
    connection: "open",
  };
  const commands = {
    sendMessages: () => "submitted",
  };

  const output = createConversationWorkspaceOutput(
    viewModel,
    commands,
  );

  assert.equal(output.viewModel, viewModel);
  assert.equal(output.commands, commands);
  assert.equal(Object.isFrozen(output), true);
  assert.deepEqual(Object.keys(output).sort(), [
    "commands",
    "viewModel",
  ]);
  assert.equal("adapter" in output, false);
  assert.equal("setState" in output, false);
});

test("Conversation Workspace 选择线程时清除该线程未读与通知", () => {
  const initial = {
    ...createConversationWorkspaceState({
      threadId: "thread-a",
      date: "2026.07.27",
    }),
    unreadCounts: { "thread-b": 2 },
    notificationQueue: [
      {
        threadId: "thread-b",
        date: "2026.07.27",
        name: "B",
        avatar: "",
        message: "新消息",
        count: 2,
        version: 1,
      },
    ],
  };
  const selected = reduceConversationWorkspaceState(initial, {
    type: "select-thread",
    threadId: "thread-b",
  });

  assert.equal(selected.selectedThreadId, "thread-b");
  assert.equal(selected.unreadCounts["thread-b"], 0);
  assert.deepEqual(selected.notificationQueue, []);
});

test("Conversation Workspace 将 Draft Thread 原子迁移为真实 Thread", () => {
  const profile = {
    name: "新聊天",
    handle: "@new-chat",
    signature: "",
    avatar: "",
    background: "#fff",
    backgroundImage: "",
    backgroundPositionX: 50,
    backgroundPositionY: 50,
    group: "",
    pinned: false,
    thinkingFace: "",
  };
  const draft = reduceConversationWorkspaceState(
    createConversationWorkspaceState({
      threadId: "thread-a",
      date: "2026.07.27",
    }),
    {
      type: "create-draft",
      threadId: "draft-1",
      date: "2026.07.27",
      profile,
    },
  );
  const settled = reduceConversationWorkspaceState(draft, {
    type: "settle-draft",
    draftThreadId: "draft-1",
    threadId: "thread-real",
    date: "2026.07.27",
    profile,
  });

  assert.equal(settled.selectedThreadId, "thread-real");
  assert.deepEqual(settled.webThreadIds, ["thread-real"]);
  assert.equal("draft-1" in settled.webThreadProfileOverrides, false);
  assert.equal(settled.webThreadProfileOverrides["thread-real"], profile);
});

test("Conversation Workspace 在页面内只累计未读，不错误创建全局通知", () => {
  const initial = createConversationWorkspaceState({
    threadId: "thread-a",
    date: "2026.07.27",
  });
  const received = reduceConversationWorkspaceState(initial, {
    type: "receive-notification",
    enqueue: false,
    notification: {
      threadId: "thread-b",
      date: "2026.07.27",
      name: "B",
      avatar: "",
      message: "新消息",
      count: 2,
      version: 1,
    },
  });

  assert.equal(received.unreadCounts["thread-b"], 2);
  assert.deepEqual(received.notificationQueue, []);
});
