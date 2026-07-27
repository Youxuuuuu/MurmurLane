import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
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
  WebChatModel,
  WebChatModelResponse,
  WebChatStatus,
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

const FALLBACK_MODEL_IDS = [
  "qwen3.6-flash",
  "qwen3.5-flash-2026-02-23",
  "qwen3.5-plus",
];

function makeSegmentId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `segment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatTokens(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "0";
  if (number >= 1_000_000) return `${(number / 1_000_000).toFixed(1)}m`;
  if (number >= 1_000) return `${Math.round(number / 100) / 10}k`;
  return String(Math.round(number));
}

function Icon({ name }: { name: "plus" | "smile" | "mic" | "send" | "photo" | "camera" | "file" }) {
  const paths = {
    plus: <path d="M12 5v14M5 12h14" />,
    smile: <><circle cx="12" cy="12" r="8.5" /><path d="M8.5 10h.01M15.5 10h.01M8.5 14c1 1.35 2.15 2 3.5 2s2.5-.65 3.5-2" /></>,
    mic: <><rect x="9" y="4" width="6" height="11" rx="3" /><path d="M6.5 12.5a5.5 5.5 0 0 0 11 0M12 18v3" /></>,
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
  connection,
  quoteMessage,
  onClearQuote,
  onSendMessages,
  onChooseModel,
  isNewThread = false,
  error = "",
  loadStickers,
  loadStickerAsset,
  mediaUrls,
}: {
  status?: WebChatStatus | null;
  models?: WebChatModelResponse | null;
  connection?: string;
  quoteMessage?: ConversationRecord | null;
  onClearQuote?: () => void;
  onSendMessages: (input: { messages: WebChatComposerMessageInput[]; newThread: boolean }) => unknown;
  onChooseModel?: (model: string, modelProvider?: string) => Promise<unknown>;
  isNewThread?: boolean;
  error?: string;
  loadStickers: () => Promise<{ stickers: StickerAsset[] }>;
  loadStickerAsset: (sticker: StickerAsset) => Promise<Blob>;
  mediaUrls: import("../../lib/conversation").ConversationMediaUrlPort;
}) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<WebChatComposerAttachment[]>([]);
  const [queuedMessages, setQueuedMessages] = useState<WebChatComposerMessageInput[]>([]);
  const [recording, setRecording] = useState(false);
  const [localError, setLocalError] = useState("");
  const [panel, setPanel] = useState<"more" | "stickers" | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const composerRef = useRef<HTMLElement | null>(null);
  const detailsRef = useRef<HTMLDivElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const sendingRef = useRef(false);
  const stickerSendingRef = useRef(false);
  const reduceMotion = useReducedMotion();
  const displayError = localError || (error && !/failed to fetch/i.test(error) ? error : "");

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

  const usage = status?.usage;
  const currentModel = status?.model || models?.currentModel || "默认模型";
  const cacheValue = usage?.cacheReadInputTokens ?? usage?.cachedInputTokens;
  const inputValue = Number(usage?.inputTokens) || 0;
  const cacheReadValue = Number(cacheValue) || 0;
  const cacheCreationValue = Number(usage?.cacheCreationInputTokens) || 0;
  const cacheEligibleInput = inputValue + cacheReadValue + cacheCreationValue;
  const cacheHitRate = cacheEligibleInput > 0
    ? `${Math.round((cacheReadValue / cacheEligibleInput) * 1_000) / 10}%`
    : "0%";
  const compactStatus = `${currentModel} · context ${formatTokens(usage?.currentTokens || usage?.inputTokens)} · cache ${formatTokens(cacheValue)}`;
  const canSend = Boolean(queuedMessages.length || text.trim() || attachments.length);

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

  const toggleRecording = async () => {
    if (recording && recorderRef.current) {
      recorderRef.current.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setLocalError("当前浏览器不支持录音");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      voiceChunksRef.current = [];
      recorder.ondataavailable = (event) => event.data.size && voiceChunksRef.current.push(event.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
        const blob = new Blob(voiceChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (!blob.size) return;
        setAttachments((current) => [...current, createWebChatPendingUpload(blob, {
          fileName: `voice-${Date.now()}.webm`,
          kind: "voice",
        })]);
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setLocalError("无法开始录音，请检查麦克风权限。");
    }
  };

  const modelOptions = useMemo(() => {
    const byId = new Map<string, WebChatModel>();
    (models?.models ?? []).forEach((item) => {
      const id = String(item.model || item.id || "").trim();
      if (id) byId.set(id, item);
    });
    [currentModel, ...FALLBACK_MODEL_IDS].forEach((id) => {
      if (id && id !== "默认模型" && !byId.has(id)) {
        byId.set(id, { id, model: id, displayName: id });
      }
    });
    return Array.from(byId.values());
  }, [currentModel, models?.models]);
  const handleModelChange = (model: string) => {
    const selected = modelOptions.find((item) => (item.model || item.id) === model);
    void onChooseModel?.(
      model,
      String(selected?.modelProvider || selected?.provider || ""),
    );
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

  return (
      <section
        ref={composerRef}
        className={`conversation-composer z-40 bg-transparent px-3 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2 ${panel ? "fixed inset-x-0 bottom-0 z-[90] max-h-[calc(100dvh-16px)] overflow-visible" : "absolute inset-x-0 bottom-0"}`}
        style={{ transform: panel ? undefined : "translateY(calc(var(--app-keyboard-inset, 0px) * -1))" }}
      >
      <div className="relative z-20 mx-auto max-w-[760px]">
        <div ref={detailsRef} className="relative mb-2 ml-2 flex">
          <button type="button" onClick={() => { setDetailsOpen((value) => !value); setPanel(null); }} className="max-w-full truncate rounded-full border border-black/[0.055] bg-white/75 px-3 py-1.5 text-left text-[10px] font-medium text-black/38 shadow-[0_2px_10px_rgba(60,55,70,.04)] backdrop-blur-xl" aria-expanded={detailsOpen}>
            <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${connection === "open" ? "bg-[#8da891]" : "bg-[#c7a681]"}`} />{compactStatus}
          </button>
          <AnimatePresence>
            {detailsOpen ? (
              <motion.div initial={{ opacity: 0, transform: "translateY(5px)" }} animate={{ opacity: 1, transform: "translateY(0px)" }} exit={{ opacity: 0, transform: "translateY(5px)" }} transition={spring} className="absolute bottom-[calc(100%+7px)] left-0 z-20 w-[min(88vw,310px)] rounded-[20px] bg-white/95 p-3 shadow-[0_14px_42px_rgba(61,56,73,.14)] backdrop-blur-xl">
                <div className="mb-2 text-[11px] font-medium text-black/45">模型与上下文</div>
                <select value={currentModel === "默认模型" ? "" : currentModel} disabled={!onChooseModel} onChange={(event) => handleModelChange(event.target.value)} className="w-full rounded-[13px] bg-black/[0.04] px-3 py-2 text-[16px] font-normal text-black/70 outline-none">
                  {!currentModel || currentModel === "默认模型" ? <option value="">默认模型</option> : null}
                  {currentModel !== "默认模型" && !modelOptions.some((item) => (item.model || item.id) === currentModel) ? <option value={currentModel}>{currentModel}</option> : null}
                  {modelOptions.map((item) => <option key={item.model || item.id} value={item.model || item.id}>{item.displayName || item.model || item.id}</option>)}
                </select>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-black/42"><span>输入 {formatTokens(usage?.inputTokens)}</span><span>输出 {formatTokens(usage?.outputTokens)}</span><span>缓存 {formatTokens(cacheValue)}</span><span>命中率 {cacheHitRate}</span></div>
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

        <div className="flex items-end gap-1.5 rounded-[32px] bg-white p-1.5 shadow-[0_10px_34px_rgba(72,65,83,.13),0_1px_3px_rgba(72,65,83,.05)]">
          <button type="button" onClick={() => { setPanel((value) => value === "more" ? null : "more"); setDetailsOpen(false); }} className={`composer-icon-button ${panel === "more" ? "bg-[#eee9f3] text-[#725f87]" : "text-black/48"}`} aria-label="更多功能"><Icon name="plus" /></button>
          <div className="conversation-composer-input-shell min-w-0 flex-1 px-1">
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); queueCurrent(); } }}
              rows={1}
              placeholder={recording ? "正在录音…" : queuedMessages.length ? "Enter Merge" : "Send Message…"}
              className="conversation-composer-textarea block max-h-28 min-h-[42px] w-full resize-none bg-transparent py-[11px] text-[12px] font-bold leading-5 text-black/72 outline-none placeholder:text-black/35"
            />
          </div>
          <button type="button" onClick={() => { setPanel((value) => value === "stickers" ? null : "stickers"); setDetailsOpen(false); }} className={`composer-icon-button ${panel === "stickers" ? "bg-[#eee9f3] text-[#725f87]" : "text-black/48"}`} aria-label="表情包"><Icon name="smile" /></button>
          <button type="button" onClick={() => void toggleRecording()} className={`composer-icon-button ${recording ? "bg-[#d8868c] text-white" : "text-black/48"}`} aria-label={recording ? "停止录音" : "录制语音"}><Icon name="mic" /></button>
          <motion.button type="button" whileTap={reduceMotion ? undefined : { scale: 0.94 }} onClick={sendAll} disabled={!canSend} className="composer-icon-button bg-[#d8c9e6] text-white transition-colors disabled:bg-[#e9e1f0] disabled:text-white" aria-label={queuedMessages.length ? "合并发送" : "发送"}><Icon name="send" /></motion.button>
        </div>
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
