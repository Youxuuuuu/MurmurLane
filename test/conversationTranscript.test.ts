import test from "node:test";
import assert from "node:assert/strict";
import {
  buildConversationTranscript,
  selectConversationTranscriptWindow,
} from "../src/workspaces/conversation";
import type { ConversationRecord } from "../src/types/conversation";

test("Transcript 用 Canonical Record 替换 Live Record，并保留稳定展示语义", () => {
  const canonicalRecords: ConversationRecord[] = [
    {
      id: "user-1",
      messageId: "message-1",
      type: "user",
      threadId: "thread-1",
      turnId: "turn-user-1",
      timestamp: "2026-07-27T01:00:00.000Z",
      text: "问题",
      sourceKey: "archive|user-1",
      meta: {
        messageId: "message-1",
        sourceKey: "archive|user-1",
      },
    },
    {
      id: "assistant-canonical",
      itemId: "item-1",
      type: "assistant",
      threadId: "thread-1",
      turnId: "turn-1",
      timestamp: "2026-07-27T01:00:02.000Z",
      text: "持久化回答",
      sourceKey: "archive|assistant-1",
      meta: {
        itemId: "item-1",
        sourceKey: "archive|assistant-1",
      },
    },
    {
      id: "runtime-exit-noise",
      type: "error",
      threadId: "thread-1",
      timestamp: "2026-07-27T01:00:03.000Z",
      text: "❌ Runtime process exited unexpectedly",
      meta: {
        runtimeEvent: "runtime.turn.failed",
      },
    },
  ];
  const liveRecords: ConversationRecord[] = [
    {
      id: "web-assistant-live",
      itemId: "item-1",
      type: "assistant",
      threadId: "thread-1",
      turnId: "turn-1",
      timestamp: "2026-07-27T01:00:02.000Z",
      text: "实时回答",
      meta: {
        itemId: "item-1",
        ephemeral: true,
        webChatLive: true,
      },
    },
  ];

  const transcript = buildConversationTranscript({
    canonicalRecords,
    liveRecords,
    threadId: "thread-1",
  });
  const transcriptWindow = selectConversationTranscriptWindow(
    transcript,
    { start: 0, end: transcript.records.length },
  );

  assert.deepEqual(
    {
      recordIds: transcript.records.map((record) => record.id),
      recordTexts: transcript.records.map((record) => record.text),
      renderIds: transcript.recordRenderIds,
      displayItems: transcriptWindow.displayItems.map((item) => ({
        kind: item.kind,
        renderId: item.renderId,
        entryIds: item.kind === "assistant-turn"
          ? item.entries.map((entry) => entry.record.id)
          : [item.entry.record.id],
      })),
    },
    {
      recordIds: ["user-1", "assistant-canonical"],
      recordTexts: ["问题", "持久化回答"],
      renderIds: [
        "user:message-1",
        "assistant:thread-1:item-1",
      ],
      displayItems: [
        {
          kind: "record",
          renderId: "user:message-1",
          entryIds: ["user-1"],
        },
        {
          kind: "assistant-turn",
          renderId: "assistant-turn:thread-1:turn-1:date:2026.07.27",
          entryIds: ["assistant-canonical"],
        },
      ],
    },
  );
});

test("Transcript 保持 Source Order，并合并同一分钟内的连续图片", () => {
  const canonicalRecords: ConversationRecord[] = [
    {
      id: "file-operation",
      type: "operation",
      threadId: "thread-1",
      turnId: "turn-1",
      timestamp: "2026-07-27T02:00:00.000Z",
      text: "读取文件",
      sourceKey: "archive|operation",
      source: {
        sourceFile: "session.jsonl",
        sourceLine: 20,
        sourceOrder: 0,
      },
    },
    {
      id: "file-result",
      itemId: "file-item",
      type: "assistant",
      threadId: "thread-1",
      turnId: "turn-1",
      timestamp: "2026-07-27T02:00:00.000Z",
      sourceKey: "archive|file",
      source: {
        sourceFile: "session.jsonl",
        sourceLine: 20,
        sourceOrder: 1,
      },
      meta: {
        itemId: "file-item",
        files: [{ kind: "file", fileName: "report.txt" }],
      },
    },
    {
      id: "image-1",
      messageId: "image-message-1",
      type: "user",
      threadId: "thread-1",
      timestamp: "2026-07-27T02:01:10.000Z",
      sourceKey: "archive|image-1",
      meta: {
        messageId: "image-message-1",
        attachments: [{ kind: "image", fileName: "first.jpg" }],
      },
    },
    {
      id: "image-2",
      messageId: "image-message-2",
      type: "user",
      threadId: "thread-1",
      timestamp: "2026-07-27T02:01:40.000Z",
      sourceKey: "archive|image-2",
      meta: {
        messageId: "image-message-2",
        attachments: [{ kind: "image", fileName: "second.jpg" }],
      },
    },
  ];

  const transcript = buildConversationTranscript({
    canonicalRecords,
    threadId: "thread-1",
  });
  const transcriptWindow = selectConversationTranscriptWindow(
    transcript,
    { start: 0, end: transcript.records.length },
  );
  const imageGroup = transcript.records[2];

  assert.deepEqual(
    {
      recordIds: transcript.records.map((record) => record.id),
      imageGroupIds: imageGroup.imageGroupIds,
      imageGroupCount: imageGroup.imageGroupCount,
      imageFiles: Array.isArray(imageGroup.meta?.attachments)
        ? imageGroup.meta.attachments.map((item) => item.fileName)
        : [],
      displayItems: transcriptWindow.displayItems.map((item) => ({
        kind: item.kind,
        renderId: item.renderId,
      })),
    },
    {
      recordIds: ["file-operation", "file-result", "image-1"],
      imageGroupIds: ["image-1", "image-2"],
      imageGroupCount: 2,
      imageFiles: ["first.jpg", "second.jpg"],
      displayItems: [
        {
          kind: "assistant-turn",
          renderId: "assistant-turn:thread-1:turn-1:date:2026.07.27",
        },
        {
          kind: "record",
          renderId: "user:image-message-1",
        },
      ],
    },
  );
});

test("Transcript 对相同输入产生相同内容、顺序和身份", () => {
  const canonicalRecords: ConversationRecord[] = [
    {
      id: "user-stable",
      messageId: "message-stable",
      type: "user",
      threadId: "thread-stable",
      timestamp: "2026-07-27T03:00:00.000Z",
      text: "保持稳定",
      sourceKey: "archive|stable",
      meta: {
        messageId: "message-stable",
        sourceKey: "archive|stable",
      },
    },
  ];

  const first = buildConversationTranscript({
    canonicalRecords,
    threadId: "thread-stable",
  });
  const second = buildConversationTranscript({
    canonicalRecords,
    threadId: "thread-stable",
  });

  assert.deepEqual(second, first);
});

test("Transcript 窗口会扩展到完整 Assistant Turn，再生成窗口展示条目", () => {
  const transcript = buildConversationTranscript({
    canonicalRecords: [
      {
        id: "user-before",
        messageId: "message-before",
        type: "user",
        threadId: "thread-window",
        timestamp: "2026-07-27T04:00:00.000Z",
        text: "开始",
      },
      {
        id: "thinking-window",
        type: "thinking",
        threadId: "thread-window",
        turnId: "turn-window",
        timestamp: "2026-07-27T04:00:01.000Z",
        text: "思考",
      },
      {
        id: "assistant-window",
        itemId: "item-window",
        type: "assistant",
        threadId: "thread-window",
        turnId: "turn-window",
        timestamp: "2026-07-27T04:00:02.000Z",
        text: "回答",
      },
      {
        id: "user-after",
        messageId: "message-after",
        type: "user",
        threadId: "thread-window",
        timestamp: "2026-07-27T04:00:03.000Z",
        text: "结束",
      },
    ],
    threadId: "thread-window",
  });

  const window = selectConversationTranscriptWindow(
    transcript,
    { start: 2, end: 3 },
  );

  assert.deepEqual(
    {
      range: window.range,
      recordIds: window.records.map((record) => record.id),
      displayItems: window.displayItems.map((item) => ({
        kind: item.kind,
        renderId: item.renderId,
        entryIds: item.kind === "assistant-turn"
          ? item.entries.map((entry) => entry.record.id)
          : [item.entry.record.id],
      })),
    },
    {
      range: { start: 1, end: 3 },
      recordIds: ["thinking-window", "assistant-window"],
      displayItems: [
        {
          kind: "assistant-turn",
          renderId:
            "assistant-turn:thread-window:turn-window:date:2026.07.27",
          entryIds: ["thinking-window", "assistant-window"],
        },
      ],
    },
  );
});
