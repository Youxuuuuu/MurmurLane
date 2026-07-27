import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { createServerAccess } from "../server/fileLoaders";

test("Server Access 将文件访问限制在启动期 Data Root", () => {
  const access = createServerAccess("D:\\data-root");
  assert.equal(
    access.resolveReadableCyberbossFilePath(
      "conversations\\2026-07-27.jsonl",
    ),
    path.resolve(
      "D:\\data-root",
      "conversations",
      "2026-07-27.jsonl",
    ),
  );
  assert.equal(
    access.resolveReadableCyberbossFilePath(
      "D:\\outside\\secret.txt",
    ),
    null,
  );
  assert.equal(Object.isFrozen(access), true);
});
