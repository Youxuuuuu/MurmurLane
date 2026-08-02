import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRuntimeModelRows,
  filterRuntimeModelRows,
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
