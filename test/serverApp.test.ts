import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { createApp } from "../server/app";
import { parseServerConfig } from "../server/config";
import { createServerAccess } from "../server/fileLoaders";
import { createLiveUpdateService } from "../server/liveUpdates";

async function withServer(
  run: (baseUrl: string, dataRoot: string) => Promise<void>,
) {
  const dataRoot = await mkdtemp(
    path.join(tmpdir(), "murmurlane-server-"),
  );
  const config = parseServerConfig({
    CYBERBOSS_DATA_ROOT: dataRoot,
  });
  const access = createServerAccess(config.dataRoot);
  const liveUpdates = createLiveUpdateService(config.dataRoot);
  const app = createApp({ config, access, liveUpdates });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) =>
    server.once("listening", resolve),
  );
  const address = server.address() as AddressInfo;
  try {
    await run(
      `http://127.0.0.1:${address.port}`,
      dataRoot,
    );
  } finally {
    liveUpdates.close();
    await new Promise<void>((resolve, reject) =>
      server.close((error) =>
        error ? reject(error) : resolve(),
      ),
    );
    await rm(dataRoot, { recursive: true, force: true });
  }
}

test("createApp 导入和创建不会自动监听端口", () => {
  const config = parseServerConfig({});
  const access = createServerAccess(config.dataRoot);
  const liveUpdates = createLiveUpdateService(config.dataRoot);
  const app = createApp({ config, access, liveUpdates });
  assert.equal(typeof app.listen, "function");
  liveUpdates.close();
});

test("Live Update Service 发布普通事件而不依赖 Express", () => {
  const config = parseServerConfig({});
  const service = createLiveUpdateService(config.dataRoot);
  const events: Array<{ type: string; id: number }> = [];
  const unsubscribe = service.subscribe((event) => {
    events.push(event);
  });
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "resync");
  assert.equal(typeof events[0].id, "number");
  unsubscribe();
  service.close();
});

test("Server 保持 CORS、参数错误和文件安全响应", async () => {
  await withServer(async (baseUrl) => {
    const preflight = await fetch(`${baseUrl}/api/index/dates`, {
      method: "OPTIONS",
      headers: { Origin: "http://localhost:5173" },
    });
    assert.equal(preflight.status, 204);
    assert.equal(
      preflight.headers.get("access-control-allow-origin"),
      "http://localhost:5173",
    );

    const invalidTimeline = await fetch(
      `${baseUrl}/api/timeline?date=bad`,
    );
    assert.equal(invalidTimeline.status, 400);
    assert.deepEqual(await invalidTimeline.json(), {
      error: "Invalid date. Expected yyyy-mm-dd.",
    });

    const forbiddenFile = await fetch(
      `${baseUrl}/api/file?path=${encodeURIComponent(
        path.resolve(tmpdir(), "outside.png"),
      )}`,
    );
    assert.equal(forbiddenFile.status, 403);
    assert.deepEqual(await forbiddenFile.json(), {
      error: "Forbidden file path.",
    });
  });
});

test("Server 编辑令牌缺失时保持写入禁用", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/api/timeline/event`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: "2026-07-27",
          eventId: "event-1",
          changes: { title: "新标题" },
        }),
      },
    );
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), {
      error:
        "Editing is disabled. Set MURMURLANE_EDIT_TOKEN to enable writes.",
    });
  });
});

test("Server 领域读取在来源缺失时保持既有响应结构", async () => {
  await withServer(async (baseUrl, dataRoot) => {
    const endpoints = [
      "/api/conversations?date=2026-07-27",
      "/api/index/dates",
      "/api/reminders/history",
      "/api/timeline?date=2026-07-27",
      "/api/memory/diary?date=2026-07-27",
      "/api/memory/daily-summary?date=2026-07-27",
      "/api/memory/letters?date=2026-07-27",
      "/api/memory/static?mode=facts",
      "/api/xiaoye/static?mode=weixin_instructions",
      "/api/conversation-profiles",
    ];
    const responses = await Promise.all(
      endpoints.map((endpoint) => fetch(`${baseUrl}${endpoint}`)),
    );
    assert.equal(
      responses.every((response) => response.status === 200),
      true,
    );
    const bodies = await Promise.all(
      responses.map((response) => response.json()),
    );
    assert.deepEqual(bodies[0], []);
    assert.deepEqual(bodies[1], {
      conversations: [],
      conversationThreads: {},
      diary: [],
      dailySummary: [],
      letters: [],
      timeline: [],
    });
    assert.deepEqual(bodies[2], {
      found: false,
      entries: [],
    });
    assert.deepEqual(bodies[3], {
      found: false,
      entry: null,
    });
    for (const body of bodies.slice(4, 9)) {
      assert.deepEqual(body, { found: false, entry: null });
    }
    assert.deepEqual(bodies[9], {
      root: path.join(dataRoot, "MLane", "profiles"),
      user: null,
      threads: {},
    });
  });
});
