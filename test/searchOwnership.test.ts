import test from "node:test";
import assert from "node:assert/strict";
import { emptyRemoteData } from "../src/data/emptyRemoteData";
import { buildSearchResultState } from "../src/lib/searchPageData";
import { resolveTimelineNavigationView } from "../src/workspaces/timeline";

test("Timeline 搜索结果不包含 Conversation 或 Archive 内容", () => {
  const state = buildSearchResultState("2026", emptyRemoteData, {
    workspaceScope: "timeline",
  });

  assert.equal(
    state.results.every((result) => result.mode === "Timeline"),
    true,
  );
});

test("Archive 搜索结果不包含 Conversation 或 Timeline 内容", () => {
  const state = buildSearchResultState("2026", emptyRemoteData, {
    workspaceScope: "archive",
  });

  assert.equal(
    state.results.every(
      (result) =>
        result.mode !== "Conversation" &&
        result.mode !== "Timeline",
    ),
    true,
  );
});

test("Reminder 属于 Timeline 搜索并打开现有 reminders 视图", () => {
  const remoteData = {
    ...emptyRemoteData,
    reminderHistoryEntries: [
      {
        archivedAt: "2026-07-27T08:00:00.000Z",
        reminder: {
          id: "reminder-1",
          text: "复查架构",
          createdAt: "2026-07-27T08:00:00.000Z",
        },
      },
    ],
  };
  const timeline = buildSearchResultState(
    "复查架构",
    remoteData,
    {
      workspaceScope: "timeline",
    },
  );
  const archive = buildSearchResultState(
    "复查架构",
    remoteData,
    {
      workspaceScope: "archive",
    },
  );

  assert.equal(timeline.results[0]?.mode, "Timeline");
  assert.equal(
    timeline.results[0]?.timelineView,
    "reminders",
  );
  assert.equal(
    resolveTimelineNavigationView(
      timeline.results[0]?.timelineView,
    ),
    "reminders",
  );
  assert.equal(archive.results.length, 0);
});
