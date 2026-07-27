import assert from "node:assert/strict";
import test from "node:test";
import {
  TimelineCommandError,
  toTimelineCommandError,
} from "../src/workspaces/timeline";
import {
  ArchiveCommandError,
  toArchiveCommandError,
} from "../src/workspaces/archive";

test("Workspace 错误不向 View 暴露 Adapter 原始诊断信息", () => {
  const sensitive =
    "Bearer secret-token D:\\private\\data.json stack trace";
  const timelineError = toTimelineCommandError("save");
  const archiveError = toArchiveCommandError("load");

  assert.ok(timelineError instanceof TimelineCommandError);
  assert.ok(archiveError instanceof ArchiveCommandError);
  assert.equal(timelineError.operation, "save");
  assert.equal(archiveError.operation, "load");
  assert.equal(timelineError.message.includes(sensitive), false);
  assert.equal(archiveError.message.includes(sensitive), false);
  assert.equal("cause" in timelineError, false);
  assert.equal("bodyText" in archiveError, false);
});
