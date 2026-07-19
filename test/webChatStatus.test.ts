import test from "node:test";
import assert from "node:assert/strict";
import { resolveWebChatActivityStatus } from "../src/lib/webChatStatus";

test("typing status zero clears running for numeric and serialized payloads", () => {
  assert.equal(resolveWebChatActivityStatus({ kind: "typing", status: 0 }), "idle");
  assert.equal(resolveWebChatActivityStatus({ kind: "typing", status: "0" }), "idle");
  assert.equal(resolveWebChatActivityStatus({ kind: "typing", status: false }), "idle");
});

test("typing status one and legacy status-less events are running", () => {
  assert.equal(resolveWebChatActivityStatus({ kind: "typing", status: 1 }), "running");
  assert.equal(resolveWebChatActivityStatus({ kind: "typing", status: "1" }), "running");
  assert.equal(resolveWebChatActivityStatus({ kind: "typing" }), "running");
});

test("turn lifecycle remains authoritative and typing zero preserves failure", () => {
  assert.equal(resolveWebChatActivityStatus({ kind: "turn.started" }), "running");
  assert.equal(resolveWebChatActivityStatus({ kind: "turn.completed" }), "idle");
  assert.equal(resolveWebChatActivityStatus({ kind: "turn.failed" }), "failed");
  assert.equal(resolveWebChatActivityStatus({ kind: "typing", status: 0 }, "failed"), "failed");
  assert.equal(resolveWebChatActivityStatus({ kind: "message" }), null);
});
