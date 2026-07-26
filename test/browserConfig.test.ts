import test from "node:test";
import assert from "node:assert/strict";
import { parseBrowserConfig } from "../src/app/config/browserConfig";

test("Browser Config 保留当前生产 URL、Token 与 Timeout 语义", () => {
  const config = parseBrowserConfig({
    DEV: false,
    VITE_API_BASE_URL: "https://murmur.example.com/",
    VITE_MURMURLANE_CHAT_API_BASE_URL: "",
    VITE_MURMURLANE_EDIT_TOKEN: "  edit-token  ",
    VITE_MURMURLANE_CHAT_TOKEN: "  chat-token  ",
  });

  assert.deepEqual(config, {
    murmurLaneApiBaseUrl: "https://murmur.example.com",
    webChatApiBaseUrl: "https://murmur.example.com",
    editCredential: "edit-token",
    webChatCredential: "chat-token",
    webChatSendTimeoutMs: 15_000,
    webChatUploadTimeoutMs: 120_000,
    diagnostics: {
      development: false,
    },
  });
  assert.equal(Object.isFrozen(config), true);
  assert.equal(Object.isFrozen(config.diagnostics), true);
});

test("Browser Config 保留同源 API 和开发 WebChat 缺省地址", () => {
  const config = parseBrowserConfig({
    DEV: true,
    VITE_API_BASE_URL: " ",
    VITE_MURMURLANE_EDIT_TOKEN: " ",
    VITE_MURMURLANE_CHAT_TOKEN: "",
  });

  assert.deepEqual(config, {
    murmurLaneApiBaseUrl: "",
    webChatApiBaseUrl: "http://127.0.0.1:8791",
    editCredential: "",
    webChatCredential: "",
    webChatSendTimeoutMs: 15_000,
    webChatUploadTimeoutMs: 120_000,
    diagnostics: {
      development: true,
    },
  });
});
