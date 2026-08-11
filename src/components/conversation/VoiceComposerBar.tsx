import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import React, { type ReactNode, type PointerEvent as ReactPointerEvent } from "react";
import { LiveVoiceWaveform, VoiceWaveform, VOICE_COMPOSER_WAVE_HEIGHTS } from "../voice/VoiceWaveform";
import { useCoordinatedAudio } from "../voice/useCoordinatedAudio";
import type { VoiceDraft, VoiceRecorderPhase } from "./useVoiceDraftRecorder";

export type VoiceComposerFixtureMode = VoiceRecorderPhase | "uploading" | "disabled";

export function resolveComposerEnterAction({
  key,
  shiftKey,
  isComposing,
}: {
  key: string;
  shiftKey: boolean;
  isComposing: boolean;
}) {
  if (key !== "Enter") return "none" as const;
  if (shiftKey || isComposing) return "newline" as const;
  return "stage" as const;
}

function formatDuration(ms: number) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function VoiceGlyph() {
  return <span className="voice-composer-glyph" aria-hidden="true"><i /><i /><i /><i /><i /></span>;
}

function ComposerIcon({ name }: { name: "plus" | "smile" }) {
  const path = name === "plus"
    ? <path d="M12 5v14M5 12h14" />
    : <><circle cx="12" cy="12" r="8.5" /><path d="M8.5 10h.01M15.5 10h.01M8.5 14c1 1.35 2.15 2 3.5 2s2.5-.65 3.5-2" /></>;
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{path}</svg>;
}

function SendGlyph() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m4 5 16 7-16 7 3-7-3-7Zm3 7h13" /></svg>;
}

function DraftPlayback({ draft, disabled }: { draft: VoiceDraft; disabled: boolean }) {
  const playback = useCoordinatedAudio({
    id: `voice-draft:${draft.id}`,
    src: draft.objectUrl,
    durationHint: draft.durationMs / 1000,
    disabled,
  });
  return (
    <>
      <audio ref={playback.audioRef} src={draft.objectUrl} preload="metadata" {...playback.audioProps} />
      <button type="button" className="voice-composer-draft-play" aria-label={playback.playing ? "暂停试听" : "试听语音"} disabled={disabled} onClick={() => void playback.toggle()}>
        {playback.playing ? <span aria-hidden="true">Ⅱ</span> : <span aria-hidden="true">▶</span>}
      </button>
      <VoiceWaveform
        progress={playback.progress}
        onSeek={playback.seek}
        disabled={disabled}
        heights={VOICE_COMPOSER_WAVE_HEIGHTS}
        label={`调整试听进度，当前 ${formatDuration(playback.currentTime * 1000)}`}
        className="voice-composer-draft-wave"
      />
    </>
  );
}

export function VoiceComposerBar({
  mode,
  text,
  onTextChange,
  placeholder = "Send Message…",
  durationMs = 0,
  warning = false,
  draft,
  onOpenMore,
  onOpenEmoji,
  onSendText,
  onStageText,
  onDeleteDraft,
  onSendDraft,
  onStopRecording,
  onVoicePointerDown,
  onVoicePointerMove,
  onVoicePointerUp,
  onVoicePointerCancel,
  voiceTriggerIcon,
  voiceInputEnabled = true,
  disabled = false,
  sendTextEnabled,
  moreOpen = false,
  emojiOpen = false,
}: {
  mode: VoiceComposerFixtureMode;
  text: string;
  onTextChange: (value: string) => void;
  placeholder?: string;
  durationMs?: number;
  warning?: boolean;
  draft?: VoiceDraft | null;
  onOpenMore?: () => void;
  onOpenEmoji?: () => void;
  onSendText?: () => void;
  onStageText?: () => void;
  onDeleteDraft?: () => void;
  onSendDraft?: () => void;
  onStopRecording?: () => void;
  onVoicePointerDown?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onVoicePointerMove?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onVoicePointerUp?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onVoicePointerCancel?: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  voiceTriggerIcon?: ReactNode;
  voiceInputEnabled?: boolean;
  disabled?: boolean;
  sendTextEnabled?: boolean;
  moreOpen?: boolean;
  emojiOpen?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const effectiveDisabled = disabled || mode === "disabled" || mode === "uploading";
  const voiceTriggerDisabled = effectiveDisabled || !voiceInputEnabled;
  const draftMode = mode === "draft" || mode === "uploading";
  const recordingMode = mode === "recording" || mode === "cancelling" || mode === "requesting";
  const transition = { duration: reduceMotion ? 0.01 : 0.2, ease: [0.23, 1, 0.32, 1] as const };

  return (
    <div className={`voice-composer-bar ${draftMode ? "is-draft" : ""} ${recordingMode ? "is-recording" : ""} ${mode === "cancelling" ? "is-cancelling" : ""} ${warning ? "is-warning" : ""}`} data-voice-composer-mode={mode}>
      <button
        type="button"
        className={`voice-composer-side-action ${moreOpen ? "is-active" : ""}`}
        aria-label={draftMode ? "删除语音草稿" : "更多功能"}
        disabled={effectiveDisabled}
        onClick={draftMode ? onDeleteDraft : onOpenMore}
      >
        <span className="voice-composer-side-action__plus" aria-hidden="true"><ComposerIcon name="plus" /></span>
        <span className="voice-composer-side-action__delete" aria-hidden="true">×</span>
      </button>
      <div className="voice-composer-shell">
        <AnimatePresence initial={false} mode="sync">
          {!draftMode && !recordingMode ? (
            <motion.div key="text" className="voice-composer-panel voice-composer-panel--text" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={transition}>
              <textarea
                value={text}
                onChange={(event) => onTextChange(event.target.value)}
                onKeyDown={(event) => {
                  const action = resolveComposerEnterAction({
                    key: event.key,
                    shiftKey: event.shiftKey,
                    isComposing: event.nativeEvent.isComposing,
                  });
                  if (action !== "stage" || !onStageText) return;
                  event.preventDefault();
                  onStageText();
                }}
                rows={1}
                placeholder={placeholder}
                disabled={effectiveDisabled}
                className="conversation-composer-textarea voice-composer-textarea"
              />
              <button type="button" className={`voice-composer-icon ${emojiOpen ? "is-active" : ""}`} aria-label="表情包" disabled={effectiveDisabled} onClick={onOpenEmoji}><ComposerIcon name="smile" /></button>
              <button
                type="button"
                className="voice-composer-trigger"
                aria-label="按住录音"
                aria-disabled={voiceTriggerDisabled}
                title={voiceInputEnabled ? "按住录音" : "语音输入当前未启用"}
                disabled={voiceTriggerDisabled}
                onPointerDown={onVoicePointerDown}
                onPointerMove={onVoicePointerMove}
                onPointerUp={onVoicePointerUp}
                onPointerCancel={onVoicePointerCancel}
              >
                {voiceTriggerIcon || <VoiceGlyph />}
              </button>
              <button type="button" className="voice-composer-send" aria-label="发送文字" disabled={effectiveDisabled || !(sendTextEnabled ?? Boolean(text.trim()))} onClick={onSendText}><SendGlyph /></button>
            </motion.div>
          ) : recordingMode ? (
            <motion.div key="recording" className="voice-composer-panel voice-composer-panel--recording" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={transition}>
              <LiveVoiceWaveform cancelling={mode === "cancelling"} warning={warning} />
              <span className="voice-composer-record-time">{formatDuration(durationMs)}</span>
              <button type="button" className="voice-composer-stop" aria-label="结束录音" onClick={onStopRecording}><span aria-hidden="true" /></button>
            </motion.div>
          ) : (
            <motion.div key="draft" className="voice-composer-panel voice-composer-panel--draft" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={transition}>
              {draft ? <DraftPlayback draft={draft} disabled={effectiveDisabled} /> : <><button type="button" className="voice-composer-draft-play" disabled aria-label="试听不可用">▶</button><VoiceWaveform progress={0} disabled heights={VOICE_COMPOSER_WAVE_HEIGHTS} className="voice-composer-draft-wave" /></>}
              <span className="voice-composer-duration">{formatDuration(draft?.durationMs ?? durationMs)}</span>
              <button type="button" className="voice-composer-send" aria-label={mode === "uploading" ? "上传中" : "发送语音"} disabled={effectiveDisabled} onClick={onSendDraft}>{mode === "uploading" ? <span className="voice-composer-uploading-dot" /> : <SendGlyph />}</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {mode === "cancelling" ? <motion.div className="voice-composer-cancel-hint" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} transition={transition}>松手取消</motion.div> : null}
        {warning && mode === "recording" ? <motion.div className="voice-composer-warning-hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={transition}>还剩 10 秒</motion.div> : null}
      </AnimatePresence>
    </div>
  );
}
