import assert from "node:assert/strict";
import test from "node:test";
import {
  clampConversationSwipeOffset,
  resolveConversationSwipeIntent,
  shouldRevealConversationActions,
} from "../src/components/conversation/conversationSwipe";

test("对话列表手势让纵向滚动优先", () => {
  assert.equal(resolveConversationSwipeIntent(-5, 14), "vertical");
  assert.equal(resolveConversationSwipeIntent(-14, 5), "horizontal");
  assert.equal(resolveConversationSwipeIntent(-4, 3), "pending");
});

test("对话列表左滑只露出操作轨道且不会越界执行", () => {
  assert.equal(clampConversationSwipeOffset(0, -260, 210), -210);
  assert.equal(clampConversationSwipeOffset(-210, 260, 210), 0);
  assert.equal(shouldRevealConversationActions(-80, 210), true);
  assert.equal(shouldRevealConversationActions(-40, 210), false);
});
