import React, { useEffect, useState, type ReactNode } from "react";
import { VoiceWaveform } from "./VoiceWaveform";
import { useCoordinatedAudio } from "./useCoordinatedAudio";

export type VoiceBubbleVariant = "cloud" | "sage" | "cream" | "outline" | "pebble" | "ribbon";

function formatTime(seconds: number) {
  const safe = Math.max(0, Math.round(seconds || 0));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

function PlayIcon({ paused }: { paused: boolean }) {
  return paused ? (
    <svg viewBox="0 0 13 13" aria-hidden="true"><path d="M3 2.2v8.6c0 .7.77 1.1 1.34.7l6.1-4.3a.86.86 0 0 0 0-1.4l-6.1-4.3A.83.83 0 0 0 3 2.2Z" fill="currentColor" /></svg>
  ) : (
    <svg viewBox="0 0 12 12" aria-hidden="true"><rect x="2.3" y="1.5" width="2.5" height="9" rx="1.1" fill="currentColor" /><rect x="7.2" y="1.5" width="2.5" height="9" rx="1.1" fill="currentColor" /></svg>
  );
}

function TranscriptIcon({ busy, failed }: { busy: boolean; failed: boolean }) {
  if (busy) {
    return <svg className="voice-message-bubble__processing-icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.25" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeDasharray="22 11" /></svg>;
  }
  if (failed) {
    return <svg className="voice-message-bubble__failed-icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M8 4.7v4.1M8 11.3h.01" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>;
  }
  return <svg viewBox="0 0 13 13" aria-hidden="true"><path d="M3 3.2h7M3 6.5h5.2M3 9.8h6.1" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>;
}

export function VoiceMessageBubble({
  id,
  audioSrc,
  durationHint = 0,
  transcript = "",
  variant = "cloud",
  side = "assistant",
  playbackDisabled = false,
  statusLabel = "",
  statusIcon,
  busy = false,
  className = "",
  needsTranscriptReview = false,
  retryable = false,
  onConfirmTranscript,
  onRetryTranscription,
}: {
  id: string;
  audioSrc: string;
  durationHint?: number;
  transcript?: string;
  variant?: VoiceBubbleVariant;
  side?: "assistant" | "user";
  playbackDisabled?: boolean;
  statusLabel?: string;
  statusIcon?: ReactNode;
  busy?: boolean;
  className?: string;
  needsTranscriptReview?: boolean;
  retryable?: boolean;
  onConfirmTranscript?: (text: string) => Promise<unknown> | unknown;
  onRetryTranscription?: () => Promise<unknown> | unknown;
}) {
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [transcriptDraft, setTranscriptDraft] = useState(transcript);
  const [actionPending, setActionPending] = useState(false);
  useEffect(() => setTranscriptDraft(transcript), [transcript]);
  const playback = useCoordinatedAudio({ id, src: audioSrc, durationHint, disabled: playbackDisabled });
  const time = playback.currentTime > 0 ? playback.currentTime : playback.duration;
  const failed = Boolean(statusLabel && !busy);

  return (
    <div
      className={`voice-message-bubble voice-message-bubble--${variant} voice-message-bubble--${side} ${playback.playing ? "is-playing" : ""} ${transcriptOpen ? "is-open" : ""} ${playbackDisabled ? "is-disabled" : ""} ${className}`}
      data-voice-ui="message-bubble"
      data-voice-id={id}
    >
      <audio ref={playback.audioRef} src={audioSrc || undefined} preload="metadata" {...playback.audioProps} />
      <div className="voice-message-bubble__row">
        <button
          type="button"
          className="voice-message-bubble__play"
          aria-label={playbackDisabled ? "语音暂不可播放" : playback.playing ? "暂停语音" : "播放语音"}
          disabled={playbackDisabled}
          onClick={() => void playback.toggle()}
        >
          <PlayIcon paused={!playback.playing} />
        </button>
        <VoiceWaveform
          progress={playback.progress}
          onSeek={playback.seek}
          disabled={playbackDisabled}
          label={`调整播放进度，当前 ${formatTime(playback.currentTime)}，总时长 ${formatTime(playback.duration)}`}
        />
        <span className="voice-message-bubble__time">{formatTime(time)}</span>
        <button
          type="button"
          className={`voice-message-bubble__transcript-toggle ${busy ? "is-processing" : ""} ${failed ? "is-failed" : ""}`}
          aria-label={`${statusLabel ? `${statusLabel}，` : ""}${transcriptOpen ? "收起文字" : "展开文字"}`}
          aria-expanded={transcriptOpen}
          title={statusLabel || undefined}
          onClick={() => setTranscriptOpen((current) => !current)}
        >
          {statusIcon || <TranscriptIcon busy={busy} failed={failed} />}
        </button>
      </div>
      {statusLabel ? <span className="voice-message-bubble__status-sr" role="status">{statusLabel}</span> : null}
      <div className="voice-message-bubble__transcript" hidden={!transcriptOpen}>
        {needsTranscriptReview ? (
          <div className="voice-message-bubble__review">
            <label className="voice-message-bubble__review-label" htmlFor={`voice-transcript-${id}`}>机器转写，可修改后确认</label>
            <textarea
              id={`voice-transcript-${id}`}
              value={transcriptDraft}
              disabled={actionPending}
              onChange={(event) => setTranscriptDraft(event.target.value)}
              className="voice-message-bubble__review-input"
              rows={3}
            />
            <div className="voice-message-bubble__review-actions">
              <button type="button" disabled={actionPending || !transcriptDraft.trim()} onClick={async () => {
                setActionPending(true);
                try { await onConfirmTranscript?.(transcriptDraft.trim()); } catch { /* workspace owns the visible error */ } finally { setActionPending(false); }
              }}>确认文字并发送</button>
              <button type="button" disabled={actionPending} onClick={async () => {
                setActionPending(true);
                try { await onRetryTranscription?.(); } catch { /* workspace owns the visible error */ } finally { setActionPending(false); }
              }}>重新转写</button>
            </div>
          </div>
        ) : (
          <>
            <span>{transcript || "暂无转写内容"}</span>
            {retryable && onRetryTranscription ? (
              <button type="button" className="voice-message-bubble__retry" disabled={actionPending} onClick={async () => {
                setActionPending(true);
                try { await onRetryTranscription(); } catch { /* workspace owns the visible error */ } finally { setActionPending(false); }
              }}>重新转写</button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
