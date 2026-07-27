import test from "node:test";
import assert from "node:assert/strict";
import {
  createAppDependencies,
  type MurmurLaneDataAdapter,
  type WebChatAdapter,
} from "../src/app/composition/appDependencies";

test("Composition Root 只组装窄 Adapter，并保持依赖快照只读", () => {
  const dataAdapter = {
    hasEditCredential: true,
  } as MurmurLaneDataAdapter;
  const webChatAdapter = {} as WebChatAdapter;

  const dependencies = createAppDependencies({
    murmurLaneData: dataAdapter,
    webChat: webChatAdapter,
    diagnostics: Object.freeze({ development: true }),
  });

  assert.equal(dependencies.murmurLaneData, dataAdapter);
  assert.equal(dependencies.webChat, webChatAdapter);
  assert.equal(dependencies.diagnostics.development, true);
  assert.equal(Object.isFrozen(dependencies), true);
  assert.deepEqual(Object.keys(dependencies).sort(), [
    "diagnostics",
    "murmurLaneData",
    "webChat",
  ]);
});

test("Composition Root 不把浏览器凭据暴露为应用依赖", () => {
  const dependencies = createAppDependencies({
    murmurLaneData: {
      hasEditCredential: false,
    } as MurmurLaneDataAdapter,
    webChat: {} as WebChatAdapter,
    diagnostics: Object.freeze({ development: false }),
  });

  assert.equal("editCredential" in dependencies, false);
  assert.equal("webChatCredential" in dependencies, false);
  assert.equal("config" in dependencies, false);
});
