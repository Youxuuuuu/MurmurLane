import {
  getConversationDisplayText,
  getConversationQuoteText,
} from "./conversation";
import type { ConversationRecord } from "../types/conversation";

function normalizeMergeText(value: unknown) {
  return String(value ?? "")
    .replace(/^\[Quoted:\s*[^\]]+\]\s*/i, "")
    .replace(/[\*_~`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getMediaSignature(message: ConversationRecord) {
  return [
    message?.meta?.attachments,
    message?.meta?.files,
    message?.meta?.stickers,
  ]
    .flatMap((items) => (Array.isArray(items) ? items : []))
    .map((item) =>
      [
        item?.kind,
        item?.fileName,
        item?.relativePath,
        item?.path,
        item?.url,
        item?.sizeBytes,
      ]
        .map((value) => String(value ?? "").trim())
        .join("~"),
    )
    .join(";");
}

function getMediaIdentityTokens(message: ConversationRecord) {
  return [
    message?.meta?.attachments,
    message?.meta?.files,
    message?.meta?.stickers,
  ]
    .flatMap((items) => (Array.isArray(items) ? items : []))
    .flatMap((item) => {
      const pathName = String(
        item?.relativePath || item?.path || item?.url || "",
      )
        .replace(/\\/g, "/")
        .split("/")
        .pop();
      return [item?.mediaKey, item?.fileName, pathName]
        .map((value) => String(value ?? "").trim().toLowerCase())
        .filter(Boolean);
    });
}

function getSourceKey(message: ConversationRecord) {
  const source = (message?.source || {}) as Record<string, unknown>;
  return String(
    message?.meta?.sourceKey || source.sourceKey || "",
  ).trim();
}

function getMessageId(message: ConversationRecord) {
  return String(message?.meta?.messageId || "").trim();
}

function getThreadId(message: ConversationRecord, selectedThreadId: string) {
  return String(message?.threadId || selectedThreadId || "").trim();
}

function getRecordType(message: ConversationRecord) {
  return String(message?.type || message?.role || "record").trim();
}

function getConversationDateFromRecord(message: ConversationRecord) {
  const explicitDate = String(
    message?.conversationDate || message?.date || "",
  ).trim();
  if (explicitDate) return explicitDate.replace(/-/g, ".");

  const timestamp = message?.timestamp || message?.createdAt;
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return values.year && values.month && values.day
    ? `${values.year}.${values.month}.${values.day}`
    : "";
}

export function getConversationMergeKey(
  message: ConversationRecord,
  selectedThreadId = "",
) {
  const type = getRecordType(message);
  const threadId = getThreadId(message, selectedThreadId);
  const uiMergeKey = String(message?.meta?.uiMergeKey || "").trim();
  if (uiMergeKey) {
    return uiMergeKey;
  }
  const sourceKey = getSourceKey(message);
  // One runtime turn can contain more than one assistant record (for example
  // an internal "No response requested" placeholder followed by the actual
  // answer). Canonical source rows are distinct messages and must never be
  // collapsed merely because their turnId matches.
  if (type === "assistant" && sourceKey) {
    return `source:${sourceKey}`;
  }
  const turnId = String(message?.turnId || "").trim();
  if (type === "assistant" && turnId) {
    // A streamed reply and the persisted/final reply can have different text
    // and different IDs. The runtime turn is their stable identity.
    return `assistant:turn:${threadId}:${turnId}`;
  }

  const messageId = getMessageId(message);
  if (messageId) {
    return `${type}:message:${messageId}`;
  }

  if (sourceKey) {
    return `source:${sourceKey}`;
  }

  const recordId = String(message?.id || "").trim();
  if (recordId) {
    return `${type}:id:${recordId}`;
  }

  const text = normalizeMergeText(
    getConversationDisplayText(message) || message?.text,
  );
  const quote = normalizeMergeText(getConversationQuoteText(message));
  const media = getMediaSignature(message);
  return [
    type,
    threadId,
    message?.timestamp || message?.createdAt || "",
    text,
    quote,
    media,
    message?.id || "",
  ].join(":");
}

function hasCanonicalSource(message: ConversationRecord) {
  return Boolean(getSourceKey(message));
}

function isEphemeral(message: ConversationRecord) {
  return Boolean(message?.meta?.ephemeral);
}

function isStreaming(message: ConversationRecord) {
  return Boolean(message?.meta?.streaming);
}

function isWebChatBridgeRecord(message: ConversationRecord) {
  return Boolean(
    isEphemeral(message) ||
      /^web-(?:inbound|assistant|stream)-/i.test(String(message?.id || "")),
  );
}

function recordsRepresentSameMessage(
  canonical: ConversationRecord,
  live: ConversationRecord,
  selectedThreadId: string,
) {
  if (!hasCanonicalSource(canonical) || !isWebChatBridgeRecord(live)) {
    return false;
  }

  if (getRecordType(canonical) !== getRecordType(live)) return false;
  if (
    getThreadId(canonical, selectedThreadId) !==
    getThreadId(live, selectedThreadId)
  ) {
    return false;
  }

  const canonicalTurnId = String(canonical?.turnId || "").trim();
  const liveTurnId = String(live?.turnId || "").trim();
  const canonicalText = normalizeMergeText(
    getConversationDisplayText(canonical) || canonical?.text,
  );
  const liveText = normalizeMergeText(
    getConversationDisplayText(live) || live?.text,
  );
  const canonicalQuote = normalizeMergeText(getConversationQuoteText(canonical));
  const liveQuote = normalizeMergeText(getConversationQuoteText(live));
  const canonicalSourceKey = getSourceKey(canonical);
  const liveSourceKey = getSourceKey(live);

  if (canonicalSourceKey && liveSourceKey && canonicalSourceKey === liveSourceKey) {
    return true;
  }

  if (
    canonicalTurnId &&
    liveTurnId &&
    canonicalTurnId === liveTurnId &&
    (!canonicalText || !liveText ||
      (canonicalText === liveText &&
        (!canonicalQuote || !liveQuote || canonicalQuote === liveQuote)))
  ) {
    return true;
  }

  const canonicalTime = getRecordSortTime(canonical);
  const liveTime = getRecordSortTime(live);
  if (
    !Number.isFinite(canonicalTime) ||
    !Number.isFinite(liveTime) ||
    Math.abs(canonicalTime - liveTime) > 65_000
  ) {
    return false;
  }

  if (canonicalText && canonicalText === liveText) {
    return !canonicalQuote || !liveQuote || canonicalQuote === liveQuote;
  }

  if (canonicalText || liveText) return false;

  const canonicalMedia = new Set(getMediaIdentityTokens(canonical));
  const liveMedia = getMediaIdentityTokens(live);
  return Boolean(
    canonicalMedia.size &&
      liveMedia.some((identity) => canonicalMedia.has(identity)),
  );
}

function removeArchivedWebChatCopies(
  records: ConversationRecord[],
  selectedThreadId: string,
) {
  // A live bridge event can already carry source metadata. It must not count
  // as its own archived replacement or it would be filtered out immediately.
  const canonicalRecords = records.filter(
    (record) => hasCanonicalSource(record) && !isWebChatBridgeRecord(record),
  );
  if (!canonicalRecords.length) return records;

  // Keep the visual identity from the realtime copy when its archived version
  // arrives. Without this, React sees the live record disappear and a source
  // record mount in its place, which restarts a message-enter animation even
  // though it is the same chat bubble.
  const archivedUiKeys = new Map<ConversationRecord, string>();
  const bridgeRecordsToRemove = new Set<ConversationRecord>();

  records.forEach((record) => {
    if (!isWebChatBridgeRecord(record)) return;
    const canonical = canonicalRecords.find((candidate) =>
      recordsRepresentSameMessage(candidate, record, selectedThreadId),
    );
    if (!canonical) return;

    bridgeRecordsToRemove.add(record);
    if (!archivedUiKeys.has(canonical)) {
      archivedUiKeys.set(
        canonical,
        getConversationMergeKey(record, selectedThreadId),
      );
    }
  });

  return records.flatMap((record) => {
    if (bridgeRecordsToRemove.has(record)) return [];

    const uiMergeKey = archivedUiKeys.get(record);
    if (!uiMergeKey || record?.meta?.uiMergeKey) return [record];

    return [
      {
        ...record,
        meta: {
          ...(record.meta || {}),
          uiMergeKey,
        },
      },
    ];
  });
}

function shouldPreferCandidate(
  existing: ConversationRecord,
  candidate: ConversationRecord,
) {
  if (isEphemeral(existing) !== isEphemeral(candidate)) {
    return !isEphemeral(candidate);
  }

  if (isStreaming(existing) !== isStreaming(candidate)) {
    return !isStreaming(candidate);
  }

  if (hasCanonicalSource(existing) !== hasCanonicalSource(candidate)) {
    return hasCanonicalSource(candidate);
  }

  return false;
}

function getSourceOrder(message: ConversationRecord) {
  const sourceKey = getSourceKey(message);
  const sourceKeyParts = sourceKey.split("|");
  const source = (message?.source || {}) as Record<string, unknown>;
  const sourceFile = String(
    source.sourceFile || sourceKeyParts[1] || "",
  )
    .replace(/\\/g, "/")
    .trim()
    .toLowerCase();
  const directLine = Number(source.sourceLine);
  const sourceKeyLine = Number(sourceKeyParts[2]);
  const sourceLine =
    Number.isFinite(directLine) && directLine > 0
      ? directLine
      : Number.isFinite(sourceKeyLine) && sourceKeyLine > 0
        ? sourceKeyLine
        : 0;

  return { sourceFile, sourceLine };
}

function compareMergedRecords(
  left: { message: ConversationRecord; index: number },
  right: { message: ConversationRecord; index: number },
) {
  const leftDate = getConversationDateFromRecord(left.message).replace(/\./g, "-");
  const rightDate = getConversationDateFromRecord(right.message).replace(/\./g, "-");
  if (leftDate && rightDate && leftDate !== rightDate) {
    return leftDate.localeCompare(rightDate);
  }

  const leftSource = getSourceOrder(left.message);
  const rightSource = getSourceOrder(right.message);
  // Runtime events can arrive late: a later user event may carry an earlier
  // wall-clock timestamp than the thinking/final pair it follows. For records
  // from the same raw session file, the original JSONL line is the only stable
  // conversation order, so it must win before arrival timestamps.
  if (
    leftSource.sourceFile &&
    leftSource.sourceFile === rightSource.sourceFile &&
    leftSource.sourceLine > 0 &&
    rightSource.sourceLine > 0 &&
    leftSource.sourceLine !== rightSource.sourceLine
  ) {
    return leftSource.sourceLine - rightSource.sourceLine;
  }

  const leftTime = getRecordSortTime(left.message);
  const rightTime = getRecordSortTime(right.message);
  if (
    Number.isFinite(leftTime) &&
    Number.isFinite(rightTime) &&
    leftTime !== rightTime
  ) {
    return leftTime - rightTime;
  }

  return left.index - right.index;
}

function getRecordSortTime(message: ConversationRecord) {
  const timestampTime = Date.parse(
    message?.timestamp || message?.createdAt || "",
  );
  if (Number.isFinite(timestampTime)) return timestampTime;

  const dateText = String(message?.conversationDate || "").replace(/\./g, "-");
  const clock = String(message?.time || "").match(/^(\d{1,2}):(\d{2})/)?.[0];
  if (dateText && clock) {
    const clockTime = Date.parse(`${dateText}T${clock}:00+08:00`);
    if (Number.isFinite(clockTime)) return clockTime;
  }

  if (dateText) {
    const dateTime = Date.parse(`${dateText}T23:59:59.999+08:00`);
    if (Number.isFinite(dateTime)) return dateTime;
  }

  return Number.NEGATIVE_INFINITY;
}

export function mergeConversationRecords(
  records: ConversationRecord[] = [],
  selectedThreadId = "",
) {
  const byKey = new Map<
    string,
    { message: ConversationRecord; index: number }
  >();

  const reconciledRecords = removeArchivedWebChatCopies(
    records.filter(Boolean),
    selectedThreadId,
  );

  reconciledRecords.forEach((record, index) => {
    if (!record) return;
    const nextRecord = {
      ...record,
      threadId: record.threadId || selectedThreadId,
      conversationDate:
        getConversationDateFromRecord(record) || record.conversationDate,
    };
    const key = getConversationMergeKey(nextRecord, selectedThreadId);
    const existing = byKey.get(key);
    if (
      !existing ||
      shouldPreferCandidate(existing.message, nextRecord)
    ) {
      byKey.set(key, { message: nextRecord, index });
    }
  });

  return Array.from(byKey.values())
    .sort(compareMergedRecords)
    .map(({ message }) => message);
}
