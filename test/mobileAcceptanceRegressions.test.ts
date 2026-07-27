import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  consumeArchiveNavigationTarget,
} from "../src/workspaces/archive/archiveNavigationTarget";
import {
  consumeTimelineNavigationTarget,
} from "../src/workspaces/timeline/timelineNavigationTarget";

const conversationPageSource = readFileSync(
  new URL(
    "../src/components/conversation/ConversationPage.tsx",
    import.meta.url,
  ),
  "utf8",
);
const conversationComposerSource = readFileSync(
  new URL(
    "../src/components/conversation/ConversationComposer.tsx",
    import.meta.url,
  ),
  "utf8",
);

test("搜索高亮展示完成后只消费对应 Workspace 的当前目标", () => {
  const timelineTarget = {
    mode: "Timeline" as const,
    date: "2026-06-15",
    targetId: "event-1",
    query: "整理",
  };
  const archiveTarget = {
    mode: "Diary",
    date: "2026-06-15",
    targetId: "diary-1",
    query: "星光",
  };

  assert.equal(
    consumeTimelineNavigationTarget(
      timelineTarget,
      "event-1",
    ),
    null,
  );
  assert.equal(
    consumeArchiveNavigationTarget(
      archiveTarget,
      "diary-1",
    ),
    null,
  );
});

test("迟到的高亮完成回调不得清除后来到达的新目标", () => {
  const nextTimelineTarget = {
    mode: "Timeline" as const,
    date: "2026-06-16",
    targetId: "event-2",
    query: "复盘",
  };
  const nextArchiveTarget = {
    mode: "Letters",
    date: "2026-06-16",
    targetId: "letter-2",
    query: "晚安",
  };

  assert.equal(
    consumeTimelineNavigationTarget(
      nextTimelineTarget,
      "event-1",
    ),
    nextTimelineTarget,
  );
  assert.equal(
    consumeArchiveNavigationTarget(
      nextArchiveTarget,
      "diary-1",
    ),
    nextArchiveTarget,
  );
});

test("新消息按钮始终位于实际 Composer 高度与键盘位移之上", () => {
  assert.match(
    conversationComposerSource,
    /--conversation-composer-height/u,
  );
  assert.match(
    conversationComposerSource,
    /ResizeObserver/u,
  );
  assert.match(
    conversationPageSource,
    /var\(--conversation-composer-height,\s*\d+px\)/u,
  );
  assert.match(
    conversationPageSource,
    /var\(--app-keyboard-inset,\s*0px\)/u,
  );
  assert.doesNotMatch(
    conversationPageSource,
    /className="absolute bottom-4 left-1\/2 z-30/u,
  );
});
