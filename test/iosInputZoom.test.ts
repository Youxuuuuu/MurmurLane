import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("iOS 可编辑控件使用真实的 16px 字号且不通过缩放伪装", () => {
  assert.match(css, /@supports \(-webkit-touch-callout: none\)/u);
  assert.match(css, /\[contenteditable\]:not\(\[contenteditable="false"\]\)/u);
  assert.match(css, /textarea::placeholder\s*\{\s*font-size: 16px !important;/u);
  assert.doesNotMatch(
    css,
    /@media\s*\(hover:\s*none\)\s*and\s*\(pointer:\s*coarse\)/u,
  );
  assert.doesNotMatch(css, /width:\s*133\.333333%/u);
  assert.doesNotMatch(css, /transform:\s*scale\(0\.75\)/u);
});

test("viewport 与根触摸策略共同禁用页面缩放", () => {
  assert.match(
    html,
    /width=device-width, initial-scale=1\.0, maximum-scale=1\.0, user-scalable=no, viewport-fit=cover/u,
  );
  assert.match(
    css,
    /html,\s*body,\s*#root\s*\{[\s\S]*?touch-action:\s*pan-x pan-y;/u,
  );
});
