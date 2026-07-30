import assert from "node:assert/strict";
import test from "node:test";
import {
  getConversationSummaryActivityKey,
  isConversationThreadVisibleInList,
  type ConversationThreadProfile,
} from "../src/lib/conversationProfiles";
import type { ConversationRecord } from "../src/types/conversation";

function profile(
  changes: Partial<ConversationThreadProfile> = {},
): ConversationThreadProfile {
  return {
    name: "Thread",
    handle: "@thread",
    signature: "",
    avatar: "",
    background: "#fff",
    backgroundImage: "",
    backgroundPositionX: 50,
    backgroundPositionY: 50,
    group: "",
    pinned: false,
    thinkingFace: ">ᴗo ಣ >",
    listHidden: false,
    listHiddenThrough: "",
    ...changes,
  };
}

function summary(record: ConversationRecord) {
  return {
    threadId: "thread-1",
    latestDate: "2026.07.31",
    latestRecord: record,
    snippet: record.text || "",
    messageCount: 1,
  };
}

test("隐藏边界仍是最新稳定消息时列表保持不显示", () => {
  const current = summary({
    id: "record-1",
    type: "assistant",
    threadId: "thread-1",
    sourceKey: "source|stable",
    text: "old",
  });
  const boundary = getConversationSummaryActivityKey(current);

  assert.equal(
    isConversationThreadVisibleInList(
      profile({
        listHidden: true,
        listHiddenThrough: boundary,
      }),
      current,
    ),
    false,
  );
});

test("同一线程出现新的稳定消息后重新显示", () => {
  const hiddenProfile = profile({
    listHidden: true,
    listHiddenThrough:
      "legacy:assistant:thread-1:source|stable",
  });
  const current = summary({
    id: "record-2",
    type: "assistant",
    threadId: "thread-1",
    sourceKey: "source|new",
    text: "new",
  });

  assert.equal(
    isConversationThreadVisibleInList(hiddenProfile, current),
    true,
  );
});

test("显式重新导入相同消息身份不会越过不显示边界", () => {
  const restored = summary({
    id: "record-restored",
    type: "assistant",
    threadId: "thread-1",
    sourceKey: "source|stable",
    text: "restored old record",
  });
  const hiddenProfile = profile({
    listHidden: true,
    listHiddenThrough:
      getConversationSummaryActivityKey(restored),
  });

  assert.equal(
    isConversationThreadVisibleInList(hiddenProfile, restored),
    false,
  );
});
