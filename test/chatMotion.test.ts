import test from "node:test";
import assert from "node:assert/strict";
import {
  bubbleRevealAdvanceOpacity,
  bubbleRevealInitial,
  bubbleRevealTarget,
  bubbleRevealTransition,
  chatStatusEnterTransition,
  chatStatusExitTransition,
  shouldAdvanceBubbleReveal,
} from "../src/lib/chatMotion";

test("bubble reveal is a critically damped sub-300ms compositor animation", () => {
  assert.equal(bubbleRevealTransition.type, "spring");
  assert.equal(bubbleRevealTransition.bounce, 0);
  assert.equal(bubbleRevealTransition.duration <= 0.3, true);
  assert.equal(Object.hasOwn(bubbleRevealTransition, "delay"), false);
  assert.deepEqual(Object.keys(bubbleRevealInitial).sort(), ["opacity", "transform"]);
  assert.deepEqual(Object.keys(bubbleRevealTarget).sort(), ["opacity", "transform"]);
  assert.equal(bubbleRevealInitial.transform.includes("scale(0)"), false);
});

test("the next bubble advances only after the current bubble is visibly established", () => {
  assert.equal(bubbleRevealAdvanceOpacity >= 0.8, true);
  assert.equal(bubbleRevealAdvanceOpacity < 1, true);
  assert.equal(shouldAdvanceBubbleReveal(bubbleRevealAdvanceOpacity - 0.01), false);
  assert.equal(shouldAdvanceBubbleReveal(bubbleRevealAdvanceOpacity), true);
  assert.equal(shouldAdvanceBubbleReveal(1), true);
});

test("typing status enters and exits with responsive ease-out curves", () => {
  assert.deepEqual(chatStatusEnterTransition.ease, [0.23, 1, 0.32, 1]);
  assert.deepEqual(chatStatusExitTransition.ease, [0.23, 1, 0.32, 1]);
  assert.equal(chatStatusEnterTransition.duration < 0.2, true);
  assert.equal(chatStatusExitTransition.duration < chatStatusEnterTransition.duration, true);
});
