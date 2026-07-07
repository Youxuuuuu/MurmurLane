import { useState } from "react";
import {
  getConversationDisplayText,
  getConversationMediaSrc,
  getConversationPrimaryMediaItem,
  getConversationQuoteText,
  getConversationVisualKind,
  getOperationDisplayPaths,
  buildCloudMusicCardData,
} from "../../lib/conversation";
import { formatConversationTime } from "../../lib/conversationPageData";
import { TinyIcon } from "../common/TinyIcon";
import { MusicShareCard } from "./MusicShareCard";

export function BubbleRow({
  message,
  children,
  side = message.type === "user" ? "right" : "left",
}) {
  const fromRight = side === "right";
  return (
    <div
      className={`flex items-end gap-2 ${fromRight ? "justify-end" : "justify-start"}`}
    >
      {fromRight && <MessageTime message={message} align="right" />}
      {children}
      {!fromRight && <MessageTime message={message} align="left" />}
    </div>
  );
}

export function MessageTime({ message, align = "left" }) {
  return (
    <span
      className={`shrink-0 pb-1 font-serif text-[9px] italic tracking-[0.1em] text-black/30 ${align === "right" ? "text-right" : "text-left"}`}
    >
      {formatConversationTime(message.timestamp)}
    </span>
  );
}

export function ChatBubble({ message, page, messages = [] }) {
  const visualKind = getConversationVisualKind(message);
  const displayText = getConversationDisplayText(message);
  const fromUser = message.type === "user";
  const quoteText = getConversationQuoteText(message);
  const primaryMediaItem = getConversationPrimaryMediaItem(message);
  const operationPaths = getOperationDisplayPaths(message);
  const [actionOpen, setActionOpen] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);

  if (visualKind === "hidden") {
    return null;
  }

  if (visualKind === "system") {
    return (
      <div className="flex justify-center py-1">
        <div
          className="border bg-white/35 px-2.5 py-1 font-mono text-[9px] tracking-[0.08em] text-black/38"
          style={{ borderColor: page.line }}
        >
          {displayText}
        </div>
      </div>
    );
  }

  if (visualKind === "music") {
    const musicData = buildCloudMusicCardData(message, messages);

    if (musicData) {
      return (
        <BubbleRow message={message} side="left">
          <MusicShareCard data={musicData} page={page} />
        </BubbleRow>
      );
    }
  }

  if (visualKind === "operation" || visualKind === "music") {
    return (
      <div className="flex justify-center py-0.5">
        <button
          type="button"
          className="max-w-[342px] px-2 text-center font-mono text-[9px] font-semibold tracking-[0.04em] text-black/42"
          onClick={() => setActionOpen((value) => !value)}
        >
          <div className="flex items-center justify-center gap-2">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: page.color }}
            />
            <span className="break-all leading-[1.25]">{displayText}</span>
          </div>
          {actionOpen && operationPaths.length > 0 && (
            <div className="mt-1 space-y-0.5 text-[8px] font-normal leading-[1.25] tracking-normal text-black/34">
              {operationPaths.map((path) => (
                <div key={path} className="break-all">
                  {path}
                </div>
              ))}
            </div>
          )}
        </button>
      </div>
    );
  }

  if (visualKind === "thinking") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[320px] bg-white/28 px-3 py-2 text-left">
          <div className="mb-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-black/35">
            <span className="h-1.5 w-1.5 rounded-full bg-black/30" />
            Thinking
          </div>
          <div className="whitespace-pre-line text-[9px] leading-[1.45] text-black/48">
            {displayText}
          </div>
        </div>
      </div>
    );
  }

  if (fromUser && quoteText) {
    return (
      <BubbleRow message={message} side="right">
        <div className="max-w-[280px] text-right">
          <div
            className="inline-block border bg-[#cbc5bb] px-2.5 py-1.5 text-left text-[11px] leading-relaxed text-white"
            style={{ borderColor: "transparent" }}
          >
            {displayText}
          </div>
          <div
            className="ml-auto mt-1 max-w-[260px] border-l-4 bg-white/35 px-2 py-1.5 text-left font-mono text-[8px] text-black/42"
            style={{ borderLeftColor: page.line }}
          >
            {quoteText}
          </div>
        </div>
      </BubbleRow>
    );
  }

  if (visualKind === "file") {
    const firstFile = primaryMediaItem;
    const fileName =
      firstFile?.fileName || firstFile?.label || displayText || "文件";
    const fileMeta =
      firstFile?.fileMeta ||
      firstFile?.relativePath ||
      firstFile?.path ||
      "FILE";

    return (
      <BubbleRow message={message} side={fromUser ? "right" : "left"}>
        <div
          className="flex max-w-[204px] items-center gap-2 border bg-white/72 px-3 py-2 text-left"
          style={{ borderColor: page.line }}
        >
          <div
            className="flex h-9 w-8 shrink-0 items-center justify-center border bg-white/50 font-mono text-[9px] uppercase tracking-[0.08em]"
            style={{ color: page.color, borderColor: page.line }}
          >
            {String(fileName).split(".").pop()}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[12px] leading-4 text-black/72">
              {fileName}
            </div>
            <div className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.1em] text-black/35">
              {fileMeta}
            </div>
          </div>
        </div>
      </BubbleRow>
    );
  }

  if (visualKind === "image" || visualKind === "sticker") {
    const mediaItem = primaryMediaItem;
    const mediaSrc = getConversationMediaSrc(mediaItem);
    const mediaLabel =
      visualKind === "sticker"
        ? mediaItem?.label ||
          mediaItem?.fileName ||
          mediaItem?.stickerId ||
          "表情包"
        : mediaItem?.label ||
          mediaItem?.fileName ||
          mediaItem?.relativePath ||
          "图片";

    return (
      <BubbleRow message={message} side={fromUser ? "right" : "left"}>
      <div className={visualKind === "sticker" ? "max-w-[96px]" : "max-w-[220px]"}>
  <div
    className={
      visualKind === "sticker"
        ? "flex h-[92px] w-[92px] items-center justify-center overflow-hidden rounded-xl bg-white/30"
        : "inline-flex max-w-[220px] overflow-hidden rounded-[6px] bg-black/5"
    }
    title={mediaLabel}
  >
    {mediaSrc && !mediaFailed ? (
      <img
        className={
          visualKind === "sticker"
            ? "h-full w-full object-contain"
            : "block max-h-[280px] max-w-[220px] object-contain"
        }
        src={mediaSrc}
        alt={mediaLabel}
        loading="lazy"
        onError={() => setMediaFailed(true)}
      />
    ) : (
      <TinyIcon color="rgba(0,0,0,.38)" />
    )}
  </div>
</div>
      </BubbleRow>
    );
  }

  return (
    <BubbleRow message={message} side={fromUser ? "right" : "left"}>
      <div
        className={`${fromUser ? "bg-[#d7d0c4] text-white" : "border bg-[#f7efe4]/80 text-black/72"} max-w-[300px] border px-2.5 py-1.5 whitespace-pre-line text-[11px] leading-[1.45]`}
        style={{ borderColor: fromUser ? "transparent" : page.line }}
      >
        {displayText}
      </div>
    </BubbleRow>
  );
}
