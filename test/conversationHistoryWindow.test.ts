import test from "node:test";
import assert from "node:assert/strict";

import { emptyRemoteData } from "../src/data/emptyRemoteData";
import {
  buildConversationThreadPage,
  getAdjacentConversationDateToLoad,
  getContiguousLoadedConversationDates,
} from "../src/lib/conversationPageData";

const threadId = "thread-1";
const indexedDates = [
  "2026-07-16",
  "2026-07-17",
  "2026-07-18",
  "2026-07-19",
];

function record(id: string, date: string) {
  return {
    id,
    threadId,
    type: "user",
    text: id,
    timestamp: `${date.replace(/\./g, "-")}T08:00:00+08:00`,
  };
}

function remoteData(loadedDates: string[], dates = indexedDates) {
  return {
    ...emptyRemoteData,
    dateIndex: {
      conversations: dates,
      conversationThreads: { [threadId]: dates },
      diary: [],
      dailySummary: [],
      letters: [],
      timeline: [],
    },
    searchCache: {
      ...emptyRemoteData.searchCache,
      conversations: Object.fromEntries(
        loadedDates.map((date) => {
          const dotDate = date.replace(/-/g, ".");
          return [dotDate, { [threadId]: [record(`message-${dotDate}`, dotDate)] }];
        }),
      ),
    },
  };
}

test("chat history ignores sparse cached dates until the gap is loaded", () => {
  const sparseData = remoteData(["2026-07-16", "2026-07-19"]);

  assert.deepEqual(
    getContiguousLoadedConversationDates(threadId, sparseData),
    ["2026.07.19"],
  );
  assert.deepEqual(
    buildConversationThreadPage({}, threadId, sparseData).messages.map(
      (message) => message.conversationDate,
    ),
    ["2026.07.19"],
  );
});

test("an older search cache cannot stand in for the newest indexed date", () => {
  const staleSearchData = remoteData(["2026-07-16"]);

  assert.deepEqual(
    getContiguousLoadedConversationDates(threadId, staleSearchData),
    [],
  );
  assert.deepEqual(
    buildConversationThreadPage({}, threadId, staleSearchData).messages,
    [],
  );
});

test("cached history joins the chat window only after every indexed gap closes", () => {
  const partiallyFilled = remoteData([
    "2026-07-16",
    "2026-07-18",
    "2026-07-19",
  ]);
  assert.deepEqual(
    getContiguousLoadedConversationDates(threadId, partiallyFilled),
    ["2026.07.18", "2026.07.19"],
  );

  const contiguous = remoteData(indexedDates);
  assert.deepEqual(
    getContiguousLoadedConversationDates(threadId, contiguous),
    ["2026.07.16", "2026.07.17", "2026.07.18", "2026.07.19"],
  );
});

test("an explicitly loaded calendar date becomes the active history window", () => {
  const dates = [
    "2026-07-01",
    "2026-07-02",
    "2026-07-16",
    "2026-07-17",
    "2026-07-18",
    "2026-07-19",
  ];
  const loaded = remoteData([
    "2026-07-01",
    "2026-07-17",
    "2026-07-18",
    "2026-07-19",
  ], dates);

  assert.deepEqual(
    getContiguousLoadedConversationDates(threadId, loaded, "2026-07-01"),
    ["2026.07.01"],
  );
  assert.deepEqual(
    buildConversationThreadPage({}, threadId, loaded, "2026-07-01")
      .messages.map((message) => message.conversationDate),
    ["2026.07.01"],
  );
});

test("history loading chooses the adjacent indexed date in both directions", () => {
  const dates = [
    "2026-07-01",
    "2026-07-02",
    "2026-07-16",
    "2026-07-17",
    "2026-07-18",
    "2026-07-19",
  ];

  assert.equal(
    getAdjacentConversationDateToLoad(dates, ["2026.07.01"], "later"),
    "2026.07.02",
  );
  assert.equal(
    getAdjacentConversationDateToLoad(
      dates,
      ["2026.07.17", "2026.07.18", "2026.07.19"],
      "earlier",
    ),
    "2026.07.16",
  );
});
