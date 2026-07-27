import assert from "node:assert/strict";
import test from "node:test";
import { isTechnicalError } from "../src/app/technicalError";
import {
  createMurmurLaneApi,
  ApiError,
} from "../src/data/api";
import {
  createWebChatApi,
  WebChatHttpError,
} from "../src/data/chatApi";

const browserConfig = {
  baseUrl: "",
  credential: "",
  sendTimeoutMs: 15_000,
  uploadTimeoutMs: 120_000,
};

test("Browser Adapter 将 HTTP Body 隔离为诊断信息", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response("D:\\private\\secret.txt", {
      status: 403,
      statusText: "Forbidden",
    });
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const api = createMurmurLaneApi({
    baseUrl: "",
    editCredential: "",
    diagnostics: { development: false },
  });
  await assert.rejects(
    api.fetchDateIndex(),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.kind, "http");
      assert.equal(error.message.includes("secret.txt"), false);
      assert.equal(error.bodyText.includes("secret.txt"), true);
      return true;
    },
  );
});

test("WebChat Adapter 不把远端 Body 作为错误文案", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response("token=private", { status: 500 });
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const api = createWebChatApi(browserConfig);
  await assert.rejects(
    api.fetchModels(),
    (error: unknown) => {
      assert.ok(error instanceof WebChatHttpError);
      assert.equal(error.message.includes("private"), false);
      assert.equal(error.bodyText, "token=private");
      return true;
    },
  );
});

test("Browser Adapter 在边缘拒绝不满足最小契约的 JSON", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ models: "not-array" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const api = createWebChatApi(browserConfig);
  await assert.rejects(
    api.fetchModels(),
    (error: unknown) => {
      assert.equal(isTechnicalError(error), true);
      assert.equal(
        isTechnicalError(error) ? error.kind : "",
        "invalid-payload",
      );
      return true;
    },
  );
});
