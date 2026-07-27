import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { parseServerConfig } from "../server/config";

test("Server Config 保留现有默认值和环境优先级", () => {
  const config = parseServerConfig(
    {
      API_HOST: "0.0.0.0",
      PORT: "9000",
      API_PORT: "8000",
      API_FILE_MAX_BYTES: "1024",
      CYBERBOSS_DATA_ROOT: ".data",
      MURMURLANE_EDIT_TOKEN: " token ",
    },
    "D:\\app",
  );

  assert.equal(config.host, "0.0.0.0");
  assert.equal(config.port, 9000);
  assert.equal(config.apiFileMaxBytes, 1024);
  assert.equal(config.dataRoot, path.resolve(".data"));
  assert.equal(config.editToken, "token");
  assert.equal(
    config.staticDistDirectory,
    path.resolve("D:\\app", "dist"),
  );
  assert.equal(Object.isFrozen(config), true);
});

test("Server Config 对文件限制保留 25MB 回退", () => {
  const config = parseServerConfig({
    API_PORT: "8788",
    API_FILE_MAX_BYTES: "invalid",
  });
  assert.equal(config.port, 8788);
  assert.equal(config.apiFileMaxBytes, 25 * 1024 * 1024);
});

test("Server Config 在端口无效时明确拒绝启动", () => {
  assert.throws(
    () => parseServerConfig({ PORT: "invalid" }),
    /端口配置无效/,
  );
});
