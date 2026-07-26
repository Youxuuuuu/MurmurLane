import test from "node:test";
import assert from "node:assert/strict";
import { emptyRemoteData } from "../src/data/emptyRemoteData";
import { buildSearchResultState } from "../src/lib/searchPageData";

test("Timeline 搜索结果不包含 Conversation 或 Archive 内容", () => {
  const state = buildSearchResultState("2026", emptyRemoteData, {
    workspaceScope: "timeline",
  });

  assert.equal(
    state.results.every((result) => result.mode === "Timeline"),
    true,
  );
});

test("Archive 搜索结果不包含 Conversation 或 Timeline 内容", () => {
  const state = buildSearchResultState("2026", emptyRemoteData, {
    workspaceScope: "archive",
  });

  assert.equal(
    state.results.every(
      (result) =>
        result.mode !== "Conversation" &&
        result.mode !== "Timeline",
    ),
    true,
  );
});
