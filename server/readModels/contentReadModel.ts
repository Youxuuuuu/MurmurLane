import { readdir, stat } from "node:fs/promises";
import type { ServerAccess } from "../fileLoaders.js";
import { readJsonLinesFile } from "../fileLoaders.js";
import type {
  ConversationRecord,
  DateIndexResponse,
} from "../types.js";

interface ConversationFileSnapshot {
  date: string;
  fileName: string;
  size: number;
  mtimeMs: number;
}

function elapsedMs(startedAt: bigint) {
  return Number((process.hrtime.bigint() - startedAt) / 1_000_000n);
}

function normalizeIndexedDate(value: string) {
  const normalized = String(value).trim().replace(/\./g, "-");
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized)
    ? normalized
    : "";
}

function sortUniqueDates(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(
    value && typeof value === "object" && !Array.isArray(value),
  );
}

function getTimelineFacts(data: unknown) {
  if (!isRecord(data)) return null;
  return isRecord(data.facts) ? data.facts : data;
}

export function filterTimelineData(
  data: unknown,
  predicate: (date: string) => boolean,
) {
  if (!isRecord(data)) return data;
  const facts = getTimelineFacts(data);
  const filteredFacts = facts
    ? Object.fromEntries(
        Object.entries(facts).filter(([key, value]) => {
          const normalizedDate = normalizeIndexedDate(key);
          return Boolean(
            normalizedDate &&
              predicate(normalizedDate) &&
              isRecord(value) &&
              Array.isArray(value.events),
          );
        }),
      )
    : {};
  return isRecord(data.facts)
    ? { ...data, facts: filteredFacts }
    : filteredFacts;
}

export function createContentReadModel(access: ServerAccess) {
  let conversationIndexCache: {
    signature: string;
    dates: string[];
    conversationThreads: Record<string, string[]>;
  } | null = null;
  let timelineStateCache: {
    signature: string;
    data: unknown;
  } | null = null;

  const getConversationFileSnapshots = async () => {
    const directoryPath = access.resolveDataPath("conversations");
    try {
      const entries = await readdir(directoryPath, {
        withFileTypes: true,
      });
      const snapshots = await Promise.all(
        entries
          .filter((entry) => entry.isFile())
          .map(async (entry) => {
            const date =
              entry.name.match(
                /^(\d{4}-\d{2}-\d{2})\.jsonl$/,
              )?.[1] || "";
            if (!date) return null;
            const filePath = access.resolveDataPath(
              "conversations",
              entry.name,
            );
            const fileStat = await stat(filePath);
            return {
              date,
              fileName: entry.name,
              size: fileStat.size,
              mtimeMs: fileStat.mtimeMs,
            } satisfies ConversationFileSnapshot;
          }),
      );
      return snapshots
        .filter(
          (item): item is ConversationFileSnapshot =>
            Boolean(item),
        )
        .sort((left, right) =>
          left.date.localeCompare(right.date),
        );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  };

  const getConversationIndex = async () => {
    const startedAt = process.hrtime.bigint();
    const snapshots = await getConversationFileSnapshots();
    const signature = snapshots
      .map(
        (item) =>
          `${item.date}:${item.size}:${item.mtimeMs}`,
      )
      .join("|");
    if (conversationIndexCache?.signature === signature) {
      return conversationIndexCache;
    }
    const threadDates: Record<string, string[]> = {};
    await Promise.all(
      snapshots.map(async ({ date, fileName }) => {
        try {
          const result =
            await readJsonLinesFile<ConversationRecord>(
              access.resolveDataPath(
                "conversations",
                fileName,
              ),
            );
          result.records.forEach((record) => {
            const threadId =
              typeof record.threadId === "string"
                ? record.threadId.trim()
                : "";
            if (!threadId) return;
            (threadDates[threadId] ??= []).push(date);
          });
        } catch (error) {
          console.warn(
            `[cyberboss-api] failed to index conversation file for ${date}`,
            error,
          );
        }
      }),
    );
    const dates = sortUniqueDates(
      snapshots.map((item) => item.date),
    );
    const conversationThreads = Object.fromEntries(
      Object.entries(threadDates)
        .map(
          ([threadId, dates]): [string, string[]] => [
            threadId,
            sortUniqueDates(dates),
          ],
        )
        .sort(([left], [right]) =>
          left.localeCompare(right),
        ),
    );
    conversationIndexCache = {
      signature,
      dates,
      conversationThreads,
    };
    console.info(
      `[cyberboss-api] /api/index/dates conversations-cache refresh files=${snapshots.length} dates=${dates.length} ms=${elapsedMs(startedAt)}`,
    );
    return conversationIndexCache;
  };

  const getTimelineState = async () => {
    const startedAt = process.hrtime.bigint();
    const filePath = access.resolveDataPath(
      "timeline",
      "timeline-state.json",
    );
    let fileStat;
    try {
      fileStat = await stat(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        timelineStateCache = null;
        return { found: false, data: null };
      }
      throw error;
    }
    const signature = `${fileStat.size}:${fileStat.mtimeMs}`;
    if (timelineStateCache?.signature === signature) {
      return { found: true, data: timelineStateCache.data };
    }
    const result = await access.readDataJsonFile<unknown>(
      "timeline",
      "timeline-state.json",
    );
    if (!result.found) {
      timelineStateCache = null;
      return { found: false, data: null };
    }
    timelineStateCache = { signature, data: result.data };
    console.info(
      `[cyberboss-api] /api/timeline cache refresh size=${fileStat.size} ms=${elapsedMs(startedAt)}`,
    );
    return { found: true, data: result.data };
  };

  const getDateIndex = async (): Promise<DateIndexResponse> => {
    const [
      conversationIndex,
      diaryFiles,
      dailySummaryFiles,
      letterFiles,
      timeline,
    ] = await Promise.all([
      getConversationIndex(),
      access.listDataFileNames("diary"),
      access.listDataFileNames("memory", "daily-summary"),
      access.listDataFileNames("memory", "letters"),
      access.readDataJsonFile<
        Record<string, { events?: unknown[] }>
      >("timeline", "timeline-state.json"),
    ]);
    const datesFrom = (files: string[], pattern: RegExp) =>
      files
        .map((fileName) => fileName.match(pattern)?.[1] || "")
        .filter(Boolean);
    const timelineFacts =
      timeline.found &&
      timeline.data &&
      typeof timeline.data === "object"
        ? timeline.data.facts ?? timeline.data
        : null;
    const timelineDates = timelineFacts
      ? Object.entries(timelineFacts)
          .filter(([, value]) => {
            if (!value || typeof value !== "object") return false;
            const events = (value as { events?: unknown }).events;
            return Array.isArray(events) && events.length > 0;
          })
          .map(([key]) => normalizeIndexedDate(key))
          .filter(Boolean)
      : [];
    return {
      conversations: conversationIndex.dates,
      conversationThreads:
        conversationIndex.conversationThreads,
      diary: sortUniqueDates(
        datesFrom(
          diaryFiles,
          /^(\d{4}-\d{2}-\d{2})\.md$/,
        ),
      ),
      dailySummary: sortUniqueDates(
        datesFrom(
          dailySummaryFiles,
          /^daily-summary-(\d{4}-\d{2}-\d{2})\.md$/,
        ),
      ),
      letters: sortUniqueDates(
        datesFrom(
          letterFiles,
          /^(\d{4}-\d{2}-\d{2})\.md$/,
        ),
      ),
      timeline: sortUniqueDates(timelineDates),
    };
  };

  return Object.freeze({
    getConversationIndex,
    getTimelineState,
    getDateIndex,
    invalidateTimeline() {
      timelineStateCache = null;
    },
  });
}
