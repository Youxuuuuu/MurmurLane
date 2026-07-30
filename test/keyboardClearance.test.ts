import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveComposerBottomClearance,
  resolveComposerKeyboardInset,
} from "../src/lib/useStableViewport";

const keyboardOpenSnapshots = [
  { browser: "Android Chrome", keyboardInset: 346.3 },
  { browser: "Android Via", keyboardInset: 246.1 },
  { browser: "iOS Chrome", keyboardInset: 479.5 },
];

test("三端真实键盘快照使用与 Composer 功能面板一致的 8px 净空", () => {
  keyboardOpenSnapshots.forEach(({ browser, keyboardInset }) => {
    assert.equal(
      resolveComposerBottomClearance(keyboardInset),
      "8px",
      browser,
    );
  });
});

test("键盘关闭时保留既有呼吸间距与底部安全区", () => {
  [0, 80].forEach((keyboardInset) => {
    assert.equal(
      resolveComposerBottomClearance(keyboardInset),
      "calc(10px + env(safe-area-inset-bottom))",
    );
  });
  assert.equal(resolveComposerBottomClearance(80.1), "8px");
});

test("Android Chrome 在无精确键盘几何时修正 VisualViewport 未报告的遮挡", () => {
  assert.equal(
    resolveComposerKeyboardInset({
      layoutViewportTracksKeyboard: false,
      viewportKeyboardInset: 346.3,
      fallbackOcclusionInset: 16,
    }),
    362.3,
  );
});

test("VirtualKeyboard 精确几何优先于 VisualViewport 与 Android fallback", () => {
  assert.equal(
    resolveComposerKeyboardInset({
      layoutViewportTracksKeyboard: false,
      viewportKeyboardInset: 346.3,
      virtualKeyboardInset: 362.5,
      fallbackOcclusionInset: 16,
    }),
    362.5,
  );
});

test("Via 的 layout-resize 与 iOS 的准确 VisualViewport 不接受 Android 修正", () => {
  assert.equal(
    resolveComposerKeyboardInset({
      layoutViewportTracksKeyboard: true,
      viewportKeyboardInset: 246.1,
      fallbackOcclusionInset: 16,
    }),
    0,
  );
  assert.equal(
    resolveComposerKeyboardInset({
      layoutViewportTracksKeyboard: false,
      viewportKeyboardInset: 479.5,
      fallbackOcclusionInset: 0,
    }),
    479.5,
  );
});

test("键盘关闭时不应用 Android fallback", () => {
  assert.equal(
    resolveComposerKeyboardInset({
      layoutViewportTracksKeyboard: false,
      viewportKeyboardInset: 0,
      fallbackOcclusionInset: 16,
    }),
    0,
  );
});
