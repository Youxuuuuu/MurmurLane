import { monthColors, monthPales } from "../config/theme";
import { conversationEntries } from "../data/mockEntries";
import type { RemoteData } from "../types/api";
import type {
  ConversationDateEntries,
  ConversationRecord,
  ConversationThreadRecords,
} from "../types/conversation";
import {
  buildContentPath,
  getDateParts,
  pad2,
  toDotDate,
  toHyphenDate,
} from "./date";
import { legacyConversationMessageToRecord } from "./conversation";

export const defaultConversationThreadId =
  "266618a6-b29f-4a8d-abd4-12ff874eb859";

export const conversationThreadIds = [
  defaultConversationThreadId,
  "019dbec2-994e-75a3-b36f-2b83dba0fc49",
  "226dbec2-994e-75a3-b36f-2b45dba0fc56",
];

const emptyRemoteData: RemoteData = {
  conversationEntries: {},
  timelineState: {},
  diaryEntries: {},
  dailySummaryEntries: {},
  letterEntries: {},
  staticModeEntries: {},
  xiaoyeEntries: {},
  reminderHistoryEntries: [],
  dateIndex: null,
  searchCache: {
    conversations: {},
    diary: {},
    dailySummary: {},
    letters: {},
    timeline: {},
  },
};

export function getSearchConversationRecordsForDate(
  dateText: string,
  remoteData: RemoteData = emptyRemoteData,
): ConversationThreadRecords {
  const dotDate = toDotDate(dateText);
  return remoteData.searchCache.conversations[dotDate] ?? {};
}

export function getMockConversationRecordsForDate(
  dateText: string,
  threadId: string,
): ConversationRecord[] {
  const dotDate = toDotDate(dateText);
  return (conversationEntries[dotDate]?.[threadId] ?? []).map((message) =>
    legacyConversationMessageToRecord(message, dotDate, threadId),
  );
}

export function groupConversationRecordsByThread(
  records: ConversationRecord[] = [],
): ConversationThreadRecords {
  return records.reduce<ConversationThreadRecords>((groups, record) => {
    const threadId = record.threadId || conversationThreadIds[0];
    if (!groups[threadId]) groups[threadId] = [];
    groups[threadId].push(record);
    return groups;
  }, {});
}

export function getConversationRecordsForDate(
  dateText: string,
  threadId: string,
  remoteData: RemoteData = emptyRemoteData,
): ConversationRecord[] {
  const dotDate = toDotDate(dateText);
  const remoteRecords =
    remoteData.conversationEntries[dotDate]?.[threadId] ??
    getSearchConversationRecordsForDate(dotDate, remoteData)?.[threadId];
  if (remoteRecords?.length) return remoteRecords;
  return getMockConversationRecordsForDate(dotDate, threadId);
}

export function getConversationThreadIdsForDate(
  dateText: string,
  remoteData: RemoteData = emptyRemoteData,
): string[] {
  const dotDate = toDotDate(dateText);
  const remoteThreadIds = Object.keys(
    remoteData.conversationEntries[dotDate] ?? {},
  );
  const searchThreadIds = Object.keys(
    getSearchConversationRecordsForDate(dotDate, remoteData) ?? {},
  );
  const realThreadIds = Array.from(
    new Set([...remoteThreadIds, ...searchThreadIds]),
  );

  if (realThreadIds.length) {
    return realThreadIds;
  }

  const mockThreadIds = Object.keys(conversationEntries[dotDate] ?? {});
  return mockThreadIds.length ? mockThreadIds : conversationThreadIds;
}

export function getRemoteConversationThreadIndex(
  remoteData: RemoteData = emptyRemoteData,
): Record<string, string[]> {
  return remoteData.dateIndex?.conversationThreads ?? {};
}

export function getRealConversationThreadIds(
  remoteData: RemoteData = emptyRemoteData,
): string[] {
  const indexedThreadIds = Object.keys(
    getRemoteConversationThreadIndex(remoteData),
  ).filter(Boolean);

  if (indexedThreadIds.length) {
    return indexedThreadIds;
  }

  const loadedThreadIds = new Set<string>();
  const collectFromDateGroups = (dateGroups: ConversationDateEntries) => {
    Object.values(dateGroups ?? {}).forEach((threads) => {
      Object.keys(threads ?? {}).forEach((threadId) => {
        if (threadId) loadedThreadIds.add(threadId);
      });
    });
  };

  collectFromDateGroups(remoteData.conversationEntries);
  collectFromDateGroups(remoteData.searchCache.conversations);

  return Array.from(loadedThreadIds).filter(Boolean);
}

export function getAllConversationThreadIds(
  remoteData: RemoteData = emptyRemoteData,
): string[] {
  const realThreadIds = getRealConversationThreadIds(remoteData);

  if (realThreadIds.length) {
    return realThreadIds;
  }

  const fallbackThreadIds = new Set<string>();

  Object.values(conversationEntries ?? {}).forEach((threads) => {
    Object.keys(threads ?? {}).forEach((threadId) => {
      if (threadId) fallbackThreadIds.add(threadId);
    });
  });

  conversationThreadIds.forEach((threadId) => {
    if (threadId) fallbackThreadIds.add(threadId);
  });

  return Array.from(fallbackThreadIds).filter(Boolean);
}

export function getConversationRecordSortTime(
  dateText: string,
  record: ConversationRecord,
): number {
  const timestamp = record?.timestamp ?? record?.createdAt;
  const timestampTime = timestamp ? new Date(timestamp).getTime() : NaN;

  if (!Number.isNaN(timestampTime)) return timestampTime;

  const clock = String(record?.time ?? "").match(/^(\d{1,2}):(\d{2})/)?.[0];
  if (clock) {
    const clockTime = new Date(
      `${toHyphenDate(dateText)}T${clock}:00+08:00`,
    ).getTime();

    if (!Number.isNaN(clockTime)) return clockTime;
  }

  return new Date(`${toHyphenDate(dateText)}T23:59:59.999+08:00`).getTime();
}

export function getLatestConversationThreadId(
  remoteData: RemoteData = emptyRemoteData,
): string {
  const threadIndex = getRemoteConversationThreadIndex(remoteData);
  const indexedThreadIds = Object.keys(threadIndex).filter(Boolean);

  if (indexedThreadIds.length) {
    const latestDate = indexedThreadIds.reduce((latest, threadId) => {
      const dates = threadIndex[threadId] ?? [];
      const threadLatestDate = dates[dates.length - 1] ?? "";

      return threadLatestDate > latest ? threadLatestDate : latest;
    }, "");
    const defaultHasLatestDate = threadIndex[
      defaultConversationThreadId
    ]?.includes(latestDate);

    if (defaultHasLatestDate) {
      return defaultConversationThreadId;
    }

    return (
      indexedThreadIds.find((threadId) =>
        threadIndex[threadId]?.includes(latestDate),
      ) ?? indexedThreadIds[0]
    );
  }

  const createLatest = () => ({
    threadId: "",
    time: Number.NEGATIVE_INFINITY,
  });
  const realLatest = createLatest();
  const visitRecords = (
    dateText: string,
    threadId: string,
    records: ConversationRecord[],
  ) => {
    if (!threadId || !records?.length) return;

    records.forEach((record) => {
      const time = getConversationRecordSortTime(dateText, record);

      if (time > realLatest.time) {
        realLatest.threadId = threadId;
        realLatest.time = time;
      }
    });
  };
  const collectFromDateGroups = (dateGroups: ConversationDateEntries) => {
    Object.entries(dateGroups ?? {}).forEach(([dateText, threads]) => {
      Object.entries(threads ?? {}).forEach(([threadId, records]) => {
        visitRecords(toDotDate(dateText), threadId, records);
      });
    });
  };

  collectFromDateGroups(remoteData.conversationEntries);
  collectFromDateGroups(remoteData.searchCache.conversations);

  return realLatest.threadId || defaultConversationThreadId;
}

export function hasConversationForDate(
  dateText: string,
  threadId: string | null,
  remoteData: RemoteData = emptyRemoteData,
): boolean {
  const hyphenDate = toHyphenDate(dateText);
  const threadIndex = getRemoteConversationThreadIndex(remoteData);

  if (threadId && threadIndex[threadId]) {
    return threadIndex[threadId].includes(hyphenDate);
  }

  if (threadId) {
    return Boolean(
      getConversationRecordsForDate(dateText, threadId, remoteData).length,
    );
  }

  const indexedThreadIds = Object.keys(threadIndex);
  if (indexedThreadIds.length) {
    return indexedThreadIds.some((id) =>
      threadIndex[id]?.includes(hyphenDate),
    );
  }

  return getConversationThreadIdsForDate(dateText, remoteData).some((id) =>
    getConversationRecordsForDate(dateText, id, remoteData).length > 0,
  );
}

export function formatConversationTime(timestamp: string | null | undefined) {
  if (!timestamp) return "";

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";

  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function buildConversationPage(
  styleTheme: Record<string, unknown>,
  dateText: string,
  threadId: string,
  remoteData: RemoteData = emptyRemoteData,
) {
  const { month, day } = getDateParts(dateText);
  const messages = getConversationRecordsForDate(dateText, threadId, remoteData);
  return {
    ...styleTheme,
    remoteData,
    mode: "Conversation",
    modeTitle: "对话",
    date: dateText,
    month,
    day,
    threadId,
    messages,
    sourcePath: buildContentPath("Conversation", dateText),
    color: monthColors[month] ?? "#667064",
    pale: monthPales[month] ?? "#e9ebe4",
    hasEntry: messages.length > 0,
  };
}
