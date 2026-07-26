import test from "node:test";
import assert from "node:assert/strict";
import {
  createContentSyncGeneration,
  createLiveUpdateCoordinator,
  type ContentChangeEvent,
} from "../src/content-sync";

test("ContentSync 按 Source 和 Key 独立判断读取结果是否仍有效", () => {
  const generation = createContentSyncGeneration();
  const conversationA1 = generation.begin("conversation", "2026.07.27:a");
  const timeline1 = generation.begin("timeline", "2026.07");
  const conversationA2 = generation.begin("conversation", "2026.07.27:a");

  assert.equal(generation.isCurrent(conversationA1), false);
  assert.equal(generation.isCurrent(conversationA2), true);
  assert.equal(generation.isCurrent(timeline1), true);
});

test("文件事件按真实身份去重，并在 220ms 批次中只刷新一次", async () => {
  const scheduled: Array<() => void> = [];
  const batches: ContentChangeEvent[][] = [];
  let listener: ((event: ContentChangeEvent) => void) | undefined;
  const coordinator = createLiveUpdateCoordinator({
    subscribe(onEvent) {
      listener = onEvent;
      return () => {
        listener = undefined;
      };
    },
    refresh(events) {
      batches.push(events);
      return Promise.resolve();
    },
    schedule(callback) {
      scheduled.push(callback);
      return callback;
    },
    cancelSchedule() {},
    isRefreshBlocked: () => false,
  });

  coordinator.start();
  listener?.({ type: "conversations", date: "2026-07-27" });
  listener?.({ type: "conversations", date: "2026-07-27" });
  listener?.({ type: "timeline" });
  assert.equal(scheduled.length, 3);

  await scheduled.at(-1)?.();

  assert.deepEqual(batches, [
    [
      { type: "conversations", date: "2026-07-27" },
      { type: "timeline" },
    ],
  ]);
  coordinator.stop();
});

test("页面隐藏时关闭订阅，恢复时发布 resync 并重新订阅", async () => {
  let subscriptionCount = 0;
  let unsubscribeCount = 0;
  const batches: ContentChangeEvent[][] = [];
  const scheduled: Array<() => void> = [];
  const coordinator = createLiveUpdateCoordinator({
    subscribe() {
      subscriptionCount += 1;
      return () => {
        unsubscribeCount += 1;
      };
    },
    refresh(events) {
      batches.push(events);
      return Promise.resolve();
    },
    schedule(callback) {
      scheduled.push(callback);
      return callback;
    },
    cancelSchedule() {},
    isRefreshBlocked: () => false,
  });

  coordinator.start();
  coordinator.setVisible(false);
  coordinator.setVisible(true);
  await scheduled.at(-1)?.();

  assert.equal(subscriptionCount, 2);
  assert.equal(unsubscribeCount, 1);
  assert.equal(batches[0]?.[0]?.type, "resync");
  coordinator.stop();
});
