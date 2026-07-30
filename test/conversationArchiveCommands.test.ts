import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { parseServerConfig } from "../server/config";
import {
  createConversationArchiveCommands,
  type ConversationDeleteResult,
} from "../server/conversation/archiveCommands";

const DELETE_RESULT: ConversationDeleteResult = {
  threadId: "thread-delete",
  deletedRecordCount: 2,
  touchedDates: ["2026-07-30", "2026-07-31"],
  deletedSourceKeys: ["source-a", "source-b"],
};

test("Conversation Archive Commands 在线删除成功时不启动离线 CLI", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const cliCalls: unknown[] = [];
  const config = parseServerConfig({
    CYBERBOSS_WEB_CHAT_URL: "http://127.0.0.1:9999/",
    CYBERBOSS_WEB_CHAT_TOKEN: "chat-token",
  });
  const commands = createConversationArchiveCommands({
    config,
    fetchImpl: async (url, init) => {
      requests.push({ url: String(url), init });
      return Response.json({ ok: true, ...DELETE_RESULT });
    },
    runCli: async (...args) => {
      cliCalls.push(args);
      throw new Error("CLI should not run");
    },
  });

  const result = await commands.deleteThread("thread-delete");

  assert.deepEqual(result, DELETE_RESULT);
  assert.equal(requests.length, 1);
  assert.equal(
    requests[0].url,
    "http://127.0.0.1:9999/api/chat/thread/thread-delete",
  );
  assert.equal(requests[0].init?.method, "DELETE");
  assert.equal(
    new Headers(requests[0].init?.headers).get("Authorization"),
    "Bearer chat-token",
  );
  assert.deepEqual(cliCalls, []);
});

test("Conversation Archive Commands 在 Cyberboss 不可达时回退到离线 CLI", async () => {
  const cliCalls: Array<{
    executable: string;
    args: readonly string[];
  }> = [];
  const config = parseServerConfig(
    {
      CYBERBOSS_DATA_ROOT: "D:\\data",
      CYBERBOSS_CLI_PATH: "D:\\tools\\cyberboss\\bin\\cyberboss.js",
    },
    "D:\\study\\MurmurLane",
  );
  const commands = createConversationArchiveCommands({
    config,
    fetchImpl: async () => {
      throw new TypeError("fetch failed");
    },
    runCli: async (executable, args) => {
      cliCalls.push({ executable, args });
      return {
        stdout: JSON.stringify({ ok: true, ...DELETE_RESULT }),
        stderr: "",
      };
    },
  });

  const result = await commands.deleteThread("thread-delete");

  assert.deepEqual(result, DELETE_RESULT);
  assert.equal(cliCalls.length, 1);
  assert.equal(cliCalls[0].executable, process.execPath);
  assert.deepEqual(cliCalls[0].args, [
    config.cyberbossCliPath,
    "conversation:delete",
    "--thread-id",
    "thread-delete",
    "--conversation-dir",
    "D:\\data\\conversations",
    "--json",
  ]);
});

test("Conversation Archive Commands 保留在线活动线程冲突且不回退 CLI", async () => {
  let cliCallCount = 0;
  const commands = createConversationArchiveCommands({
    config: parseServerConfig({}),
    fetchImpl: async () =>
      Response.json(
        { error: "thread thread-delete has active work and cannot be deleted" },
        { status: 409 },
      ),
    runCli: async () => {
      cliCallCount += 1;
      throw new Error("CLI should not run");
    },
  });

  await assert.rejects(
    () => commands.deleteThread("thread-delete"),
    (error) =>
      error instanceof Error &&
      error.message ===
        "thread thread-delete has active work and cannot be deleted" &&
      "kind" in error &&
      error.kind === "conflict",
  );
  assert.equal(cliCallCount, 0);
});

test("仅 MurmurLane Server 在线时通过真实 Cyberboss CLI 删除临时归档", async (t) => {
  const cyberbossCliPath = path.resolve(
    process.cwd(),
    "..",
    "cyberboss",
    "bin",
    "cyberboss.js",
  );
  if (!existsSync(cyberbossCliPath)) {
    t.skip("相邻 Cyberboss 仓库不可用");
    return;
  }
  const dataRoot = await mkdtemp(
    path.join(tmpdir(), "murmurlane-offline-delete-"),
  );
  t.after(() => rm(dataRoot, { recursive: true, force: true }));
  const conversationDir = path.join(dataRoot, "conversations");
  await mkdir(conversationDir, { recursive: true });
  const dayFile = path.join(conversationDir, "2026-07-31.jsonl");
  const records = [
    storedRecord("thread-delete", "source|delete"),
    storedRecord("thread-keep", "source|keep"),
  ];
  await writeFile(
    dayFile,
    `${records.map((record) => JSON.stringify(record)).join("\n")}\n`,
    "utf8",
  );
  const commands = createConversationArchiveCommands({
    config: parseServerConfig({
      CYBERBOSS_DATA_ROOT: dataRoot,
      CYBERBOSS_CLI_PATH: cyberbossCliPath,
      CYBERBOSS_WEB_CHAT_URL: "http://127.0.0.1:1",
    }),
  });

  const result = await commands.deleteThread("thread-delete");

  assert.equal(result.deletedRecordCount, 1);
  const remaining = (await readFile(dayFile, "utf8"))
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line) as { threadId: string });
  assert.deepEqual(
    remaining.map((record) => record.threadId),
    ["thread-keep"],
  );
});

function storedRecord(threadId: string, sourceKey: string) {
  return {
    id: `codex:${threadId}`,
    type: "user",
    timestamp: "2026-07-31T01:00:00.000Z",
    date: "2026-07-31",
    runtimeId: "codex",
    threadId,
    turnId: `turn-${threadId}`,
    workspaceRoot: process.cwd(),
    text: threadId,
    messageId: "",
    itemId: "",
    sourceKey,
    meta: {
      attachments: [],
      files: [],
      stickers: [],
      sourceKey,
    },
    source: {
      provider: "codex",
      sourceKey,
      sourceFile: path.join(process.cwd(), "fixture.jsonl"),
      sourceLine: 1,
    },
  };
}
