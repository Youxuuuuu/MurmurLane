import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type SyntheticEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  getConversationDisplayText,
  getConversationMediaItems,
  getConversationMediaSrc,
  getConversationPrimaryMediaItem,
  getConversationQuoteText,
  getConversationVisualKind,
  getOperationDisplayPaths,
  buildCloudMusicCardData,
  isImageLikeMedia,
} from "../../lib/conversation";
import { formatConversationTime } from "../../lib/conversationPageData";
import { TinyIcon } from "../common/TinyIcon";
import { MusicShareCard } from "./MusicShareCard";
import { ConversationAvatar } from "./ConversationAvatar";
import { ConversationPhotoGallery } from "./PhotoStack";
import { createBubbleId, getConversationRenderId } from "../../lib/conversationIdentity";
import { ThinkingPanel } from "./ThinkingPanel";
import { bubbleRevealLedger, type BubbleRevealSlot } from "../../lib/BubbleRevealLedger";
import { useBubbleRevealLedger } from "../../lib/useBubbleRevealLedger";

export function BubbleRow({
  message,
  children,
  side = message.type === "user" ? "right" : "left",
  avatar = "",
  name = "",
  onAvatarClick = undefined,
}) {
  const fromRight = side === "right";
  if (fromRight) {
    return (
      <div className="flex flex-col items-end">
        <div className="flex items-start justify-end gap-2">
          <MessageTime message={message} align="right" read />
          <ConversationAvatar src={avatar} name={name || "我"} size="sm" />
        </div>
        <div className="mt-1 min-w-0 text-right">{children}</div>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-start gap-2">
      <div className="flex shrink-0 flex-col items-center">
        <button type="button" onClick={onAvatarClick} className="shrink-0">
          <ConversationAvatar src={avatar} name={name || "对方"} size="sm" />
        </button>
        <MessageTime message={message} align="center" />
      </div>
      <div className="min-w-0 pt-0.5 text-left">{children}</div>
    </div>
  );
}

export function MessageTime({ message, align = "left", read = false }) {
  const time = formatConversationTime(message.timestamp);
  return (
    <div
      className={`font-sans text-[9px] font-bold leading-[1.35] tracking-[0.06em] text-black/25 ${align === "right" ? "mt-[3px] pt-0.5 text-right" : align === "center" ? "mt-1 text-center" : "text-left"}`}
    >
      {read ? (
        <>
          <div>Read · ✓✓</div>
          <div className="mt-0.5">{time}</div>
        </>
      ) : (
        time
      )}
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

function parseInlineQuote(value) {
  const text = String(value ?? "").trim();
  const match = text.match(/\[Quoted:\s*([^\]]*?)\]/i);
  if (!match) return { quote: "", text };
  const before = text.slice(0, match.index || 0).trim();
  const after = text.slice((match.index || 0) + match[0].length).trim();
  return {
    quote: String(match[1] || "").trim(),
    text: [before, after].filter(Boolean).join("\n"),
  };
}

function RevealedBubblePart({
  renderId,
  slot,
  className,
  style,
  children,
  bubbleText = "",
}: {
  renderId: string;
  slot: BubbleRevealSlot;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  bubbleText?: string;
}) {
  const shouldAnimateRef = useRef<boolean | null>(null);
  const completedRef = useRef(false);
  if (shouldAnimateRef.current === null) {
    shouldAnimateRef.current = slot.status === "queued"
      && bubbleRevealLedger.claimEntering(renderId, slot.bubbleId);
  }
  const finishEntering = () => {
    if (!shouldAnimateRef.current || completedRef.current) return;
    completedRef.current = true;
    bubbleRevealLedger.completeEntering(renderId, slot.bubbleId);
  };
  useEffect(() => {
    if (!shouldAnimateRef.current && slot.status === "entering") {
      bubbleRevealLedger.completeEntering(renderId, slot.bubbleId);
    }
  }, [renderId, slot.bubbleId, slot.status]);

  const shouldAnimate = shouldAnimateRef.current;
  const isActivelyAnimating = shouldAnimate && !completedRef.current;
  return (
    <motion.div
      data-bubble-id={slot.bubbleId}
      data-bubble-state={isActivelyAnimating ? "entering" : slot.status}
      {...(bubbleText ? { "data-bubble-text": bubbleText } : {})}
      className={className}
      style={{
        ...style,
        willChange: isActivelyAnimating ? "transform, opacity" : style?.willChange,
      }}
      initial={shouldAnimate
        ? { opacity: 0, transform: "translateY(8px) scale(0.975)" }
        : false}
      animate={shouldAnimate
        ? { opacity: 1, transform: "translateY(0px) scale(1)" }
        : undefined}
      transition={shouldAnimate
        ? { type: "spring", stiffness: 460, damping: 38, mass: 0.8 }
        : undefined}
      onAnimationComplete={finishEntering}
    >
      {children}
    </motion.div>
  );
}

function ChatBubbleContent({
  message,
  bubbleIdentityKey = "",
  page,
  messages = [],
  userProfile,
  threadProfile,
  onEditThread,
  onQuote = undefined,
  animateBubbleSequence = false,
}) {
  const visualKind = getConversationVisualKind(message);
  const rawDisplayText = getConversationDisplayText(message);
  const inlineQuote = parseInlineQuote(rawDisplayText);
  const displayText = inlineQuote.quote ? inlineQuote.text : rawDisplayText;
  const fromUser = message.type === "user";
  const metaQuote = getConversationQuoteText(message);
  const parsedMetaQuote = parseInlineQuote(metaQuote);
  const quoteText = inlineQuote.quote || parsedMetaQuote.quote || metaQuote;
  const primaryMediaItem = getConversationPrimaryMediaItem(message);
  const imageItems = getConversationMediaItems(message).filter(isImageLikeMedia);
  const operationPaths = getOperationDisplayPaths(message);
  const [actionOpen, setActionOpen] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);
  const reduceMotion = useReducedMotion();
  // Animation eligibility is decided on the message's first render and stays
  // with that mounted bubble while its live record is replaced by the archive.
  const animateOnMountRef = useRef(Boolean(animateBubbleSequence));
  const bubbleKeyRoot = String(
    bubbleIdentityKey ||
      getConversationRenderId(message),
  );
  const isAnimatingBubbleSequence = animateOnMountRef.current && !reduceMotion;
  const messageTextParts = displayText ? splitBubbleText(displayText) : [];
  const rendersTextBubbles = ![
    "hidden",
    "system",
    "music",
    "operation",
    "thinking",
  ].includes(visualKind);
  const textBubbleCount = rendersTextBubbles ? messageTextParts.length : 0;
  const hasAuxiliaryBubble = Boolean(
    quoteText || ["voice", "file", "image", "sticker"].includes(visualKind),
  );
  const revealSnapshot = useBubbleRevealLedger(
    bubbleKeyRoot,
    textBubbleCount + (hasAuxiliaryBubble ? 1 : 0),
    !fromUser && isAnimatingBubbleSequence ? "sequential" : "rest",
  );
  const visibleTextSlots = revealSnapshot.visibleSlots.slice(0, textBubbleCount);
  const auxiliarySlot = revealSnapshot.visibleSlots[textBubbleCount];
  const renderMessageTextBubbles = (quoted = false) =>
    visibleTextSlots.map((slot, position) => {
      const part = messageTextParts[position] || "";
      return (
        <RevealedBubblePart
          key={slot.bubbleId}
          renderId={bubbleKeyRoot}
          slot={slot}
          bubbleText={part}
          className={quoted
            ? `${fromUser ? "border-black/[0.06] bg-[#f3f3f2] text-black/[0.78]" : "bg-white/[0.73] text-black/[0.72]"} inline-block rounded-[7px] border px-3 py-1.5 text-left font-sans text-[14px] font-normal leading-[1.55]`
            : `${fromUser ? "border border-black/[0.06] bg-[#f3f3f2] text-black/[0.78]" : "border bg-white/[0.73] text-black/[0.72]"} w-fit max-w-full rounded-[7px] px-3 py-1.5 text-left font-sans text-[14px] font-normal leading-[1.55] shadow-[0_1px_0_rgba(0,0,0,.02)]`}
          style={{
            borderColor: fromUser ? "rgba(0,0,0,.06)" : page.line,
            transformOrigin: fromUser ? "right bottom" : "left bottom",
          }}
        >
          {part}
        </RevealedBubblePart>
      );
    });

  if (visualKind === "hidden") {
    return null;
  }

  if (visualKind === "system") {
    return (
      <div className="flex justify-center py-1">
        <div
          className="border bg-white/35 px-2.5 py-1 font-mono text-[9px] tracking-[0.08em] text-black/[0.38]"
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
          className="max-w-[342px] px-2 text-center font-mono text-[9px] font-semibold tracking-[0.04em] text-black/[0.42]"
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
            <div className="mt-1 whitespace-pre-line break-all text-[8px] font-normal leading-[1.25] tracking-normal text-black/[0.34]">
              {operationPaths.join("\n")}
            </div>
          )}
        </button>
      </div>
    );
  }

  if (visualKind === "thinking") {
    return (
      <div className="flex justify-start">
        <ThinkingPanel
          records={[message]}
          panelId={createBubbleId(getConversationRenderId(message), "thinking-panel")}
          face={threadProfile?.thinkingFace}
          standalone
        />
      </div>
    );
  }

  if (quoteText) {
    return (
      <BubbleRow
        message={message}
        side={fromUser ? "right" : "left"}
        avatar={fromUser ? userProfile?.avatar : threadProfile?.avatar}
        name={fromUser ? userProfile?.name : threadProfile?.name}
        onAvatarClick={fromUser ? undefined : onEditThread}
      >
        <div className={`max-w-[280px] ${fromUser ? "text-right" : "text-left"}`}>
          <div className={`flex flex-col gap-2 ${fromUser ? "items-end" : "items-start"}`}>
            {renderMessageTextBubbles(true)}
          </div>
          {auxiliarySlot ? (
            <RevealedBubblePart
              key={auxiliarySlot.bubbleId}
              renderId={bubbleKeyRoot}
              slot={auxiliarySlot}
              style={{ transformOrigin: fromUser ? "right bottom" : "left bottom" }}
            >
              <div
                className={`${fromUser ? "ml-auto" : "mr-auto"} mt-1 inline-block w-fit max-w-[260px] rounded-none border-0 border-l-4 bg-white/[0.37] px-2.5 py-2 text-left font-mono text-[9px] font-semibold leading-[1.35] text-[#454545]`}
                style={{ borderLeftColor: page.line }}
              >
                {quoteText}
              </div>
            </RevealedBubblePart>
          ) : null}
          {onQuote ? (
            <button type="button" onClick={() => onQuote(message)} className="mt-1 text-[9px] font-semibold text-black/30 underline-offset-2 hover:underline">
              引用
            </button>
          ) : null}
        </div>
      </BubbleRow>
    );
  }

  if (visualKind === "voice") {
    const mediaSrc = getConversationMediaSrc(primaryMediaItem);
    return (
      <BubbleRow
        message={message}
        side={fromUser ? "right" : "left"}
        avatar={fromUser ? userProfile?.avatar : threadProfile?.avatar}
        name={fromUser ? userProfile?.name : threadProfile?.name}
        onAvatarClick={fromUser ? undefined : onEditThread}
      >
        <div className={`flex max-w-[min(78vw,360px)] flex-col gap-2 ${fromUser ? "items-end" : "items-start"}`}>
          {renderMessageTextBubbles()}
          {auxiliarySlot ? (
            <RevealedBubblePart
              key={auxiliarySlot.bubbleId}
              renderId={bubbleKeyRoot}
              slot={auxiliarySlot}
              style={{ transformOrigin: fromUser ? "right bottom" : "left bottom" }}
            >
              <div className="flex max-w-[min(78vw,320px)] items-center gap-2 rounded-[7px] border bg-white/[0.74] px-2.5 py-2" style={{ borderColor: fromUser ? "rgba(0,0,0,.06)" : page.line }}>
                <span className="font-mono text-[10px] text-black/40">◖◗</span>
                {mediaSrc ? <audio controls preload="metadata" src={mediaSrc} className="h-8 max-w-[230px]" /> : <span className="text-[11px] text-black/40">语音暂不可用</span>}
              </div>
            </RevealedBubblePart>
          ) : null}
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
        <div className={`flex max-w-[min(78vw,360px)] flex-col gap-2 ${fromUser ? "items-end" : "items-start"}`}>
          {renderMessageTextBubbles()}
          {auxiliarySlot ? (
            <RevealedBubblePart
              key={auxiliarySlot.bubbleId}
              renderId={bubbleKeyRoot}
              slot={auxiliarySlot}
              style={{ transformOrigin: fromUser ? "right bottom" : "left bottom" }}
            >
              <div
                className="flex max-w-[204px] items-center gap-2 border bg-white/[0.72] px-3 py-2 text-left"
                style={{ borderColor: page.line }}
              >
                <div
                  className="flex h-9 w-8 shrink-0 items-center justify-center border bg-white/50 font-mono text-[9px] uppercase tracking-[0.08em]"
                  style={{ color: page.color, borderColor: page.line }}
                >
                  {String(fileName).split(".").pop()}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[12px] leading-4 text-black/[0.72]">
                    {fileName}
                  </div>
                  <div className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.1em] text-black/35">
                    {fileMeta}
                  </div>
                </div>
              </div>
            </RevealedBubblePart>
          ) : null}
        </div>
      </BubbleRow>
    );
  }

  if (visualKind === "image" || visualKind === "sticker") {
    if (visualKind === "image" && imageItems.length > 0) {
      return (
        <BubbleRow
          message={message}
          side={fromUser ? "right" : "left"}
          avatar={fromUser ? userProfile?.avatar : threadProfile?.avatar}
          name={fromUser ? userProfile?.name : threadProfile?.name}
          onAvatarClick={fromUser ? undefined : onEditThread}
        >
          <div className={`flex max-w-[min(92vw,360px)] flex-col gap-2 ${fromUser ? "items-end" : "items-start"}`}>
            {renderMessageTextBubbles()}
            {auxiliarySlot ? (
              <RevealedBubblePart
                key={auxiliarySlot.bubbleId}
                renderId={bubbleKeyRoot}
                slot={auxiliarySlot}
                style={{ transformOrigin: fromUser ? "right bottom" : "left bottom" }}
              >
                <div
                  className={`max-w-[min(92vw,360px)] ${fromUser ? "mr-8 sm:mr-12" : "ml-4 sm:ml-6"}`}
                >
                  <ConversationPhotoGallery
                    items={imageItems}
                    page={page}
                    controlSide={fromUser ? "left" : "right"}
                  />
                </div>
              </RevealedBubblePart>
            ) : null}
          </div>
        </BubbleRow>
      );
    }

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
        <div className={`flex max-w-[min(78vw,360px)] flex-col gap-2 ${fromUser ? "items-end" : "items-start"}`}>
          {renderMessageTextBubbles()}
          {auxiliarySlot ? (
            <RevealedBubblePart
              key={auxiliarySlot.bubbleId}
              renderId={bubbleKeyRoot}
              slot={auxiliarySlot}
              style={{ transformOrigin: fromUser ? "right bottom" : "left bottom" }}
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
            </RevealedBubblePart>
          ) : null}
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
        {renderMessageTextBubbles()}
        {onQuote ? (
          <button type="button" onClick={() => onQuote(message)} className="text-[9px] font-semibold text-black/30 underline-offset-2 hover:underline">
            引用这句
          </button>
        ) : null}
      </div>
    </BubbleRow>
  );
}

function LongPressBubble({
  message,
  onQuote,
  activeActionId,
  onActionOpen,
  onActionClose,
  children,
}: {
  message: any;
  onQuote?: (message: any) => void;
  activeActionId?: string | null;
  onActionOpen?: (target: { id: string; message: any }) => void;
  onActionClose?: () => void;
  children: ReactNode;
}) {
  const timerRef = useRef<number | null>(null);
  const targetRef = useRef<any>(message);
  const messageRenderId = getConversationRenderId(message);
  const actionIdRef = useRef(createBubbleId(messageRenderId, "message"));
  const open = activeActionId === actionIdRef.current;
  const clearTimer = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  };
  const openMenu = (event: SyntheticEvent) => {
    const target = event.target as HTMLElement;
    const bubbleElement = target.closest<HTMLElement>("[data-bubble-text]");
    const bubbleText = bubbleElement?.dataset.bubbleText;
    const bubbleId = bubbleElement?.dataset.bubbleId
      || createBubbleId(getConversationRenderId(message), "message");
    targetRef.current = bubbleText
      ? {
          ...message,
          text: bubbleText,
          meta: {
            ...(message.meta || {}),
            quoteBubbleId: bubbleId,
          },
        }
      : message;
    actionIdRef.current = bubbleId;
    onActionOpen?.({ id: actionIdRef.current, message: targetRef.current });
  };
  const actions = [
    {
      id: "quote",
      label: "引用",
      run: () => {
        onQuote?.(targetRef.current);
        onActionClose?.();
      },
    },
  ];
  return (
    <div
      className="relative"
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest("button, input, audio, select, textarea, a")) return;
        clearTimer();
        event.persist();
        timerRef.current = window.setTimeout(() => openMenu(event), 480);
      }}
      onPointerMove={(event) => {
        if (Math.abs(event.movementX) > 3 || Math.abs(event.movementY) > 3) clearTimer();
      }}
      onPointerUp={clearTimer}
      onPointerCancel={clearTimer}
      onPointerLeave={clearTimer}
      onContextMenu={(event) => {
        event.preventDefault();
        clearTimer();
        openMenu(event);
      }}
    >
      {children}
      {open ? (
        <div className="absolute left-1/2 top-1/2 z-[120] -translate-x-1/2 -translate-y-1/2 rounded-[13px] border border-black/[0.08] bg-white p-1 shadow-[0_10px_28px_rgba(40,35,48,.16)]">
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              className="rounded-[10px] px-3.5 py-2 font-mono text-[9px] font-semibold tracking-[0.08em] text-black/75"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                action.run();
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ChatBubble(props: any) {
  return (
    <LongPressBubble
      message={props.message}
      onQuote={props.onQuote}
      activeActionId={props.activeActionId}
      onActionOpen={props.onActionOpen}
      onActionClose={props.onActionClose}
    >
      <ChatBubbleContent {...props} onQuote={undefined} />
    </LongPressBubble>
  );
}
