import { shouldHideConversationRecord } from "../../lib/conversation";
import { groupConversationDisplayRecords } from "../../lib/conversationDisplayGroups";
import { getConversationRenderId } from "../../lib/conversationIdentity";
import { mergeConversationRecords } from "../../lib/conversationMerge";
import {
  buildAssistantTurnDisplayModel,
  expandRangeToAssistantTurnBoundaries,
  type ConversationDisplayItem,
} from "../../lib/assistantTurnModel";
import type { ConversationRecord } from "../../types/conversation";

export interface BuildConversationTranscriptInput {
  canonicalRecords: readonly ConversationRecord[];
  liveRecords?: readonly ConversationRecord[];
  threadId?: string;
}

export interface ConversationTranscript {
  threadId: string;
  records: ConversationRecord[];
  recordRenderIds: string[];
}

export interface ConversationTranscriptRange {
  start: number;
  end: number;
}

export interface ConversationTranscriptWindow {
  range: ConversationTranscriptRange;
  records: ConversationRecord[];
  displayItems: ConversationDisplayItem[];
}

export function buildConversationTranscript({
  canonicalRecords,
  liveRecords = [],
  threadId = "",
}: BuildConversationTranscriptInput): ConversationTranscript {
  const mergedRecords = mergeConversationRecords(
    [...canonicalRecords, ...liveRecords],
    threadId,
  );
  const records = groupConversationDisplayRecords(
    mergedRecords.filter((record) => !shouldHideConversationRecord(record)),
  );

  return {
    threadId,
    records,
    recordRenderIds: records.map((record) =>
      getConversationRenderId(record, threadId)),
  };
}

export function selectConversationTranscriptWindow(
  transcript: ConversationTranscript,
  requestedRange: ConversationTranscriptRange,
): ConversationTranscriptWindow {
  const range = expandRangeToAssistantTurnBoundaries(
    transcript.records,
    requestedRange,
    transcript.threadId,
  );
  const records = transcript.records.slice(range.start, range.end);

  return {
    range,
    records,
    displayItems: buildAssistantTurnDisplayModel(
      records,
      transcript.threadId,
      range.start,
    ),
  };
}
