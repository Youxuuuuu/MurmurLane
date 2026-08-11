import React, { type CSSProperties, type KeyboardEvent, type MouseEvent } from "react";

export const VOICE_WAVE_HEIGHTS = [8, 17, 25, 13, 21, 29, 15, 24, 10, 19, 27, 12] as const;
export const VOICE_COMPOSER_WAVE_HEIGHTS = [
  7, 9, 8, 10, 9, 12, 17, 25, 30, 27, 19, 16, 19, 25, 29,
  27, 24, 19, 24, 18, 13, 18, 24, 29, 28, 19, 12, 9, 8,
] as const;

function WaveLayer({
  heights,
  active = false,
}: {
  heights: readonly number[];
  active?: boolean;
}) {
  return (
    <span
      className={`voice-waveform__layer ${active ? "voice-waveform__layer--active" : ""}`}
      aria-hidden="true"
    >
      <span className="voice-waveform__geometry">
        {heights.map((height, index) => (
          <i
            key={`${height}-${index}`}
            style={{
              "--voice-bar-height": `${height}px`,
              "--voice-bar-delay": `${(index % 6) * -80}ms`,
            } as CSSProperties}
          />
        ))}
      </span>
    </span>
  );
}

export function VoiceWaveform({
  progress,
  onSeek,
  disabled = false,
  label = "调整播放进度",
  heights = VOICE_WAVE_HEIGHTS,
  className = "",
}: {
  progress: number;
  onSeek?: (ratio: number) => void;
  disabled?: boolean;
  label?: string;
  heights?: readonly number[];
  className?: string;
}) {
  const safeProgress = Math.min(1, Math.max(0, progress || 0));
  const seekFromClientX = (clientX: number, target: HTMLElement) => {
    if (disabled || !onSeek) return;
    const visualTrack = target.querySelector<HTMLElement>(".voice-waveform__geometry");
    const rect = visualTrack?.getBoundingClientRect() ?? target.getBoundingClientRect();
    if (!rect.width) return;
    onSeek(Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)));
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!onSeek || disabled) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    onSeek(Math.min(1, Math.max(0, safeProgress + (event.key === "ArrowRight" ? 0.05 : -0.05))));
  };

  return (
    <button
      type="button"
      className={`voice-waveform ${className}`}
      style={{ "--voice-progress": `${safeProgress * 100}%` } as CSSProperties}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(safeProgress * 100)}
      disabled={disabled}
      onClick={(event: MouseEvent<HTMLButtonElement>) => seekFromClientX(event.clientX, event.currentTarget)}
      onKeyDown={handleKeyDown}
    >
      <WaveLayer heights={heights} />
      <span className="voice-waveform__played">
        <WaveLayer heights={heights} active />
      </span>
    </button>
  );
}

export function LiveVoiceWaveform({ cancelling = false, warning = false }: { cancelling?: boolean; warning?: boolean }) {
  return (
    <span
      className={`voice-live-wave ${cancelling ? "is-cancelling" : ""} ${warning ? "is-warning" : ""}`}
      aria-hidden="true"
    >
      {VOICE_COMPOSER_WAVE_HEIGHTS.map((height, index) => (
        <i
          key={`${height}-${index}`}
          style={{
            "--voice-bar-height": `${height}px`,
            "--voice-bar-delay": `${(index % 9) * -55}ms`,
          } as CSSProperties}
        />
      ))}
    </span>
  );
}
