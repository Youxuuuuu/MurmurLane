import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCompactRuntimeStatusText,
  buildRuntimeModelRows,
  filterRuntimeModelRows,
  formatContextTokens,
  formatCumulativeTokens,
  formatFullTokens,
  resolveLatestUsage,
  shouldShowRuntimeModelSearch,
} from "../src/components/conversation/conversationRuntimePanelModel";

test("模型搜索仅在真实目录达到 10 个时出现", () => {
  assert.equal(shouldShowRuntimeModelSearch(Array.from({ length: 9 }, (_, index) => ({
    model: `model-${index}`,
  }))), false);
  assert.equal(shouldShowRuntimeModelSearch(Array.from({ length: 10 }, (_, index) => ({
    model: `model-${index}`,
  }))), true);
});

test("模型行不注入硬编码 fallback，并保留目录暂缺的当前模型", () => {
  const rows = buildRuntimeModelRows({
    models: [
      { model: "model-a", provider: "provider-a" },
      { model: "model-b", provider: "provider-b" },
    ],
    currentModel: "missing-current",
    currentModelStatus: "catalog-missing",
  });

  assert.deepEqual(rows.map((row) => row.model), [
    "missing-current",
    "model-a",
    "model-b",
  ]);
  assert.equal(rows[0].statusLabel, "目录暂缺");
  assert.equal(rows.some((row) => row.model === "qwen3.5-plus"), false);
});

test("模型搜索同时匹配模型名和 Provider", () => {
  const rows = buildRuntimeModelRows({
    models: [
      { model: "alpha", provider: "OpenAI" },
      { model: "beta", provider: "Anthropic" },
    ],
    currentModel: "alpha",
    currentModelStatus: "available",
  });

  assert.deepEqual(
    filterRuntimeModelRows(rows, "anthro").map((row) => row.model),
    ["beta"],
  );
});

test("累计 Token 按 10m 和 10000m 边界格式化", () => {
  assert.equal(formatCumulativeTokens(9_999_999), "9999999");
  assert.equal(formatCumulativeTokens(10_000_000), "10000000");
  assert.equal(formatCumulativeTokens(24_700_000), "24700k");
  assert.equal(formatCumulativeTokens(10_000_000_000), "10000000k");
  assert.equal(formatCumulativeTokens(10_000_100_000), "10000.1m");
});

test("Context 小于 10k 完整显示，达到 10k 后使用 k", () => {
  assert.equal(formatContextTokens(9_999), "9999");
  assert.equal(formatContextTokens(10_000), "10k");
  assert.equal(formatContextTokens(140_600), "140.6k");
});

test("最近一轮 Token 永远完整显示并按 Runtime 统一输入口径", () => {
  assert.equal(formatFullTokens(24_700_000), "24700000");
  assert.deepEqual(resolveLatestUsage({
    contextUsage: {
      runtimeId: "claudecode",
      inputTokens: 90_000,
      cacheCreationInputTokens: 30_000,
      cacheReadInputTokens: 16_400,
      outputTokens: 4_200,
      latestInputTokens: 100_000,
      latestCacheCreationInputTokens: 40_000,
      latestCacheReadInputTokens: 20_000,
      latestOutputTokens: 5_000,
    },
  }), {
    inputTokens: 160_000,
    outputTokens: 5_000,
    cacheReadInputTokens: 20_000,
  });
  assert.deepEqual(resolveLatestUsage({
    runtime: "codex",
    contextUsage: {
      inputTokens: 120_000,
      cachedInputTokens: 80_000,
      outputTokens: 20_000,
    },
  }), {
    inputTokens: 120_000,
    outputTokens: 20_000,
    cacheReadInputTokens: 80_000,
  });
});

test("紧凑状态显示当前 Context 与真实最大窗口并移除 cache", () => {
  assert.equal(buildCompactRuntimeStatusText({
    model: "codex-model",
    contextUsage: {
      currentTokens: 140_600,
      contextWindow: 200_000,
    },
  }), "codex-model · context 140.6k / 200k");

  assert.equal(buildCompactRuntimeStatusText({
    model: "claude-model",
    contextUsage: { currentTokens: 9_999 },
    models: {
      runtime: "claudecode",
      models: [{ model: "claude-model", contextWindow: 128_000 }],
      effort: { supported: false, options: [], defaultEffort: "" },
    },
  }), "claude-model · context 9999 / 128k");
});
