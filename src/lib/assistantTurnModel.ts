import type { ConversationRecord } from "../types/conversation";
import {
  createBubbleId,
  getAssistantTurnRenderId,
  getConversationDisplayTurnId,
  getConversationThreadId,
  getConversationRenderId,
} from "./conversationIdentity";

export interface ConversationDisplayRecordEntry {
  record: ConversationRecord;
  index: number;
}

export interface ConversationRecordDisplayItem {
  kind: "record";
  renderId: string;
  entry: ConversationDisplayRecordEntry;
  firstIndex: number;
}

export interface AssistantTurnDisplayItem {
  kind: "assistant-turn";
  renderId: string;
  thinkingPanelId: string;
  threadId: string;
  turnId: string;
  entries: ConversationDisplayRecordEntry[];
  thinkingRecords: ConversationRecord[];
  firstIndex: number;
}

export type ConversationDisplayItem =
  | ConversationRecordDisplayItem
  | AssistantTurnDisplayItem;

function isAssistantTurnRecord(record: ConversationRecord) {
  const type = String(record.type || record.role || "").trim();
  return type === "thinking" || type === "assistant" || type === "operation";
}

export function getRecordAssistantTurnRenderId(
  record: ConversationRecord,
  selectedThreadId = "",
) {
  if (!isAssistantTurnRecord(record)) return "";
  return getAssistantTurnRenderId(
    getConversationThreadId(record, selectedThreadId),
    getConversationDisplayTurnId(record),
  );
}

export function buildAssistantTurnDisplayModel(
  records: ConversationRecord[],
  selectedThreadId = "",
  startIndex = 0,
): ConversationDisplayItem[] {
  const items: ConversationDisplayItem[] = [];
  const turns = new Map<string, AssistantTurnDisplayItem>();

  records.forEach((record, localIndex) => {
    const index = startIndex + localIndex;
    const turnRenderId = getRecordAssistantTurnRenderId(record, selectedThreadId);
    if (!turnRenderId) {
      items.push({
        kind: "record",
        renderId: getConversationRenderId(record, selectedThreadId),
        entry: { record, index },
        firstIndex: index,
      });
      return;
    }

    let turn = turns.get(turnRenderId);
    if (!turn) {
      const threadId = getConversationThreadId(record, selectedThreadId);
      const turnId = getConversationDisplayTurnId(record);
      turn = {
        kind: "assistant-turn",
        renderId: turnRenderId,
        thinkingPanelId: createBubbleId(turnRenderId, "thinking-panel"),
        threadId,
        turnId,
        entries: [],
        thinkingRecords: [],
        firstIndex: index,
      };
      turns.set(turnRenderId, turn);
      items.push(turn);
    }
    turn.entries.push({ record, index });
    if (String(record.type || record.role || "").trim() === "thinking") {
      turn.thinkingRecords.push(record);
    }
  });

  return items;
}

export function expandRangeToAssistantTurnBoundaries(
  records: ConversationRecord[],
  range: { start: number; end: number },
  selectedThreadId = "",
) {
  let start = Math.max(0, Math.min(range.start, records.length));
  let end = Math.max(start, Math.min(range.end, records.length));
  const startTurn = start < records.length
    ? getRecordAssistantTurnRenderId(records[start], selectedThreadId)
    : "";
  while (
    startTurn
    && start > 0
    && getRecordAssistantTurnRenderId(records[start - 1], selectedThreadId) === startTurn
  ) {
    start -= 1;
  }
  const endTurn = end > 0
    ? getRecordAssistantTurnRenderId(records[end - 1], selectedThreadId)
    : "";
  while (
    endTurn
    && end < records.length
    && getRecordAssistantTurnRenderId(records[end], selectedThreadId) === endTurn
  ) {
    end += 1;
  }
  return { start, end };
}
