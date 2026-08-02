import assert from "node:assert/strict";
import test from "node:test";
import type { WebChatModelResponse } from "../src/types/webChat";
import {
  invalidateConversationRuntimeModelRequest,
  runConversationRuntimeModelRequest,
} from "../src/workspaces/conversation/runtime/useConversationRuntime";
import {
  absorbConversationRuntimeModels,
  createConversationRuntimeState,
  reduceConversationRuntimeEvent,
} from "../src/workspaces/conversation/runtime/conversationRuntimeState";

function createSettings(model: string): WebChatModelResponse {
  return {
    runtime: "codex",
    currentModel: model,
    currentModelProvider: "openai",
    currentEffort: "high",
    models: [{ id: model, provider: "openai" }],
    effort: {
      supported: true,
      options: ["high"],
      defaultEffort: "high",
    },
  };
}

test("较新的 Runtime Settings 使尚未返回的旧模型目录失效", async () => {
  const revisionRef = { current: 0 };
  let resolveCatalog!: (value: WebChatModelResponse) => void;
  const oldCatalog = new Promise<WebChatModelResponse>((resolve) => {
    resolveCatalog = resolve;
  });
  let state = createConversationRuntimeState();
  const pending = runConversationRuntimeModelRequest({
    revisionRef,
    fetchModels: () => oldCatalog,
    applyModels: (models) => {
      state = absorbConversationRuntimeModels(state, models);
    },
  });

  invalidateConversationRuntimeModelRequest(revisionRef);
  state = reduceConversationRuntimeEvent(
    state,
    {
      kind: "runtime.settings.updated",
      model: "model-new",
      modelProvider: "openai",
      effort: "high",
      settings: createSettings("model-new"),
    },
    "thread-a",
  );
  resolveCatalog(createSettings("model-old"));
  await pending;

  assert.equal(state.model, "model-new");
  assert.equal(state.models?.currentModel, "model-new");
});
