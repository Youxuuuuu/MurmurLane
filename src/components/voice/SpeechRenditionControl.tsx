import { useState } from "react";
import { VoiceWaveform } from "./VoiceWaveform";
import { useCoordinatedAudio } from "./useCoordinatedAudio";
import type { SpeechRenditionView } from "../../lib/voiceMessage";

function formatTime(seconds: number) {
  const value = Math.max(0, Math.round(seconds || 0));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

function PlayIcon({ paused }: { paused: boolean }) {
  return paused ? (
    <svg viewBox="0 0 13 13" aria-hidden="true"><path d="M3 2.2v8.6c0 .7.77 1.1 1.34.7l6.1-4.3a.86.86 0 0 0 0-1.4l-6.1-4.3A.83.83 0 0 0 3 2.2Z" fill="currentColor" /></svg>
  ) : (
    <svg viewBox="0 0 12 12" aria-hidden="true"><rect x="2.3" y="1.5" width="2.5" height="9" rx="1.1" fill="currentColor" /><rect x="7.2" y="1.5" width="2.5" height="9" rx="1.1" fill="currentColor" /></svg>
  );
}

export function SpeechRenditionControl({
  id,
  view,
  audioSrc,
  onRetry,
}: {
  id: string;
  view: SpeechRenditionView;
  audioSrc: string;
  onRetry?: () => Promise<unknown> | unknown;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const playback = useCoordinatedAudio({
    id: `speech-rendition:${id}`,
    src: audioSrc,
    durationHint: view.durationSeconds,
    // A failed regeneration keeps the previous active asset playable. Status
    // describes the latest generation attempt; asset presence owns playback.
    disabled: !audioSrc,
  });
  const runRetry = async () => {
    if (!onRetry) return;
    setPending(true);
    try { await onRetry(); } finally { setPending(false); }
  };

  if (view.status === "unsupported") return null;
  return (
    <div className={`speech-rendition ${open ? "is-open" : ""}`} data-speech-rendition="true">
      <audio ref={playback.audioRef} src={audioSrc || undefined} preload="metadata" {...playback.audioProps} />
      <div className="speech-rendition__header">
        <button type="button" className="speech-rendition__toggle" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
          <span className="speech-rendition__dot" aria-hidden="true" />
          <span>{view.status === "synthesizing" ? "生成语音中" : view.status === "failed" ? "语音生成失败" : "语音"}</span>
        </button>
        {view.status === "failed" && onRetry ? (
          <button type="button" className="speech-rendition__retry" disabled={pending} onClick={() => void runRetry()}>
            {pending ? "重试中…" : "重试"}
          </button>
        ) : null}
      </div>
      {open && audioSrc ? (
        <div className="speech-rendition__player">
          <button type="button" className="speech-rendition__play" onClick={() => void playback.toggle()} aria-label={playback.playing ? "暂停语音" : "播放语音"}>
            <PlayIcon paused={!playback.playing} />
          </button>
          <VoiceWaveform progress={playback.progress} onSeek={playback.seek} label={`调整语音进度，当前 ${formatTime(playback.currentTime)}`} />
          <span className="speech-rendition__time">{formatTime(playback.currentTime || playback.duration)}</span>
        </div>
      ) : null}
    </div>
  );
}
