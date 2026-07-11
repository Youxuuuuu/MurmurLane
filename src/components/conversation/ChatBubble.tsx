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
import { ConversationAvatar } from "./ConversationAvatar";

export function BubbleRow({
  message,
  children,
  side = message.type === "user" ? "right" : "left",
  avatar = "",
  name = "",
  onAvatarClick = undefined,
}) {
  const fromRight = side === "right";
  return (
    <div
      className={`flex items-start gap-2 ${fromRight ? "justify-end" : "justify-start"}`}
    >
      {!fromRight && (
        <button type="button" onClick={onAvatarClick} className="mt-0.5 shrink-0">
          <ConversationAvatar src={avatar} name={name || "对方"} size="sm" />
        </button>
      )}
      <div className={`min-w-0 ${fromRight ? "text-right" : "text-left"}`}>
        <MessageTime message={message} align={fromRight ? "right" : "left"} read={fromRight} />
        {children}
      </div>
      {fromRight && (
        <ConversationAvatar src={avatar} name={name || "我"} size="sm" />
      )}
    </div>
  );
}

export function MessageTime({ message, align = "left", read = false }) {
  return (
    <div
      className={`mb-1 font-sans text-[9px] tracking-[0.06em] text-black/25 ${align === "right" ? "text-right" : "text-left"}`}
    >
      {read && <span>Read · ✓✓ </span>}
      {formatConversationTime(message.timestamp)}
    </div>
  );
}

function splitBubbleText(text) {
  const parts = String(text ?? "")
    .split(/\r?\n/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length ? parts : [""];
}

export function ChatBubble({
  message,
  page,
  messages = [],
  userProfile,
  threadProfile,
  onEditThread,
}) {
  const visualKind = getConversationVisualKind(message);
  const displayText = getConversationDisplayText(message);
  const fromUser = message.type === "user";
  const quoteText = getConversationQuoteText(message);
  const primaryMediaItem = getConversationPrimaryMediaItem(message);
  const operationPaths = getOperationDisplayPaths(message);
  const [actionOpen, setActionOpen] = useState(false);
  const [thinkingOpen, setThinkingOpen] = useState(false);
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
        <BubbleRow
          message={message}
          side="left"
          avatar={threadProfile?.avatar}
          name={threadProfile?.name}
          onAvatarClick={onEditThread}
        >
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
        <div className="max-w-[min(86vw,520px)] bg-transparent px-3 py-2 text-left">
          <button
            type="button"
            onClick={() => setThinkingOpen((value) => !value)}
            className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-black/35"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-black/30" />
            Thinking
            <span className="ml-1 text-[12px]">{thinkingOpen ? "⌄" : "›"}</span>
          </button>
          {thinkingOpen && (
            <div className="mt-2 whitespace-pre-line font-serif text-[11px] leading-[1.55] text-black/52">
              {displayText}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (fromUser && quoteText) {
    return (
      <BubbleRow
        message={message}
        side="right"
        avatar={userProfile?.avatar}
        name={userProfile?.name}
      >
        <div className="max-w-[280px] text-right">
          <div className="ml-auto flex flex-col items-end gap-2">
            {splitBubbleText(displayText).map((part, index) => (
              <div
                key={`${message.id}-quote-part-${index}`}
                className="inline-block rounded-[7px] border border-black/[0.06] bg-[#f3f3f2] px-3 py-2 text-left font-sans text-[14px] leading-[1.55] text-black/78"
              >
                {part}
              </div>
            ))}
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
      <BubbleRow
        message={message}
        side={fromUser ? "right" : "left"}
        avatar={fromUser ? userProfile?.avatar : threadProfile?.avatar}
        name={fromUser ? userProfile?.name : threadProfile?.name}
        onAvatarClick={fromUser ? undefined : onEditThread}
      >
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
      <BubbleRow
        message={message}
        side={fromUser ? "right" : "left"}
        avatar={fromUser ? userProfile?.avatar : threadProfile?.avatar}
        name={fromUser ? userProfile?.name : threadProfile?.name}
        onAvatarClick={fromUser ? undefined : onEditThread}
      >
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
    <BubbleRow
      message={message}
      side={fromUser ? "right" : "left"}
      avatar={fromUser ? userProfile?.avatar : threadProfile?.avatar}
      name={fromUser ? userProfile?.name : threadProfile?.name}
      onAvatarClick={fromUser ? undefined : onEditThread}
    >
      <div className={`flex max-w-[min(78vw,360px)] flex-col gap-2 ${fromUser ? "items-end" : "items-start"}`}>
        {splitBubbleText(displayText).map((part, index) => (
          <div
            key={`${message.id}-part-${index}`}
            className={`${fromUser ? "border border-black/[0.06] bg-[#f3f3f2] text-black/78" : "border bg-white/88 text-black/72"} w-fit max-w-full rounded-[7px] px-3 py-2 text-left font-sans text-[14px] leading-[1.55] shadow-[0_1px_0_rgba(0,0,0,.02)]`}
            style={{ borderColor: fromUser ? "rgba(0,0,0,.06)" : page.line }}
          >
            {part}
          </div>
        ))}
      </div>
    </BubbleRow>
  );
}
