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
import { createTimelineWorkspaceViewModelBuilder } from "../src/workspaces/timeline";

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
