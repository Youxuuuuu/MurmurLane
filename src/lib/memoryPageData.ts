import { pageModeMeta, xiaoyeModeMeta } from "../config/pageModes";
import { monthColors, monthPales } from "../config/theme";
import { emptyRemoteData } from "../data/emptyRemoteData";
import {
  dailySummaryEntries,
  diaryEntries,
  letterEntries,
  staticModeEntries,
} from "../data/mockEntries";
import type { RemoteData } from "../types/api";
import type {
  DatedMemoryEntries,
  MemoryEntry,
  MemoryMode,
  XiaoyeMode,
} from "../types/memory";
import { buildContentPath, getDateParts, toDotDate, toHyphenDate } from "./date";

const BLANK_TITLE = `${String.fromCharCode(0x0295)}  ${String.fromCharCode(0x2022)}${String.fromCharCode(0x058a)} ${String.fromCharCode(0x2022)}${String.fromCharCode(0x0294)}…… ${String.fromCharCode(0xa9de)}`;

export function getRemoteEntryByDate(
  entries: DatedMemoryEntries,
  dateText: string,
): MemoryEntry | null {
  const dotDate = toDotDate(dateText);
  return entries[dotDate] ?? entries[toHyphenDate(dotDate)] ?? null;
}

export function getRemoteDatedEntriesSource(
  mode: string,
  remoteData: RemoteData = emptyRemoteData,
): DatedMemoryEntries {
  if (mode === "Diary")
    return { ...remoteData.searchCache.diary, ...remoteData.diaryEntries };
  if (mode === "DailySummary")
    return {
      ...remoteData.searchCache.dailySummary,
      ...remoteData.dailySummaryEntries,
    };
  if (mode === "Letters")
    return { ...remoteData.searchCache.letters, ...remoteData.letterEntries };
  return {};
}

export function getDatedEntriesSource(
  mode: string,
  remoteData: RemoteData = emptyRemoteData,
): DatedMemoryEntries {
  if (mode === "Diary")
    return {
      ...diaryEntries,
      ...remoteData.searchCache.diary,
      ...remoteData.diaryEntries,
    };
  if (mode === "DailySummary")
    return {
      ...dailySummaryEntries,
      ...remoteData.searchCache.dailySummary,
      ...remoteData.dailySummaryEntries,
    };
  if (mode === "Letters")
    return {
      ...letterEntries,
      ...remoteData.searchCache.letters,
      ...remoteData.letterEntries,
    };
  return {};
}

export function getStaticEntryForMode(
  mode: string,
  remoteData: RemoteData = emptyRemoteData,
): MemoryEntry {
  return (
    remoteData.staticModeEntries[mode] ??
    staticModeEntries[mode] ??
    staticModeEntries.Facts
  );
}

export function createBlankEntry(mode = "Diary"): MemoryEntry {
  return {
    title: BLANK_TITLE,
    excerpt: "",
    blankText:
      mode === "DailySummary"
        ? "摘要库存不足，请呼唤家机速速补货......"
        : mode === "Letters"
          ? "来信显示无，呼唤家机盖戳寄信......"
          : "日记库存不足，请呼唤家机速速补货......",
    sections: [],
  };
}

export function createBlankXiaoyeEntry(mode = "Ins"): MemoryEntry {
  const modeMeta = xiaoyeModeMeta[mode] ?? xiaoyeModeMeta.Ins;

  return {
    title: modeMeta.title,
    excerpt: "",
    blankText: "小叶档案还没有补货......",
    sections: [],
  };
}

export function getEntryForMode(
  mode: string,
  dateText: string,
  remoteData: RemoteData = emptyRemoteData,
) {
  const remoteEntry =
    mode === "Diary"
      ? getRemoteEntryByDate(
          getRemoteDatedEntriesSource("Diary", remoteData),
          dateText,
        )
      : mode === "DailySummary"
        ? getRemoteEntryByDate(
            getRemoteDatedEntriesSource("DailySummary", remoteData),
            dateText,
          )
        : mode === "Letters"
          ? getRemoteEntryByDate(
              getRemoteDatedEntriesSource("Letters", remoteData),
              dateText,
            )
          : null;

  if (remoteEntry) {
    return {
      entry: remoteEntry,
      hasEntry: true,
    };
  }

  if (mode === "Diary")
    return {
      entry: diaryEntries[dateText] ?? createBlankEntry(mode),
      hasEntry: Boolean(diaryEntries[dateText]),
    };
  if (mode === "DailySummary")
    return {
      entry: dailySummaryEntries[dateText] ?? createBlankEntry(mode),
      hasEntry: Boolean(dailySummaryEntries[dateText]),
    };
  if (mode === "Letters")
    return {
      entry: letterEntries[dateText] ?? createBlankEntry(mode),
      hasEntry: Boolean(letterEntries[dateText]),
    };
  return {
    entry: getStaticEntryForMode(mode, remoteData),
    hasEntry: true,
  };
}

export function getXiaoyeEntryForMode(
  mode: string,
  remoteData: RemoteData = emptyRemoteData,
) {
  const entry = remoteData.xiaoyeEntries[mode] ?? null;

  return {
    entry: entry ?? createBlankXiaoyeEntry(mode),
    hasEntry: Boolean(entry),
  };
}

export function hasDatedEntry(
  dateText: string,
  mode = "Diary",
  remoteData: RemoteData = emptyRemoteData,
  helpers: {
    hasConversationForDate: (
      dateText: string,
      threadId: string | null,
      remoteData?: RemoteData,
    ) => boolean;
    getTimelineDay: (dateText: string, remoteData?: RemoteData) => {
      events: unknown[];
    };
  },
): boolean {
  if (mode === "Conversation")
    return helpers.hasConversationForDate(dateText, null, remoteData);
  if (mode === "Timeline")
    return Boolean(helpers.getTimelineDay(dateText, remoteData).events.length);
  if (mode === "DailySummary")
    return Boolean(
      getRemoteEntryByDate(
        getRemoteDatedEntriesSource("DailySummary", remoteData),
        dateText,
      ) ?? dailySummaryEntries[dateText],
    );
  if (mode === "Letters")
    return Boolean(
      getRemoteEntryByDate(
        getRemoteDatedEntriesSource("Letters", remoteData),
        dateText,
      ) ?? letterEntries[dateText],
    );
  return Boolean(
    getRemoteEntryByDate(
      getRemoteDatedEntriesSource("Diary", remoteData),
      dateText,
    ) ??
      diaryEntries[dateText],
  );
}

export function hasCalendarMarkForPage(
  page: Record<string, any>,
  dateText: string,
  remoteData: RemoteData = page.remoteData ?? emptyRemoteData,
  helpers: {
    hasConversationForDate: (
      dateText: string,
      threadId: string | null,
      remoteData?: RemoteData,
    ) => boolean;
    hasRemoteDateIndexMark: (
      pageMode: string,
      dateText: string,
      remoteData?: RemoteData,
    ) => boolean | null;
    getTimelineDay: (dateText: string, remoteData?: RemoteData) => {
      events: unknown[];
    };
  },
): boolean {
  if (page.mode === "Conversation") {
    return helpers.hasConversationForDate(dateText, page.threadId, remoteData);
  }

  const indexedMark = helpers.hasRemoteDateIndexMark(
    page.mode,
    dateText,
    remoteData,
  );
  if (indexedMark != null) {
    return indexedMark;
  }

  if (page.mode === "Timeline") {
    return Boolean(helpers.getTimelineDay(dateText, remoteData).events.length);
  }

  if (page.mode === "Diary") {
    return Boolean(
      getRemoteEntryByDate(
        getRemoteDatedEntriesSource("Diary", remoteData),
        dateText,
      ) ?? diaryEntries[dateText],
    );
  }

  if (page.mode === "DailySummary") {
    return Boolean(
      getRemoteEntryByDate(
        getRemoteDatedEntriesSource("DailySummary", remoteData),
        dateText,
      ) ?? dailySummaryEntries[dateText],
    );
  }

  if (page.mode === "Letters") {
    return Boolean(
      getRemoteEntryByDate(
        getRemoteDatedEntriesSource("Letters", remoteData),
        dateText,
      ) ?? letterEntries[dateText],
    );
  }

  return false;
}

export function buildMemoryPage(
  styleTheme: Record<string, unknown>,
  dateText: string,
  mode: string = "Diary",
  remoteData: RemoteData = emptyRemoteData,
) {
  const { month, day } = getDateParts(dateText);
  const { entry, hasEntry } = getEntryForMode(mode, dateText, remoteData);
  const modeMeta = pageModeMeta[mode] ?? pageModeMeta.Diary;
  return {
    ...styleTheme,
    ...entry,
    remoteData,
    mode,
    modeTitle: modeMeta.title,
    dateBased: modeMeta.dateBased,
    sourcePath: buildContentPath(mode, dateText),
    date: dateText,
    month,
    day,
    color: monthColors[month] ?? "#667064",
    pale: monthPales[month] ?? "#e9ebe4",
    hasEntry,
  };
}

export function buildXiaoyePage(
  styleTheme: Record<string, unknown>,
  dateText: string,
  mode: XiaoyeMode = "Ins",
  remoteData: RemoteData = emptyRemoteData,
) {
  const { month, day } = getDateParts(dateText);
  const modeMeta = xiaoyeModeMeta[mode] ?? xiaoyeModeMeta.Ins;
  const { entry, hasEntry } = getXiaoyeEntryForMode(mode, remoteData);

  return {
    ...styleTheme,
    ...entry,
    remoteData,
    mode: "Xiaoye",
    xiaoyeMode: mode,
    modeTitle: modeMeta.title,
    dateBased: false,
    sourcePath: modeMeta.sourcePath,
    date: dateText,
    month,
    day,
    color: monthColors[month] ?? "#667064",
    pale: monthPales[month] ?? "#e9ebe4",
    hasEntry,
  };
}
