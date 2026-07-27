import test from "node:test";
import assert from "node:assert/strict";
import {
  createContentSyncGeneration,
  createContentSyncStore,
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

test("ContentSync 发布只读 Snapshot，并以 Revision 标识成功提交", () => {
  const store = createContentSyncStore();
  const first = store.begin("conversation", "2026.07.27:thread-a");

  assert.equal(store.commit(first, (current) => ({
    ...current,
    conversationEntries: {
      ...current.conversationEntries,
      "2026.07.27": { "thread-a": [] },
    },
  })), true);

  const snapshot = store.getSnapshot();
  assert.equal(snapshot.revision, 1);
  assert.equal(snapshot.sources.conversation.status, "ready");
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.data), true);
});

test("ContentSync 丢弃过期结果，并保留最后一份有效 Snapshot", () => {
  const store = createContentSyncStore();
  const oldRequest = store.begin("timeline", "2026.07");
  const currentRequest = store.begin("timeline", "2026.07");

  assert.equal(store.commit(currentRequest, (current) => ({
    ...current,
    timelineState: {
      "2026.07.27": { events: [], marker: 2 },
    },
  })), true);
  assert.equal(store.commit(oldRequest, (current) => ({
    ...current,
    timelineState: {
      "2026.07.27": { events: [], marker: 1 },
    },
  })), false);
  assert.equal(
    store.getSnapshot().data.timelineState["2026.07.27"]?.marker,
    2,
  );
});

test("ContentSync 分离 Keyed Source Cache 与 Negative Source Cache", () => {
  const store = createContentSyncStore();
  const loaded = store.begin("diary", "2026.07.27");
  store.commitKeyedSource(loaded, {
    bucket: "diary",
    key: "2026.07.27",
    value: { title: "今天", excerpt: "", sections: [] },
  });

  const missing = store.begin("letters", "2026.07.26");
  store.commitMissingSource(missing, {
    bucket: "letters",
    key: "2026.07.26",
  });

  const snapshot = store.getSnapshot();
  assert.deepEqual(
    snapshot.data.searchCache.diary["2026.07.27"],
    { title: "今天", excerpt: "", sections: [] },
  );
  assert.equal(
    snapshot.negativeCache.letters["2026.07.26"],
    true,
  );
});

test("ContentSync 在 Snapshot 中发布文件连接状态", () => {
  const store = createContentSyncStore();
  assert.equal(store.getSnapshot().connectionStatus, "idle");
  store.setConnectionStatus("connecting");
  store.setConnectionStatus("connected");
  assert.equal(store.getSnapshot().connectionStatus, "connected");
});
