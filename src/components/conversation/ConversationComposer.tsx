import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  getConversationDisplayText,
  getConversationMediaSrc,
  getConversationPrimaryMediaItem,
  getConversationVisualKind,
} from "../../lib/conversation";
import type { StickerAsset } from "../../types/api";
import type { ConversationQuoteObject, ConversationRecord } from "../../types/conversation";
import type {
  WebChatComposerAttachment,
  WebChatComposerMessageInput,
  WebChatModelResponse,
  WebChatStatus,
  WebChatUsage,
  WebChatUsageTotals,
} from "../../types/webChat";
import { StickerPanel } from "./StickerPanel";
import {
  createBubbleId,
  getConversationItemId,
  getConversationMessageId,
  getConversationRenderId,
  getLegacyStableId,
} from "../../lib/conversationIdentity";
import {
  createWebChatPendingUpload,
  isWebChatPendingUpload,
} from "../../lib/webChatPendingUploads";
import {
  buildCompactRuntimeStatus,
  ConversationRuntimePanel,
} from "./ConversationRuntimePanel";
import { VoiceComposerBar } from "./VoiceComposerBar";
import { useVoiceDraftRecorder, type VoiceDraft } from "./useVoiceDraftRecorder";

function makeSegmentId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `segment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function Icon({ name }: { name: "plus" | "smile" | "send" | "photo" | "camera" | "file" }) {
  const paths = {
    plus: <path d="M12 5v14M5 12h14" />,
    smile: <><circle cx="12" cy="12" r="8.5" /><path d="M8.5 10h.01M15.5 10h.01M8.5 14c1 1.35 2.15 2 3.5 2s2.5-.65 3.5-2" /></>,
    send: <path d="m4 5 16 7-16 7 3-7-3-7Zm3 7h13" />,
    photo: <><rect x="3.5" y="5" width="17" height="14" rx="2" /><circle cx="9" cy="10" r="1.5" /><path d="m5 17 4.5-4 3 2.5 2.5-2 3.5 3.5" /></>,
    camera: <><path d="M5 7.5h3l1.2-2h5.6l1.2 2h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z" /><circle cx="12" cy="13" r="3.5" /></>,
    file: <><path d="M7 3.5h7l4 4V20H7z" /><path d="M14 3.5V8h4M9.5 12h5M9.5 15h5" /></>,
  };
  return <svg viewBox="0 0 24 24" className="h-[21px] w-[21px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function mediaLabel(media: WebChatComposerAttachment) {
  if (media.kind === "voice") return "语音";
  if (media.kind === "sticker") return "表情包";
  if (media.kind === "image") return "图片";
  if (isWebChatPendingUpload(media)) return String(media.fileName || "文件");
  return String(media.fileName || media.sourceFileName || "文件");
}

function mediaIdentity(media: WebChatComposerAttachment) {
  if (isWebChatPendingUpload(media)) return media.uploadId;
  return String(
    media.mediaKey
    || media.absolutePath
    || media.path
    || media.relativePath
    || media.url
    || media.fileName
    || media.label,
  );
}

export function ConversationComposer({
  status,
  models,
  usageTotals,
  contextUsage,
  modelCatalogError = "",
  runtimeSettingsNotice = "",
  connection,
  quoteMessage,
  onClearQuote,
  onSendMessages,
  onChooseModel,
  onChooseEffort,
  onRefreshModels,
  isNewThread = false,
  error = "",
  loadStickers,
  loadStickerAsset,
  mediaUrls,
  onVoiceDraftPresenceChange,
  onVoiceDraftSendRequest,
  voiceTriggerIcon,
}: {
  status?: WebChatStatus | null;
  models?: WebChatModelResponse | null;
  usageTotals?: WebChatUsageTotals | null;
  contextUsage?: WebChatUsage | null;
  modelCatalogError?: string;
  runtimeSettingsNotice?: string;
  connection?: string;
  quoteMessage?: ConversationRecord | null;
  onClearQuote?: () => void;
  onSendMessages: (input: { messages: WebChatComposerMessageInput[]; newThread: boolean }) => unknown;
  onChooseModel?: (model: string, modelProvider?: string) => Promise<unknown>;
  onChooseEffort?: (effort: string) => Promise<unknown>;
  onRefreshModels?: () => Promise<unknown>;
  isNewThread?: boolean;
  error?: string;
  loadStickers: () => Promise<{ stickers: StickerAsset[] }>;
  loadStickerAsset: (sticker: StickerAsset) => Promise<Blob>;
  mediaUrls: import("../../lib/conversation").ConversationMediaUrlPort;
  onVoiceDraftPresenceChange?: (hasDraft: boolean) => void;
  onVoiceDraftSendRequest?: (draft: VoiceDraft) => Promise<unknown> | unknown;
  voiceTriggerIcon?: ReactNode;
}) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<WebChatComposerAttachment[]>([]);
  const [queuedMessages, setQueuedMessages] = useState<WebChatComposerMessageInput[]>([]);
  const [localError, setLocalError] = useState("");
  const [voiceDraftSending, setVoiceDraftSending] = useState(false);
  const [panel, setPanel] = useState<"more" | "stickers" | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const composerRef = useRef<HTMLElement | null>(null);
  const detailsRef = useRef<HTMLDivElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sendingRef = useRef(false);
  const stickerSendingRef = useRef(false);
  const reduceMotion = useReducedMotion();
  const voiceRecorder = useVoiceDraftRecorder({ onDraftPresenceChange: onVoiceDraftPresenceChange });
  const displayError = localError || voiceRecorder.errorText || (error && !/failed to fetch/i.test(error) ? error : "");

  const quote = useMemo<ConversationQuoteObject | null>(() => {
    if (!quoteMessage) return null;
    const textValue = getConversationDisplayText(quoteMessage).trim();
    const media = getConversationPrimaryMediaItem(quoteMessage);
    const kind = getConversationVisualKind(quoteMessage);
    const quoteRenderId = getConversationRenderId(quoteMessage);
    return {
      text: textValue.slice(0, 4_000) || (kind === "sticker" ? "[表情包]" : kind === "image" ? "[图片]" : kind === "file" ? `[文件] ${media?.fileName || media?.label || ""}` : kind === "voice" ? "[语音]" : `[${kind}]`),
      title: quoteMessage.type === "user" ? "我" : "AI",
      messageId: getConversationMessageId(quoteMessage)
        || getConversationItemId(quoteMessage)
        || getLegacyStableId(quoteMessage),
      bubbleId: String(
        quoteMessage.meta?.quoteBubbleId
        || createBubbleId(quoteRenderId, "message"),
      ),
      contentType: kind,
      previewThumbnail: media
        ? getConversationMediaSrc(media, mediaUrls)
        : "",
      previewMeta: media || undefined,
    };
  }, [mediaUrls, quoteMessage]);

  const currentModel = status?.model || models?.currentModel || "默认模型";
  const compactStatus = buildCompactRuntimeStatus({
    model: currentModel,
    contextUsage,
    models,
  });
  const canSend = Boolean(queuedMessages.length || text.trim() || attachments.length);
  // Voice upload is a production capability, so missing or partial status
  // must fail closed instead of exposing a microphone that can only error.
  const voiceInputEnabled = Boolean(
    status?.voiceInput?.enabled
      && status.voiceInput.configured
      && status.voiceInput.available,
  );

  useEffect(() => {
    if (!voiceRecorder.draft) return;
    setPanel(null);
    setDetailsOpen(false);
  }, [voiceRecorder.draft]);

  useLayoutEffect(() => {
    const composer = composerRef.current;
    const conversationPage = composer?.parentElement;
    if (!composer || !conversationPage) return undefined;

    const publishComposerHeight = () => {
      conversationPage.style.setProperty(
        "--conversation-composer-height",
        `${Math.ceil(composer.getBoundingClientRect().height)}px`,
      );
    };
    publishComposerHeight();
    const observer = new ResizeObserver(
      publishComposerHeight,
    );
    observer.observe(composer);
    return () => {
      observer.disconnect();
      conversationPage.style.removeProperty(
        "--conversation-composer-height",
      );
    };
  }, []);

  useEffect(() => {
    if (!detailsOpen && !panel) return undefined;
    const handleOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (panel && composerRef.current && !composerRef.current.contains(target)) {
        setPanel(null);
        setDetailsOpen(false);
        return;
      }
      if (detailsOpen && detailsRef.current && !detailsRef.current.contains(target)) {
        setDetailsOpen(false);
      }
    };
    document.addEventListener("pointerdown", handleOutsidePointer);
    return () => document.removeEventListener("pointerdown", handleOutsidePointer);
  }, [detailsOpen, panel]);

  const buildCurrentMessage = () => {
    const nextText = text.trim();
    if (!nextText && !attachments.length) return null;
    return { segmentId: makeSegmentId(), text: nextText, quote, attachments } satisfies WebChatComposerMessageInput;
  };

  const resetCurrent = () => {
    setText("");
    setAttachments([]);
    onClearQuote?.();
  };

  const queueCurrent = () => {
    const message = buildCurrentMessage();
    if (!message) return;
    setQueuedMessages((current) => [...current, message]);
    resetCurrent();
  };

  const sendAll = () => {
    if (sendingRef.current) return;
    const current = buildCurrentMessage();
    const messages = current ? [...queuedMessages, current] : queuedMessages;
    if (!messages.length) return;
    sendingRef.current = true;
    setLocalError("");
    try {
      onSendMessages({ messages, newThread: isNewThread });
      setQueuedMessages([]);
      resetCurrent();
      setPanel(null);
    } catch {
      setLocalError("发送失败，请稍后重试。");
    } finally {
      window.setTimeout(() => {
        sendingRef.current = false;
      }, 0);
    }
  };

  const stageFiles = (files: FileList | null, kindOverride = "") => {
    const selected = Array.from(files ?? []);
    if (!selected.length) return;
    setLocalError("");
    const staged = selected.map((file) => createWebChatPendingUpload(file, {
      fileName: file.name,
      kind: kindOverride || (file.type.startsWith("image/") ? "image" : file.type.startsWith("audio/") ? "voice" : "file"),
    }));
    setAttachments((current) => [...current, ...staged]);
    setPanel(null);
  };

  const sendSticker = async (sticker: StickerAsset) => {
    if (stickerSendingRef.current) return;
    stickerSendingRef.current = true;
    try {
      const blob = await loadStickerAsset(sticker);
      await onSendMessages({
        newThread: isNewThread,
        messages: [{
          segmentId: makeSegmentId(),
          text: "",
          quote,
          attachments: [createWebChatPendingUpload(blob, {
            fileName: sticker.fileName,
            kind: "sticker",
            stickerId: sticker.id,
            label: sticker.name,
          })],
        }],
      });
      onClearQuote?.();
      setPanel(null);
    } catch {
      setLocalError("表情包发送失败，请稍后重试。");
    } finally {
      stickerSendingRef.current = false;
    }
  };

  const handleVoicePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!voiceInputEnabled) {
      setLocalError("语音输入当前未启用。");
      return;
    }
    if (text.trim() || attachments.length || queuedMessages.length || quote) {
      setLocalError("录制语音前请先发送或清空当前文字与附件。");
      return;
    }
    setLocalError("");
    voiceRecorder.handlePointerDown(event);
  };

  const requestVoiceDraftSend = async () => {
    if (!voiceRecorder.draft || voiceDraftSending) return;
    if (!onVoiceDraftSendRequest) {
      setLocalError("语音草稿已保留；生产上传契约尚未接入。");
      return;
    }
    try {
      setLocalError("");
      setVoiceDraftSending(true);
      await onVoiceDraftSendRequest(voiceRecorder.draft);
      voiceRecorder.discardDraft();
    } catch {
      setLocalError("语音草稿未发送，仍保留在当前页面。");
    } finally {
      setVoiceDraftSending(false);
    }
  };

  const spring = reduceMotion
    ? { duration: 0.08 }
    : { type: "spring" as const, duration: 0.24, bounce: 0 };
  const panelEnter = reduceMotion
    ? { duration: 0.08 }
    : { duration: 0.16, ease: [0.23, 1, 0.32, 1] as const };
  const panelExit = reduceMotion
    ? { duration: 0.06 }
    : { duration: 0.1, ease: [0.4, 0, 1, 1] as const };
  const toggleRuntimeDetails = () => {
    const opening = !detailsOpen;
    setDetailsOpen(opening);
    setPanel(null);
    if (opening) {
      void onRefreshModels?.();
    }
  };

  return (
      <section
        ref={composerRef}
        className={`conversation-composer z-40 bg-transparent px-3 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2 ${panel ? "fixed inset-x-0 bottom-0 z-[90] max-h-[calc(100dvh-16px)] overflow-visible" : "absolute inset-x-0 bottom-0"}`}
        style={{ transform: panel ? undefined : "translateY(calc(var(--app-keyboard-inset, 0px) * -1))" }}
      >
      <div className="relative z-20 mx-auto max-w-[760px]">
        <div
          ref={detailsRef}
          className="conversation-runtime-selection-lock relative mb-2 ml-2 flex"
          onCopy={(event) => event.preventDefault()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <button type="button" onClick={toggleRuntimeDetails} className="max-w-full truncate rounded-full border border-black/[0.055] bg-white/75 px-3 py-1.5 text-left text-[10px] font-medium text-black/38 shadow-[0_2px_10px_rgba(60,55,70,.04)] backdrop-blur-xl" aria-expanded={detailsOpen}>
            <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${connection === "open" ? "bg-[#8da891]" : "bg-[#c7a681]"}`} />{compactStatus}
          </button>
          <AnimatePresence>
            {detailsOpen ? (
              <motion.div initial={{ opacity: 0, transform: "translateY(5px)" }} animate={{ opacity: 1, transform: "translateY(0px)" }} exit={{ opacity: 0, transform: "translateY(5px)" }} transition={spring} className="absolute bottom-[calc(100%+7px)] left-0 z-20 w-[min(88vw,310px)] rounded-[20px] bg-white/95 p-3 shadow-[0_14px_42px_rgba(61,56,73,.14)] backdrop-blur-xl">
                <ConversationRuntimePanel
                  status={status}
                  models={models}
                  usageTotals={usageTotals}
                  contextUsage={contextUsage}
                  modelCatalogError={modelCatalogError}
                  runtimeSettingsNotice={runtimeSettingsNotice}
                  onChooseModel={onChooseModel}
                  onChooseEffort={onChooseEffort}
                  onRefreshModels={onRefreshModels}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {quote ? (
          <div className="mb-2 flex min-h-12 items-center gap-2 rounded-[16px] bg-white/80 px-3 py-2 shadow-[0_3px_14px_rgba(60,55,70,.05)]">
            {quote.previewThumbnail ? <img src={String(quote.previewThumbnail)} className="h-9 w-9 shrink-0 rounded-[9px] object-cover" alt="引用缩略图" /> : <span className="h-8 w-0.5 rounded-full bg-[#b5a0ca]" />}
            <div className="min-w-0 flex-1"><b className="block text-[10px] font-semibold text-[#79668d]">引用 {String(quote.title)}</b><span className="line-clamp-2 text-[11px] leading-4 text-black/48">{String(quote.text)}</span></div>
            <button type="button" onClick={onClearQuote} className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-black/30" aria-label="取消引用">×</button>
          </div>
        ) : null}

        {attachments.length ? (
          <div className="mb-2 flex gap-1.5 overflow-x-auto px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {attachments.map((media, index) => <button key={mediaIdentity(media)} type="button" onClick={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="shrink-0 rounded-full bg-white/82 px-2.5 py-1.5 text-[10px] text-black/50 shadow-sm">{mediaLabel(media)} ×</button>)}
          </div>
        ) : null}

        <VoiceComposerBar
            mode={voiceDraftSending ? "uploading" : voiceRecorder.phase}
            text={text}
            onTextChange={setText}
            placeholder={queuedMessages.length ? "Enter Merge" : "Send Message…"}
            durationMs={voiceRecorder.durationMs}
            warning={voiceRecorder.warning}
            draft={voiceRecorder.draft}
            onOpenMore={() => { setPanel((value) => value === "more" ? null : "more"); setDetailsOpen(false); }}
            onOpenEmoji={() => { setPanel((value) => value === "stickers" ? null : "stickers"); setDetailsOpen(false); }}
            onSendText={sendAll}
            onStageText={queueCurrent}
            onDeleteDraft={voiceRecorder.discardDraft}
            onSendDraft={() => void requestVoiceDraftSend()}
            onStopRecording={() => voiceRecorder.finishRecording(false)}
            onVoicePointerDown={handleVoicePointerDown}
            onVoicePointerMove={voiceRecorder.handlePointerMove}
            onVoicePointerUp={voiceRecorder.handlePointerUp}
            onVoicePointerCancel={voiceRecorder.handlePointerCancel}
            voiceTriggerIcon={voiceTriggerIcon}
            voiceInputEnabled={voiceInputEnabled}
            sendTextEnabled={canSend}
            moreOpen={panel === "more"}
            emojiOpen={panel === "stickers"}
        />
        {displayError ? <div className="mt-1.5 px-3 text-[10px] text-[#b45f68]" role="alert">{displayError}</div> : null}
      </div>
      <AnimatePresence>
        {panel ? (
          <>
            <motion.button
              type="button"
              className="fixed inset-0 z-0 bg-transparent"
              aria-label="关闭输入面板"
              onClick={() => setPanel(null)}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: panel ? 0.08 : 0.05 }}
            />
            <motion.div
              className="relative z-10 mx-auto mt-2 w-full max-w-[760px] overflow-hidden rounded-[26px] bg-white/95 shadow-[0_-8px_30px_rgba(50,45,58,.08)] backdrop-blur-xl"
              initial={{ opacity: 0, transform: "translateY(14px)" }}
              animate={{ opacity: 1, transform: "translateY(0px)", transition: panelEnter }}
              exit={{ opacity: 0, transform: "translateY(8px)", transition: panelExit }}
            >
              <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-black/10" />
              {panel === "more" ? (
                <div className="grid grid-cols-4 gap-x-3 gap-y-5 px-5 pb-6 pt-5">
                  {[
                    ["photo", "相册", () => { setPanel(null); galleryInputRef.current?.click(); }],
                    ["camera", "拍摄", () => { setPanel(null); cameraInputRef.current?.click(); }],
                    ["file", "文件", () => { setPanel(null); fileInputRef.current?.click(); }],
                  ].map(([icon, label, action]) => (
                    <button key={String(label)} type="button" onClick={action as () => void} className="group flex min-w-0 flex-col items-center gap-2 text-[12px] text-black/55">
                      <span className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-[#f5f3f7] text-black/65 transition-transform group-active:scale-[0.94]"><Icon name={icon as "photo" | "camera" | "file"} /></span>
                      {String(label)}
                    </button>
                  ))}
                  <div className="flex flex-col items-center gap-2 text-[12px] text-black/25"><span className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-black/[0.025]">···</span>更多</div>
                </div>
              ) : <div className="h-[min(38dvh,320px)]"><StickerPanel onSelect={sendSticker} loadStickers={loadStickers} /></div>}
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {queuedMessages.length ? (
          <motion.div
            className="pointer-events-none absolute inset-x-0 bottom-[calc(100%+8px)] z-50 mx-auto flex max-w-[760px] flex-col items-end gap-1.5 px-5"
          >
            {queuedMessages.map((message, index) => (
              <motion.button
                key={message.segmentId}
                type="button"
                initial={{ opacity: 0, transform: "translate(14px, 6px)" }}
                animate={{ opacity: 0.9, transform: "translate(0px, 0px) scale(1)" }}
                exit={{ opacity: 0, transform: "translateX(8px) scale(0.94)" }}
                transition={spring}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={() => setQueuedMessages((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                className="pointer-events-auto max-w-[78%] rounded-[18px] rounded-br-[7px] bg-[#e9e3f1] px-3 py-2 text-left text-[13px] leading-5 text-[#51475f] shadow-[0_5px_16px_rgba(91,75,112,.08)]"
                title="点击移除这条待发送消息"
              >
                {message.text || `${message.attachments?.length || 0} 个附件`}
              </motion.button>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
      <input ref={galleryInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => { stageFiles(event.target.files, "image"); event.currentTarget.value = ""; }} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => { stageFiles(event.target.files, "image"); event.currentTarget.value = ""; }} />
      <input ref={fileInputRef} type="file" className="hidden" onChange={(event) => { stageFiles(event.target.files, "file"); event.currentTarget.value = ""; }} />
    </section>
  );
}
