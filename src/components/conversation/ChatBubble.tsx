import { memo, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { VoiceMessageBubble } from "../voice/VoiceMessageBubble";
import { SpeechRenditionControl } from "../voice/SpeechRenditionControl";
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
} from "../../lib/conversation";
import { formatConversationTime } from "../../lib/conversationPageData";
import { MusicShareCard } from "./MusicShareCard";
import { ConversationAvatar } from "./ConversationAvatar";
import { ConversationMediaGroup } from "./ConversationMediaGroup";
import { createBubbleId, getConversationMessageId, getConversationRenderId, getSpeechRenditionRecordId } from "../../lib/conversationIdentity";
import { ThinkingPanel } from "./ThinkingPanel";
import { bubbleRevealLedger, type BubbleRevealSlot } from "../../lib/BubbleRevealLedger";
import { useBubbleRevealLedger } from "../../lib/useBubbleRevealLedger";
import { getStableUserBubbleSegments } from "../../lib/conversationBubbleSegments";
import { readSpeechRenditionView, readVoiceMessageView } from "../../lib/voiceMessage";
import {
  bubbleRevealInitial,
  bubbleRevealTarget,
  bubbleRevealTransition,
  shouldAdvanceBubbleReveal,
} from "../../lib/chatMotion";

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
          <ConversationAvatar
            src={avatar}
            name={name || "我"}
            size="sm"
            loading="lazy"
          />
        </div>
        <div className="mt-1 min-w-0 text-right">{children}</div>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-start gap-2">
      <div className="flex shrink-0 flex-col items-center">
        <button type="button" onClick={onAvatarClick} className="shrink-0">
          <ConversationAvatar
            src={avatar}
            name={name || "对方"}
            size="sm"
            loading="lazy"
          />
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

function quoteValueText(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";
  const quote = value as { text?: unknown; title?: unknown };
  return String(quote.text || quote.title || "").trim();
}

function ConversationQuoteBubble({
  text,
  page,
  align,
  bubbleId,
}: {
  text: string;
  page: any;
  align: "left" | "right";
  bubbleId?: string;
}) {
  return (
    <div
      className={`${align === "right" ? "ml-auto" : "mr-auto"} inline-block w-fit max-w-[260px] rounded-none border-0 border-l-4 bg-white/[0.37] px-2.5 py-2 text-left font-mono text-[9px] font-semibold leading-[1.35] text-[#454545]`}
      style={{ borderLeftColor: page.line }}
      {...(bubbleId
        ? {
            "data-message-action-target": "true",
            "data-bubble-id": bubbleId,
            "data-bubble-text": text,
          }
        : {})}
    >
      {text}
    </div>
  );
}

async function copyConversationText(value: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Fall through for local HTTP and older embedded WebViews.
    }
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function preserveLiftedBubbleTypography(source: HTMLElement, clone: HTMLElement) {
  const computed = window.getComputedStyle(source);
  for (const property of [
    "font-family",
    "font-size",
    "font-style",
    "font-weight",
    "letter-spacing",
    "line-height",
    "text-align",
    "text-transform",
    "color",
  ]) {
    clone.style.setProperty(property, computed.getPropertyValue(property));
  }
}

function RevealedBubblePart({
  renderId,
  slot,
  className,
  style,
  children,
  bubbleText = "",
  actionable = true,
}: {
  renderId: string;
  slot: BubbleRevealSlot;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  bubbleText?: string;
  actionable?: boolean;
}) {
  const shouldAnimateRef = useRef<boolean | null>(null);
  const completedRef = useRef(false);
  if (shouldAnimateRef.current === null) {
    shouldAnimateRef.current = slot.status === "queued"
      && bubbleRevealLedger.claimEntering(renderId, slot.bubbleId);
  }
  const [motionFinished, setMotionFinished] = useState(
    () => !shouldAnimateRef.current,
  );
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
  useLayoutEffect(() => {
    bubbleRevealLedger.notifyMounted(renderId, slot.bubbleId);
  }, [renderId, slot.bubbleId]);

  const shouldAnimate = shouldAnimateRef.current;
  const isActivelyAnimating = shouldAnimate && !motionFinished;
  const handleAnimationComplete = () => {
    finishEntering();
    setMotionFinished(true);
  };
  return (
    <motion.div
      data-bubble-id={slot.bubbleId}
      data-bubble-state={isActivelyAnimating ? "entering" : slot.status}
      {...(actionable ? { "data-message-action-target": "true" } : {})}
      {...(bubbleText ? { "data-bubble-text": bubbleText } : {})}
      className={className}
      style={{
        ...style,
        willChange: isActivelyAnimating ? "transform, opacity" : style?.willChange,
      }}
      initial={shouldAnimate
        ? bubbleRevealInitial
        : false}
      animate={shouldAnimate
        ? bubbleRevealTarget
        : undefined}
      transition={shouldAnimate
        ? bubbleRevealTransition
        : undefined}
      onUpdate={(latest) => {
        if (shouldAnimate && shouldAdvanceBubbleReveal(latest.opacity)) {
          finishEntering();
        }
      }}
      onAnimationComplete={handleAnimationComplete}
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
  onRetry = undefined,
  onVoiceRetry = undefined,
  onVoiceTranscriptConfirm = undefined,
  onSpeechRendition = undefined,
  onSpeechRenditionRetry = undefined,
  animateBubbleSequence = false,
  mediaUrls,
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
  const voiceMessageView = readVoiceMessageView(message.meta?.voiceMessage);
  const speechRenditionView = !fromUser ? readSpeechRenditionView(message.meta?.speechRendition) : null;
  const speechRenditionSrc = speechRenditionView?.assetPath
    ? getConversationMediaSrc({
        kind: "voice",
        contentType: "audio/mpeg",
        relativePath: `MLane/voice/${speechRenditionView.assetPath}`,
      }, mediaUrls)
    : "";
  const mediaItems = getConversationMediaItems(message);
  const operationPaths = getOperationDisplayPaths(message);
  const [actionOpen, setActionOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  // Animation eligibility is decided on the message's first render and stays
  // with that mounted bubble while its live record is replaced by the archive.
  const animateOnMountRef = useRef(Boolean(animateBubbleSequence));
  const bubbleKeyRoot = String(
    bubbleIdentityKey ||
      getConversationRenderId(message),
  );
  const isAnimatingBubbleSequence = animateOnMountRef.current && !reduceMotion;
  const stableUserSegments = fromUser ? getStableUserBubbleSegments(message) : [];
  const hasStableUserSegments = stableUserSegments.length > 0;
  const messageTextParts = hasStableUserSegments
    ? stableUserSegments.map((segment) => segment.text)
    : (displayText ? splitBubbleText(displayText) : []);
  const rendersTextBubbles = hasStableUserSegments || !(visualKind === "voice" && voiceMessageView) && ![
    "hidden",
    "system",
    "music",
    "operation",
    "thinking",
  ].includes(visualKind);
  const textBubbleCount = hasStableUserSegments
    ? stableUserSegments.length
    : (rendersTextBubbles ? messageTextParts.length : 0);
  const hasAuxiliaryBubble = !hasStableUserSegments && Boolean(
    quoteText || ["voice", "file", "image", "sticker"].includes(visualKind),
  );
  const revealSnapshot = useBubbleRevealLedger(
    bubbleKeyRoot,
    textBubbleCount + (hasAuxiliaryBubble ? 1 : 0),
    !fromUser && isAnimatingBubbleSequence ? "sequential" : "rest",
    hasStableUserSegments
      ? stableUserSegments.map((segment) => segment.segmentId)
      : undefined,
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

  if (hasStableUserSegments) {
    return (
      <BubbleRow
        message={message}
        side="right"
        avatar={userProfile?.avatar}
        name={userProfile?.name}
      >
        <div
          className="flex max-w-[min(78vw,360px)] flex-col items-end gap-2"
          data-user-message-row={bubbleKeyRoot}
        >
          {visibleTextSlots.map((slot, position) => {
            const segment = stableUserSegments[position];
            if (!segment) return null;
            const segmentQuote = quoteValueText(segment.quote);
            const segmentAttachments = segment.attachments || [];
            return (
              <RevealedBubblePart
                key={slot.bubbleId}
                renderId={bubbleKeyRoot}
                slot={slot}
                bubbleText={segment.text}
                actionable={false}
                className="w-fit max-w-full text-left font-sans text-[14px] font-normal leading-[1.55] text-black/[0.78]"
                style={{ transformOrigin: "right bottom" }}
              >
                <div className="flex flex-col items-end gap-1" data-segment-id={segment.segmentId}>
                  {segment.text ? (
                    <div
                      className="max-w-full rounded-[7px] border border-black/[0.06] bg-[#f3f3f2] px-3 py-1.5 text-left font-sans text-[14px] font-normal leading-[1.55] text-black/[0.78] shadow-[0_1px_0_rgba(0,0,0,.02)]"
                      data-message-action-target="true"
                      data-bubble-id={createBubbleId(slot.bubbleId, "text")}
                      data-bubble-text={segment.text}
                    >
                      {segment.text}
                    </div>
                  ) : null}
                  {segmentQuote ? (
                    <ConversationQuoteBubble
                      text={segmentQuote}
                      page={page}
                      align="right"
                      bubbleId={createBubbleId(slot.bubbleId, "quote")}
                    />
                  ) : null}
                  {segmentAttachments.length ? (
                    <div
                      data-message-action-target="true"
                      data-bubble-id={createBubbleId(slot.bubbleId, "media")}
                    >
                      <ConversationMediaGroup
                        items={segmentAttachments}
                        page={page}
                        align="right"
                        mediaUrls={mediaUrls}
                      />
                    </div>
                  ) : null}
                </div>
              </RevealedBubblePart>
            );
          })}
          {onQuote ? (
            <button type="button" onClick={() => onQuote(message)} className="text-[9px] font-semibold text-black/30 underline-offset-2 hover:underline">
              引用这组消息
            </button>
          ) : null}
          {message.meta?.deliveryState === "staging" || message.meta?.deliveryState === "submitting" ? (
            <span className="px-1 text-[9px] font-semibold text-black/28" aria-live="polite">
              发送中…
            </span>
          ) : null}
          {message.meta?.deliveryState === "failed" || message.meta?.deliveryState === "unknown" ? (
            <button
              type="button"
              className="rounded-full border border-[#b86c75]/20 bg-white/70 px-2.5 py-1 text-[9px] font-semibold text-[#a4535d]"
              onClick={() => onRetry?.(getConversationMessageId(message))}
            >
              {message.meta?.deliveryState === "unknown" ? "发送状态未知 · 重试" : "发送失败 · 重试"}
            </button>
          ) : null}
        </div>
      </BubbleRow>
    );
  }

  if (visualKind === "hidden") {
    return null;
  }

  if (visualKind === "system") {
    return (
      <div className="flex justify-center py-1">
        <div
          className="border bg-white/35 px-2.5 py-1 font-mono text-[9px] tracking-[0.08em] text-black/[0.38]"
          style={{ borderColor: page.line }}
          data-message-action-target="true"
          data-bubble-id={createBubbleId(bubbleKeyRoot, "system")}
          data-bubble-text={displayText}
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
          <div
            data-message-action-target="true"
            data-bubble-id={createBubbleId(bubbleKeyRoot, "music")}
          >
            <MusicShareCard data={musicData} page={page} />
          </div>
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
          data-message-action-target="true"
          data-bubble-id={createBubbleId(bubbleKeyRoot, "operation")}
          data-bubble-text={displayText}
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
        <div
          data-message-action-target="true"
          data-bubble-id={createBubbleId(bubbleKeyRoot, "thinking")}
        >
          <ThinkingPanel
            records={[message]}
            panelId={createBubbleId(getConversationRenderId(message), "thinking-panel")}
            face={threadProfile?.thinkingFace}
            standalone
          />
        </div>
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
        <div className={`flex max-w-[280px] flex-col gap-1 ${fromUser ? "items-end text-right" : "items-start text-left"}`}>
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
              <ConversationQuoteBubble
                text={quoteText}
                page={page}
                align={fromUser ? "right" : "left"}
              />
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
    const mediaSrc = getConversationMediaSrc(primaryMediaItem, mediaUrls);
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
              <VoiceMessageBubble
                id={`conversation-voice:${auxiliarySlot.bubbleId}`}
                audioSrc={mediaSrc}
                durationHint={voiceMessageView?.durationSeconds || 0}
                transcript={voiceMessageView?.transcript || displayText}
                side={fromUser ? "user" : "assistant"}
                playbackDisabled={!mediaSrc || voiceMessageView?.state === "uploading"}
                statusLabel={voiceMessageView?.statusLabel || ""}
                busy={voiceMessageView?.busy || false}
                needsTranscriptReview={voiceMessageView?.state === "needs-transcript-review"}
                retryable={voiceMessageView?.state === "transcription-failed"}
                onRetryTranscription={onVoiceRetry ? () => onVoiceRetry(getConversationMessageId(message)) : undefined}
                onConfirmTranscript={onVoiceTranscriptConfirm
                  ? (text) => onVoiceTranscriptConfirm(getConversationMessageId(message), text)
                  : undefined}
              />
            </RevealedBubblePart>
          ) : null}
        </div>
      </BubbleRow>
    );
  }

  if (visualKind === "file") {
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
              <ConversationMediaGroup
                items={mediaItems}
                page={page}
                align={fromUser ? "right" : "left"}
                fileFallbackName={displayText || "文件"}
                mediaUrls={mediaUrls}
              />
            </RevealedBubblePart>
          ) : null}
        </div>
      </BubbleRow>
    );
  }

  if (visualKind === "image" || visualKind === "sticker") {
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
              <ConversationMediaGroup
                items={mediaItems}
                page={page}
                align={fromUser ? "right" : "left"}
                mediaUrls={mediaUrls}
              />
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
        {speechRenditionView ? (
          <SpeechRenditionControl
            id={getSpeechRenditionRecordId(message)}
            view={speechRenditionView}
            audioSrc={speechRenditionSrc}
            onRetry={onSpeechRenditionRetry ? () => onSpeechRenditionRetry(getSpeechRenditionRecordId(message)) : undefined}
          />
        ) : null}
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
  onSpeechRendition,
  activeActionId,
  onActionOpen,
  onActionClose,
  children,
}: {
  message: any;
  onQuote?: (message: any) => void;
  onSpeechRendition?: (message: any) => Promise<unknown> | unknown;
  activeActionId?: string | null;
  onActionOpen?: (target: { id: string; message: any }) => void;
  onActionClose?: () => void;
  children: ReactNode;
}) {
  const timerRef = useRef<number | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const liftedSourceRef = useRef<HTMLElement | null>(null);
  const targetRef = useRef<any>(message);
  const [anchorRect, setAnchorRect] = useState<{
    top: number;
    right: number;
    bottom: number;
    left: number;
  } | null>(null);
  const [anchorMarkup, setAnchorMarkup] = useState("");
  const [menuPage, setMenuPage] = useState<"primary" | "more">("primary");
  const messageRenderId = getConversationRenderId(message);
  const actionIdRef = useRef(createBubbleId(messageRenderId, "message"));
  const open = activeActionId === actionIdRef.current;
  const reduceMotion = useReducedMotion();
  const clearTimer = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    pointerStartRef.current = null;
  };
  const openMenu = (target: HTMLElement) => {
    const bubbleElement = target.closest<HTMLElement>("[data-message-action-target]");
    if (!bubbleElement) return;
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
    const nextRect = (bubbleElement || wrapperRef.current)?.getBoundingClientRect();
    if (nextRect) {
      setAnchorRect({
        top: nextRect.top,
        right: nextRect.right,
        bottom: nextRect.bottom,
        left: nextRect.left,
      });
      const clone = bubbleElement.cloneNode(true) as HTMLElement;
      clone.removeAttribute("id");
      if (clone.matches("button, a, input, select, textarea, audio")) {
        clone.setAttribute("tabindex", "-1");
      }
      clone.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
      clone.querySelectorAll("button, a, input, select, textarea, audio").forEach((node) => {
        node.setAttribute("tabindex", "-1");
      });
      preserveLiftedBubbleTypography(bubbleElement, clone);
      clone.setAttribute("aria-hidden", "true");
      setAnchorMarkup(clone.outerHTML);
      liftedSourceRef.current = bubbleElement;
      bubbleElement.style.visibility = "hidden";
    }
    onActionOpen?.({ id: actionIdRef.current, message: targetRef.current });
  };
  const copyText = getConversationDisplayText(targetRef.current).trim();
  const primaryActions = [
    {
      id: "quote",
      label: "引用回复",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[21px] w-[21px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.5 8.5 5 12l4.5 3.5" />
          <path d="M5.5 12H14a5 5 0 0 1 5 5v1" />
        </svg>
      ),
      disabled: false,
      run: () => {
        onQuote?.(targetRef.current);
        onActionClose?.();
      },
    },
    {
      id: "copy",
      label: "复制",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[21px] w-[21px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="8" y="8" width="11" height="12" rx="2" />
          <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h2" />
        </svg>
      ),
      disabled: !copyText,
      run: async () => {
        if (!copyText) return;
        await copyConversationText(copyText);
        onActionClose?.();
      },
    },
    {
      id: "voice",
      label: message.type === "assistant" && !message.meta?.voiceMessage
        ? (message.meta?.speechRendition ? "重新生成语音" : "生成语音")
        : "语音",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[21px] w-[21px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" />
          <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6" />
        </svg>
      ),
      disabled: message.type !== "assistant" || Boolean(message.meta?.voiceMessage) || !getSpeechRenditionRecordId(message) || !onSpeechRendition,
      run: async () => {
        if (!onSpeechRendition) return;
        if (message.meta?.speechRendition && !window.confirm("将使用当前 Voice Profile 重新生成语音，并再次消耗 TTS 额度。旧语音会保留到新语音生成成功。是否继续？")) {
          return;
        }
        await onSpeechRendition(targetRef.current);
        onActionClose?.();
      },
    },
    {
      id: "more",
      label: "更多…",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[21px] w-[21px]" fill="currentColor">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      ),
      disabled: false,
      run: () => setMenuPage("more"),
    },
  ];
  const moreActions = [
    {
      id: "back",
      label: "返回",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[21px] w-[21px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="m10 7-5 5 5 5" />
          <path d="M5 12h14" />
        </svg>
      ),
      disabled: false,
      run: () => setMenuPage("primary"),
    },
    {
      id: "edit",
      label: "编辑",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[21px] w-[21px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13.5 6.5 17.5 10.5M4 20l4.2-1 10-10a2.8 2.8 0 0 0-4-4l-10 10L4 20Z" />
        </svg>
      ),
      disabled: true,
      run: () => undefined,
    },
    {
      id: "delete",
      label: "删除",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[21px] w-[21px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
        </svg>
      ),
      disabled: true,
      run: () => undefined,
    },
    {
      id: "forward",
      label: "转发",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[21px] w-[21px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="m14 6 5 5-5 5" />
          <path d="M19 11h-8a6 6 0 0 0-6 6v1" />
        </svg>
      ),
      disabled: true,
      run: () => undefined,
    },
    {
      id: "select",
      label: "多选",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[21px] w-[21px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="8" />
          <path d="m8.5 12 2.2 2.2 4.8-5" />
        </svg>
      ),
      disabled: true,
      run: () => undefined,
    },
  ];
  const actions = menuPage === "more" ? moreActions : primaryActions;

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onActionClose?.();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onActionClose, open]);

  useEffect(() => {
    if (!open) {
      setMenuPage("primary");
      if (liftedSourceRef.current) {
        liftedSourceRef.current.style.visibility = "";
        liftedSourceRef.current = null;
      }
    }
  }, [open]);

  useEffect(() => () => {
    clearTimer();
    if (liftedSourceRef.current) liftedSourceRef.current.style.visibility = "";
  }, []);

  const overlay = open && anchorRect && anchorMarkup && typeof document !== "undefined"
    ? createPortal((() => {
        const menuWidth = 216;
        const menuHeight = actions.length * 52;
        const menuGap = 10;
        const screenPadding = 12;
        const preferredLeft = message.type === "user"
          ? anchorRect.right - menuWidth
          : anchorRect.left;
        const menuLeft = Math.min(
          window.innerWidth - menuWidth - screenPadding,
          Math.max(screenPadding, preferredLeft),
        );
        const fitsBelow = anchorRect.bottom + menuGap + menuHeight
          <= window.innerHeight - screenPadding;
        const menuTop = Math.max(
          screenPadding,
          fitsBelow
            ? anchorRect.bottom + menuGap
            : anchorRect.top - menuGap - menuHeight,
        );

        return (
          <div className="fixed inset-0 z-[200]" data-message-action-overlay>
            <motion.div
              className="pointer-events-none absolute inset-0 bg-[rgba(20,20,22,0.42)] backdrop-blur-[5px] backdrop-saturate-[0.78]"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: reduceMotion ? 0 : 0.16, ease: [0.23, 1, 0.32, 1] }}
            />
            <button
              type="button"
              className="absolute inset-0 h-full w-full cursor-default"
              aria-label="关闭消息操作"
              onClick={onActionClose}
            />
            <motion.div
              className="pointer-events-none absolute drop-shadow-[0_8px_12px_rgba(17,17,20,.16)]"
              style={{
                top: anchorRect.top,
                left: anchorRect.left,
                width: anchorRect.right - anchorRect.left,
                height: anchorRect.bottom - anchorRect.top,
                transformOrigin: message.type === "user" ? "right bottom" : "left bottom",
              }}
              initial={reduceMotion ? false : { scale: 0.985, y: 2 }}
              animate={{ scale: 1.018, y: -2 }}
              transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.23, 1, 0.32, 1] }}
              dangerouslySetInnerHTML={{ __html: anchorMarkup }}
            />
            <motion.div
              key={menuPage}
              role="menu"
              aria-label="消息操作"
              className="absolute overflow-hidden rounded-[14px] bg-white shadow-[0_8px_24px_rgba(17,17,20,.18)]"
              style={{ top: menuTop, left: menuLeft, width: menuWidth }}
              initial={reduceMotion ? false : { opacity: 0, scale: 0.97, y: fitsBelow ? -4 : 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.18, ease: [0.23, 1, 0.32, 1] }}
            >
              {actions.map((action, index) => (
                <button
                  key={action.id}
                  type="button"
                  role="menuitem"
                  aria-disabled={action.disabled}
                  className={`flex h-[52px] w-full items-center justify-between px-4 font-sans text-[15px] font-semibold transition-colors ${action.id === "delete" ? "cursor-default text-[#ed4b4b]" : action.disabled ? "cursor-default text-black/45" : "text-black/[0.82] hover:bg-black/[0.035] active:bg-black/[0.07]"} ${index > 0 ? "border-t border-black/[0.07]" : ""}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (action.disabled) return;
                    void action.run();
                  }}
                >
                  <span>{action.label}</span>
                  <span className={action.id === "delete" ? "text-[#ed4b4b]" : "text-black/35"}>{action.icon}</span>
                </button>
              ))}
            </motion.div>
          </div>
        );
      })(), document.body)
    : null;

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onPointerDown={(event) => {
        const target = event.target as HTMLElement;
        if (!target.closest("[data-message-action-target]")) return;
        clearTimer();
        pointerStartRef.current = { x: event.clientX, y: event.clientY };
        timerRef.current = window.setTimeout(() => openMenu(target), 480);
      }}
      onPointerMove={(event) => {
        const start = pointerStartRef.current;
        if (!start) return;
        if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) clearTimer();
      }}
      onPointerUp={clearTimer}
      onPointerCancel={clearTimer}
      onPointerLeave={clearTimer}
      onContextMenu={(event) => {
        event.preventDefault();
        clearTimer();
        openMenu(event.target as HTMLElement);
      }}
    >
      {children}
      {overlay}
    </div>
  );
}

export const ChatBubble = memo(function ChatBubble(props: any) {
  return (
    <LongPressBubble
      message={props.message}
      onQuote={props.onQuote}
      onSpeechRendition={props.onSpeechRendition}
      activeActionId={props.activeActionId}
      onActionOpen={props.onActionOpen}
      onActionClose={props.onActionClose}
    >
      <ChatBubbleContent {...props} onQuote={undefined} />
    </LongPressBubble>
  );
});
