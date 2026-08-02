import assert from "node:assert/strict";
import test from "node:test";
import {
  absorbConversationRuntimeStatus,
  createConversationRuntimeState,
  isConversationRuntimeEvent,
  reduceConversationRuntimeEvent,
  selectConversationRuntimeThread,
} from "../src/workspaces/conversation/runtime/conversationRuntimeState";

test("Conversation Runtime 从 Status Snapshot 吸收当前 Thread 的设置与 Usage", () => {
  const state = absorbConversationRuntimeStatus(
    createConversationRuntimeState(),
    {
      threadId: "thread-a",
      contextUsage: {
        currentTokens: 320,
        contextWindow: 8_000,
      },
      usageTotals: {
        inputTokens: 1_200,
        outputTokens: 80,
        cacheReadInputTokens: 300,
        totalTokens: 1_280,
        cacheHitRate: 0.25,
      },
      runtimeSettings: {
        runtime: "claudecode",
        currentModel: "model-a",
        currentModelProvider: "provider-a",
        currentEffort: "high",
        models: [{ id: "model-a", provider: "provider-a" }],
        effort: {
          supported: true,
          options: ["low", "high"],
          defaultEffort: "low",
        },
      },
    },
    "thread-a",
  );

  assert.deepEqual(selectConversationRuntimeThread(state, "thread-a"), {
    contextUsage: {
      currentTokens: 320,
      contextWindow: 8_000,
    },
    usageTotals: {
      inputTokens: 1_200,
      outputTokens: 80,
      cacheReadInputTokens: 300,
      totalTokens: 1_280,
      cacheHitRate: 0.25,
    },
  });
  assert.equal(state.model, "model-a");
  assert.equal(state.modelProvider, "provider-a");
  assert.equal(state.effort, "high");
  assert.equal(state.models?.currentEffort, "high");
});

test("Conversation Runtime 仅把 model.updated 作为旧设置事件兼容", () => {
  const settings = {
    runtime: "claudecode",
    currentModel: "model-old",
    currentModelProvider: "provider-old",
    currentEffort: "low",
    models: [{ id: "model-old" }, { id: "model-new" }],
    effort: {
      supported: true,
      options: ["low", "high"],
      defaultEffort: "low",
    },
  };
  const initial = absorbConversationRuntimeStatus(
    createConversationRuntimeState(),
    { runtimeSettings: settings },
  );
  const updated = reduceConversationRuntimeEvent(
    initial,
    {
      kind: "model.updated",
      model: "model-new",
      modelProvider: "provider-new",
      effort: "high",
      settings: {
        ...settings,
        currentModel: "model-new",
        currentModelProvider: "provider-new",
        currentEffort: "high",
      },
    },
    "thread-a",
  );

  assert.equal(isConversationRuntimeEvent({ kind: "model.updated" }), true);
  assert.equal(isConversationRuntimeEvent({ kind: "turn.started" }), false);
  assert.equal(updated.model, "model-new");
  assert.equal(updated.modelProvider, "provider-new");
  assert.equal(updated.effort, "high");
  assert.equal(updated.models?.runtime, "claudecode");
  assert.equal(updated.models?.currentModel, "model-new");
});

test("Conversation Runtime 的 Usage SSE 按 Thread 隔离且不改写其他 Thread 的 Context", () => {
  const initial = absorbConversationRuntimeStatus(
    createConversationRuntimeState(),
    {
      threadId: "thread-a",
      contextUsage: { currentTokens: 100 },
      usageTotals: {
        inputTokens: 100,
        outputTokens: 10,
        cacheReadInputTokens: 20,
        totalTokens: 110,
        cacheHitRate: 0.2,
      },
    },
  );
  const updated = reduceConversationRuntimeEvent(
    initial,
    {
      kind: "usage",
      threadId: "thread-b",
      contextUsage: { currentTokens: 900 },
      usageTotals: {
        inputTokens: 900,
        outputTokens: 90,
        cacheReadInputTokens: 450,
        totalTokens: 990,
        cacheHitRate: 0.5,
      },
    },
    "thread-a",
  );

  assert.deepEqual(selectConversationRuntimeThread(updated, "thread-a"), {
    contextUsage: { currentTokens: 100 },
    usageTotals: {
      inputTokens: 100,
      outputTokens: 10,
      cacheReadInputTokens: 20,
      totalTokens: 110,
      cacheHitRate: 0.2,
    },
  });
  assert.deepEqual(selectConversationRuntimeThread(updated, "thread-b"), {
    contextUsage: null,
    usageTotals: {
      inputTokens: 900,
      outputTokens: 90,
      cacheReadInputTokens: 450,
      totalTokens: 990,
      cacheHitRate: 0.5,
    },
  });
});

test("Conversation Runtime 的 Status Usage Snapshot 与 Usage SSE 产生相同结果", () => {
  const usageTotals = {
    inputTokens: 420,
    outputTokens: 30,
    cacheReadInputTokens: 210,
    totalTokens: 450,
    cacheHitRate: 0.5,
  };
  const contextUsage = {
    currentTokens: 260,
    contextWindow: 4_000,
  };
  const fromStatus = absorbConversationRuntimeStatus(
    createConversationRuntimeState(),
    { threadId: "thread-a", contextUsage, usageTotals },
  );
  const fromEvent = reduceConversationRuntimeEvent(
    createConversationRuntimeState(),
    {
      kind: "usage",
      threadId: "thread-a",
      contextUsage,
      usageTotals,
    },
    "thread-a",
  );

  assert.deepEqual(
    selectConversationRuntimeThread(fromStatus, "thread-a"),
    selectConversationRuntimeThread(fromEvent, "thread-a"),
  );
});

test("Conversation Runtime 用显式空 Usage Snapshot 清除对应 Thread 而不影响其他 Thread", () => {
  const totals = {
    inputTokens: 10,
    outputTokens: 2,
    cacheReadInputTokens: 5,
    totalTokens: 12,
    cacheHitRate: 0.5,
  };
  const withTwoThreads = absorbConversationRuntimeStatus(
    absorbConversationRuntimeStatus(
      createConversationRuntimeState(),
      { threadId: "thread-a", usageTotals: totals },
    ),
    { threadId: "thread-b", usageTotals: totals },
  );
  const cleared = absorbConversationRuntimeStatus(
    withTwoThreads,
    { threadId: "thread-a", usageTotals: null },
  );

  assert.equal(
    selectConversationRuntimeThread(cleared, "thread-a").usageTotals,
    null,
  );
  assert.equal(
    selectConversationRuntimeThread(cleared, "thread-b").usageTotals,
    totals,
  );
});

test("Conversation Runtime 通过 runtime.settings.updated 同步完整 Settings Snapshot", () => {
  const settings = {
    runtime: "codex",
    currentModel: "gpt-next",
    currentModelProvider: "openai",
    currentEffort: "xhigh",
    models: [{
      id: "gpt-next",
      provider: "openai",
      supportedReasoningEfforts: ["high", "xhigh"],
    }],
    effort: {
      supported: true,
      options: ["high", "xhigh"],
      defaultEffort: "high",
    },
    refreshing: false,
  };
  const updated = reduceConversationRuntimeEvent(
    createConversationRuntimeState(),
    {
      kind: "runtime.settings.updated",
      model: "gpt-next",
      modelProvider: "openai",
      effort: "xhigh",
      settings,
    },
    "thread-a",
  );

  assert.equal(updated.model, "gpt-next");
  assert.equal(updated.modelProvider, "openai");
  assert.equal(updated.effort, "xhigh");
  assert.equal(updated.models, settings);
});
