import test from "node:test";
import assert from "node:assert/strict";
import { createConversationWorkspaceOutput } from "../src/workspaces/conversation";

test("Conversation Workspace 只通过 View Model 与 Commands 暴露页面契约", () => {
  const viewModel = {
    messages: [{ id: "message-1" }],
    connection: "open",
  };
  const commands = {
    sendMessages: () => "submitted",
  };

  const output = createConversationWorkspaceOutput(
    viewModel,
    commands,
  );

  assert.equal(output.viewModel, viewModel);
  assert.equal(output.commands, commands);
  assert.equal(Object.isFrozen(output), true);
  assert.deepEqual(Object.keys(output).sort(), [
    "commands",
    "viewModel",
  ]);
  assert.equal("adapter" in output, false);
  assert.equal("setState" in output, false);
});
