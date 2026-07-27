import {
  getConversationDisplayText,
  getConversationVisualKind,
  shouldHideConversationRecord,
} from "../../lib/conversation";
import { getConversationRenderId } from "../../lib/conversationIdentity";
import type { ConversationThreadProfile } from "../../lib/conversationProfiles";
import { toDotDate } from "../../lib/date";
import type { ConversationRecord } from "../../types/conversation";
import type { ConversationNotification } from "./conversationWorkspaceState";

export interface CanonicalConversationBatch {
  readonly date: string;
  readonly records: readonly ConversationRecord[];
}

export type CanonicalConversationObservation =
  | "baseline"
  | "cache-fill"
  | "background-refresh";

export interface CanonicalConversationNotification {
  readonly notification: ConversationNotification;
  readonly enqueue: boolean;
}

export interface CanonicalConversationObserver {
  observe(
    batches: readonly CanonicalConversationBatch[],
    observation: CanonicalConversationObservation,
    context: {
      readonly active: boolean;
      readonly pageMode: string;
      readonly selectedThreadId: string;
      readonly threadProfiles: Readonly<
        Record<string, ConversationThreadProfile>
      >;
      readonly now: number;
    },
  ): readonly CanonicalConversationNotification[];
}

function getRecordKey(
  date: string,
  threadId: string,
  record: ConversationRecord,
) {
  return `${toDotDate(date)}:${getConversationRenderId(record, threadId)}`;
}

function getMessagePreview(record: ConversationRecord) {
  const text = String(getConversationDisplayText(record) || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  if (text) return text;

  const labels: Partial<
    Record<ReturnType<typeof getConversationVisualKind>, string>
  > = {
    image: "[图片]",
    sticker: "[表情]",
    file: "[文件]",
    voice: "[语音]",
    music: "[音乐]",
  };
  return labels[getConversationVisualKind(record)] || "[新消息]";
}

export function createCanonicalConversationObserver(): CanonicalConversationObserver {
  const knownRecordIds = new Set<string>();
  const loadedDates = new Set<string>();
  let baselineReady = false;
  let initialBackgroundRefreshComplete = false;

  const observer: CanonicalConversationObserver = {
    observe(
      batches,
      observation,
      context,
    ) {
      const canNotify =
        observation === "background-refresh" &&
        baselineReady &&
        initialBackgroundRefreshComplete;
      const notifications: CanonicalConversationNotification[] = [];

      batches.forEach(({ date, records }) => {
        const dotDate = toDotDate(date);
        const dateWasLoaded = loadedDates.has(dotDate);
        const incomingByThread = new Map<
          string,
          ConversationRecord[]
        >();

        records.forEach((record) => {
          const threadId = String(record.threadId || "");
          if (!threadId) return;
          const recordKey = getRecordKey(
            dotDate,
            threadId,
            record,
          );
          const alreadyKnown = knownRecordIds.has(recordKey);
          knownRecordIds.add(recordKey);

          const visualKind = getConversationVisualKind(record);
          const incoming =
            canNotify &&
            dateWasLoaded &&
            !alreadyKnown &&
            (record.type === "assistant" ||
              record.role === "assistant") &&
            !shouldHideConversationRecord(record) &&
            !["thinking", "operation", "hidden"].includes(
              visualKind,
            );
          if (!incoming) return;
          const items = incomingByThread.get(threadId) ?? [];
          items.push(record);
          incomingByThread.set(threadId, items);
        });

        loadedDates.add(dotDate);
        incomingByThread.forEach((incomingRecords, threadId) => {
          const viewingThread =
            context.active &&
            context.pageMode === "chat" &&
            context.selectedThreadId === threadId;
          if (viewingThread) return;
          const profile = context.threadProfiles[threadId];
          notifications.push({
            notification: {
              threadId,
              date: dotDate,
              name:
                profile?.name ||
                `对话 ${threadId.slice(0, 6)}`,
              avatar: profile?.avatar || "",
              message: getMessagePreview(
                incomingRecords[incomingRecords.length - 1],
              ),
              count: incomingRecords.length,
              version: context.now,
            },
            enqueue: !context.active,
          });
        });
      });

      if (observation === "baseline") {
        baselineReady = true;
      }
      if (observation === "background-refresh") {
        initialBackgroundRefreshComplete = true;
      }
      return notifications;
    },
  };
  return Object.freeze(observer);
}
