import test from "node:test";
import assert from "node:assert/strict";

import { shouldHideConversationRecord } from "../src/lib/conversation";

test("只隐藏无具体原因的 runtime 退出噪声，保留真实错误和 operation", () => {
  assert.equal(shouldHideConversationRecord({
    id: "runtime-exit-noise",
    type: "error",
    text: "❌ Runtime process exited unexpectedly",
    meta: { runtimeEvent: "runtime.turn.failed" },
  }), true);

  assert.equal(shouldHideConversationRecord({
    id: "runtime-real-error",
    type: "error",
    text: "❌ Execution failed: context window exceeded",
    meta: { runtimeEvent: "runtime.turn.failed" },
  }), false);

  assert.equal(shouldHideConversationRecord({
    id: "visible-operation",
    type: "operation",
    text: "[stmem_memory_search] 最近聊天",
  }), false);
});
