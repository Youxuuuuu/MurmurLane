import test from "node:test";
import assert from "node:assert/strict";
import {
  bubbleRevealAdvanceOpacity,
  bubbleRevealInitial,
  bubbleRevealTarget,
  bubbleRevealTransition,
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
  assert.equal(bubbleRevealAdvanceOpacity > 0.5, true);
  assert.equal(bubbleRevealAdvanceOpacity < 1, true);
  assert.equal(shouldAdvanceBubbleReveal(bubbleRevealAdvanceOpacity - 0.01), false);
  assert.equal(shouldAdvanceBubbleReveal(bubbleRevealAdvanceOpacity), true);
  assert.equal(shouldAdvanceBubbleReveal(1), true);
});
