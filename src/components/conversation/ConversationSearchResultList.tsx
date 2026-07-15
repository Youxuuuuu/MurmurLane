import { useMemo } from "react";
import {
  getConversationDisplayText,
  getConversationQuoteText,
  getConversationVisualKind,
} from "../../lib/conversation";
import type { ConversationRecord } from "../../types/conversation";
import type {
  ConversationIdentity,
  ConversationThreadProfile,
} from "../../lib/conversationProfiles";
import { groupConversationDisplayRecords } from "../../lib/conversationDisplayGroups";
import { ChatBubble } from "./ChatBubble";

function normalizeDate(value: unknown) {
  return String(value ?? "").replace(/-/g, ".");
}

function formatDate(value: unknown) {
  const [year, month, day] = normalizeDate(value).split(".");
  return year && month && day ? `${year}/${month}/${day}` : "";
}

function getMatchedBubbleRecord(record: ConversationRecord, query: string) {
  const visualKind = getConversationVisualKind(record);
  if (!["user", "assistant", "system"].includes(visualKind)) return record;

  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return record;

  const findMatchedLine = (text: string) =>
    String(text ?? "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.toLocaleLowerCase().includes(normalizedQuery));
  const matchedLine =
    findMatchedLine(getConversationDisplayText(record)) ||
    findMatchedLine(getConversationQuoteText(record));

  if (!matchedLine) return record;

  return {
    ...record,
    text: matchedLine,
    meta: {
      ...record.meta,
      quote: undefined,
      ...(visualKind === "system" ? { displayText: matchedLine } : {}),
    },
  };
}

export function ConversationSearchResultList({
  page,
  query,
  results,
  userProfile,
  threadProfiles,
  fallbackThreadProfile,
  showThreadLabel = false,
  onEditThread,
  onSelectResult,
}: {
  page: Record<string, any>;
  query: string;
  results: ConversationRecord[];
  userProfile: ConversationIdentity;
  threadProfiles?: Record<string, ConversationThreadProfile>;
  fallbackThreadProfile?: ConversationThreadProfile;
  showThreadLabel?: boolean;
  onEditThread?: (threadId?: string) => void;
  onSelectResult: (record: ConversationRecord) => void | Promise<void>;
}) {
  const groupedResults = useMemo(
    () => groupConversationDisplayRecords(results),
    [results],
  );
  const displayResults = useMemo(
    () => groupedResults.map((record) => getMatchedBubbleRecord(record, query)),
    [groupedResults, query],
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-end px-1 text-[10px] text-black/[0.28]">
        <span>{displayResults.length} 条结果</span>
      </div>
      {displayResults.map((record, index) => {
        const date = normalizeDate(record.conversationDate);
        const previousDate = normalizeDate(
          displayResults[index - 1]?.conversationDate,
        );
        const threadId = String(record.threadId || "");
        const threadProfile =
          threadProfiles?.[threadId] || fallbackThreadProfile;

        if (!threadProfile) return null;

        return (
          <div key={`${date}-${record.id || index}`}>
            {date && date !== previousDate && (
              <div className="mb-4 mt-6 text-center text-[11px] font-semibold tracking-[0.04em] text-black/[0.28]">
                {formatDate(date)}
              </div>
            )}
            {showThreadLabel && (
              <div className="mb-1 ml-12 text-[10px] font-semibold text-black/30">
                {threadProfile.name}
              </div>
            )}
            <div
              role="button"
              tabIndex={0}
              onClick={(event) => {
                if ((event.target as HTMLElement).closest("button")) return;
                onSelectResult(record);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectResult(record);
                }
              }}
              className="mb-5 rounded-[7px] px-1 py-1 outline-none transition focus:bg-[#b9c8d2]/[0.10]"
              aria-label={`跳转到 ${formatDate(date)} 的搜索结果`}
            >
              <ChatBubble
                message={record}
                page={page}
                messages={displayResults}
                userProfile={userProfile}
                threadProfile={threadProfile}
                onEditThread={() => onEditThread?.(threadId)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
