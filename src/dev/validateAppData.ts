// @ts-nocheck
import { pageModes } from "../config/pageModes";
import { styleThemes } from "../config/theme";
import { conversationEntries } from "../data/mockEntries";
import { emptyRemoteData } from "../data/emptyRemoteData";
import { buildContentPath } from "../lib/date";
import {
  hasConversationForDate,
} from "../lib/conversationPageData";
import { hasDatedEntry } from "../lib/memoryPageData";
import { getTimelineDay } from "../lib/timelinePageData";
import {
  MIN_TIMELINE_EVENT_HEIGHT,
  getTimelineEventHeight,
  getTimelineRange,
  toMinutes,
} from "../lib/timeline";
import { normalizeSearchText } from "../lib/search";
import { buildSearchResultState } from "../lib/searchPageData";

function validateTimelineData() {
  const events = getTimelineDay("2026.04.25").events;
  const range = getTimelineRange(events);
  const shortEvent = events.find(
    (event) => event.id === "sky_daily_20260425_0000",
  );
  const longEvent = events.find(
    (event) => event.id === "ear_care_20260425_1725",
  );
  return (
    events.length >= 5 &&
    range.startHour === 0 &&
    range.endHour === 24 &&
    toMinutes("2026-04-24T16:00:00.000Z") === 0 &&
    shortEvent &&
    longEvent &&
    getTimelineEventHeight(shortEvent, range) === MIN_TIMELINE_EVENT_HEIGHT &&
    getTimelineEventHeight(longEvent, range) >
      getTimelineEventHeight(shortEvent, range) &&
    hasDatedEntry("2026.04.28", "Timeline", emptyRemoteData, {
      hasConversationForDate,
      getTimelineDay,
    }) === true &&
    buildSearchResultState("有声小说").results.some(
      (result) => result.mode === "Timeline",
    )
  );
}

function validateConversationData() {
  const allMessages = Object.values(conversationEntries).flatMap((threads) =>
    Object.values(threads).flat(),
  );
  return (
    allMessages.every(
      (message) => message.type !== "voice" && message.type !== "payment",
    ) &&
    allMessages.some(
      (message) =>
        message.type === "file" && String(message.fileName).endsWith(".md"),
    ) &&
    allMessages.some(
      (message) =>
        message.type === "file" && String(message.fileName).endsWith(".txt"),
    ) &&
    allMessages.some((message) => message.type === "sticker") &&
    allMessages
      .filter((message) => message.type === "quote")
      .every((message) => message.role === "user") &&
    buildSearchResultState("日记草稿").results.some(
      (result) => result.fieldLabel === "文件名",
    )
  );
}

export function validateAppData() {
  return (
    styleThemes.length === 4 &&
    pageModes.length === 8 &&
    buildContentPath("Letters", "2026.05.14") ===
      "D:/study/.cyberboss/memory/letters/2026-05-14.md" &&
    buildContentPath("Timeline", "2026.04.28") ===
      "D:/study/.cyberboss/timeline/timeline-state.json" &&
    buildContentPath("Reminders", "2026.04.28") ===
      "D:/study/.cyberboss/reminder-archive/reminders-history.jsonl" &&
    normalizeSearchText("a b") === "ab" &&
    validateTimelineData() &&
    validateConversationData()
  );
}
