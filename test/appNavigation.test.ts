import test from "node:test";
import assert from "node:assert/strict";
import {
  UnknownWorkspaceError,
  createAppNavigation,
} from "../src/app/navigation/appNavigation";

test("App Navigation 只激活目标 Workspace 并转交类型明确的 Target", () => {
  const navigation = createAppNavigation("timeline");
  const target = {
    threadId: "thread-1",
    date: "2026.07.27",
    messageId: "message-1",
  };

  navigation.requestNavigation({
    workspace: "conversation",
    target,
  });

  assert.deepEqual(navigation.getSnapshot(), {
    workspace: "conversation",
    target,
    revision: 1,
  });
});

test("未知 Workspace 由 App Navigation 作为应用级错误拒绝", () => {
  const navigation = createAppNavigation("timeline");

  assert.throws(
    () =>
      navigation.requestNavigation({
        workspace: "unknown",
        target: {},
      } as never),
    UnknownWorkspaceError,
  );
  assert.equal(navigation.getSnapshot().workspace, "timeline");
});

test("只有目标 Workspace 能确认并清除当前 Navigation Target", () => {
  const navigation = createAppNavigation("timeline");
  navigation.requestNavigation({
    workspace: "conversation",
    target: {
      threadId: "thread-1",
      date: "2026.07.27",
    },
  });

  navigation.acknowledgeTarget("timeline", 1);
  assert.notEqual(navigation.getSnapshot().target, undefined);

  navigation.acknowledgeTarget("conversation", 1);
  assert.equal(navigation.getSnapshot().target, undefined);
  assert.equal(navigation.getSnapshot().revision, 1);
  assert.equal(navigation.getSnapshot().workspace, "conversation");
});
