import test from "node:test";
import assert from "node:assert/strict";
import { styleThemes } from "../src/config/theme";
import { emptyRemoteData } from "../src/data/emptyRemoteData";
import { buildMemoryPage } from "../src/lib/memoryPageData";
import { buildTimelinePage } from "../src/lib/timelinePageData";
import {
  buildXiaoyePage,
} from "../src/lib/memoryPageData";
import { createArchiveWorkspaceViewModelBuilder } from "../src/workspaces/archive";
import {
  applyTimelineMutationOverlay,
  createTimelineMutationOverlay,
  createTimelineWorkspaceViewModelBuilder,
  deleteTimelineEventFromOverlay,
  reconcileTimelineMutationOverlay,
  upsertTimelineEventInOverlay,
} from "../src/workspaces/timeline";
import {
  applyArchiveMutationOverlay,
  createArchiveMutationOverlay,
  reconcileArchiveMutationOverlay,
  saveArchiveEntryToOverlay,
} from "../src/workspaces/archive";
import { createBrowseDateFlow } from "../src/app/flows/browseDateFlow";

const buildArchiveWorkspaceViewModel =
  createArchiveWorkspaceViewModelBuilder(
    buildMemoryPage,
    buildXiaoyePage,
  );
const buildTimelineWorkspaceViewModel =
  createTimelineWorkspaceViewModelBuilder(buildTimelinePage);

test("Timeline Workspace View Model 保持现有页面推导结果", () => {
  const theme = styleThemes[0];
  const date = "2026.07.27";

  assert.deepEqual(
    buildTimelineWorkspaceViewModel(theme, date, emptyRemoteData),
    buildTimelinePage(theme, date, emptyRemoteData),
  );
});

test("Archive Workspace View Model 保持现有页面推导结果", () => {
  const theme = styleThemes[0];
  const date = "2026.07.27";

  assert.deepEqual(
    buildArchiveWorkspaceViewModel({
      theme,
      date,
      mode: "Diary",
      subject: "Me",
      xiaoyeMode: "Ins",
      remoteData: emptyRemoteData,
    }),
    buildMemoryPage(theme, date, "Diary", emptyRemoteData),
  );
});

test("Timeline Mutation Overlay 生成有效状态但不修改 ContentSync Snapshot", () => {
  const canonical = {
    "2026.07.27": {
      status: "ready",
      events: [
        {
          id: "event-1",
          startAt: "09:00",
          endAt: "10:00",
          title: "旧标题",
        },
      ],
    },
  };
  let overlay = createTimelineMutationOverlay();
  overlay = upsertTimelineEventInOverlay(overlay, {
    date: "2026.07.27",
    event: {
      id: "event-1",
      startAt: "09:00",
      endAt: "10:00",
      title: "新标题",
    },
    baseRevision: 2,
  });
  overlay = deleteTimelineEventFromOverlay(overlay, {
    date: "2026.07.27",
    eventId: "event-1",
    baseRevision: 2,
  });

  const effective = applyTimelineMutationOverlay(
    canonical,
    overlay,
  );

  assert.equal(canonical["2026.07.27"].events[0]?.title, "旧标题");
  assert.deepEqual(effective["2026.07.27"]?.events, []);
});

test("Archive Mutation Overlay 只覆盖对应文档的有效来源数据", () => {
  const overlay = saveArchiveEntryToOverlay(
    createArchiveMutationOverlay(),
    {
      document: {
        documentType: "dated-memory-document",
        documentId: "diary",
        date: "2026-07-27",
      },
      entry: {
        title: "新日记",
        excerpt: "内容",
        sections: [],
      },
      baseRevision: 4,
    },
  );
  const effective = applyArchiveMutationOverlay(
    emptyRemoteData,
    overlay,
  );

  assert.equal(
    emptyRemoteData.diaryEntries["2026.07.27"],
    undefined,
  );
  assert.equal(
    effective.diaryEntries["2026.07.27"]?.title,
    "新日记",
  );
  assert.equal(effective.timelineState, emptyRemoteData.timelineState);
});

test("Timeline 与 Archive 的既有共享浏览日期由显式 Application Flow 保持", () => {
  const opened: string[] = [];
  const flow = createBrowseDateFlow({
    timeline: {
      openDate: (date) => opened.push(`timeline:${date}`),
    },
    archive: {
      openDate: (date) => opened.push(`archive:${date}`),
    },
  });

  flow.openDate("2026.07.27");

  assert.deepEqual(opened, [
    "timeline:2026.07.27",
    "archive:2026.07.27",
  ]);
});

test("Canonical Snapshot 只在确认相同领域结果后清除 Overlay", () => {
  const timelineOverlay = upsertTimelineEventInOverlay(
    createTimelineMutationOverlay(),
    {
      date: "2026.07.27",
      event: {
        id: "event-1",
        startAt: "09:00",
        endAt: "10:00",
        title: "新标题",
      },
      baseRevision: 2,
    },
  );
  const staleTimeline = reconcileTimelineMutationOverlay(
    timelineOverlay,
    {
      "2026.07.27": {
        events: [
          {
            id: "event-1",
            startAt: "09:00",
            endAt: "10:00",
            title: "旧标题",
          },
        ],
      },
    },
    3,
  );
  const confirmedTimeline = reconcileTimelineMutationOverlay(
    timelineOverlay,
    {
      "2026.07.27": {
        events: [
          {
            id: "event-1",
            startAt: "09:00",
            endAt: "10:00",
            title: "新标题",
          },
        ],
      },
    },
    3,
  );

  assert.equal(staleTimeline, timelineOverlay);
  assert.deepEqual(confirmedTimeline.upserts, {});

  const archiveOverlay = saveArchiveEntryToOverlay(
    createArchiveMutationOverlay(),
    {
      document: {
        documentType: "dated-memory-document",
        documentId: "diary",
        date: "2026-07-27",
      },
      entry: {
        title: "新日记",
        excerpt: "内容",
        sections: [],
      },
      baseRevision: 4,
    },
  );
  const confirmedArchive = reconcileArchiveMutationOverlay(
    archiveOverlay,
    {
      ...emptyRemoteData,
      diaryEntries: {
        "2026.07.27": {
          title: "新日记",
          excerpt: "内容",
          sections: [],
        },
      },
    },
    5,
  );

  assert.deepEqual(confirmedArchive.entries, {});
});
