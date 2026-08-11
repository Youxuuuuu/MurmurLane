import { useCallback, useEffect, useRef, useState } from "react";
import { useAudioPlaybackCoordinator } from "./AudioPlaybackCoordinator";

export function useCoordinatedAudio({
  id,
  src,
  durationHint = 0,
  disabled = false,
}: {
  id: string;
  src: string;
  durationHint?: number;
  disabled?: boolean;
}) {
  const coordinator = useAudioPlaybackCoordinator();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationHint);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;
    return coordinator.register(id, audio);
  }, [coordinator, id]);

  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setDuration(durationHint);
  }, [durationHint, src]);

  const toggle = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || disabled || !src) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    if (audio.ended && Number.isFinite(audio.duration)) audio.currentTime = 0;
    await coordinator.play(id);
  }, [coordinator, disabled, id, src]);

  const seek = useCallback((ratio: number) => {
    const audio = audioRef.current;
    if (!audio || disabled) return;
    const effectiveDuration = Number.isFinite(audio.duration) ? audio.duration : duration;
    if (!effectiveDuration) return;
    audio.currentTime = Math.min(effectiveDuration, Math.max(0, ratio * effectiveDuration));
    setCurrentTime(audio.currentTime);
  }, [disabled, duration]);

  return {
    audioRef,
    currentTime,
    duration,
    playing,
    progress: duration > 0 ? Math.min(1, currentTime / duration) : 0,
    seek,
    toggle,
    audioProps: {
      onDurationChange: () => {
        const next = audioRef.current?.duration;
        if (next && Number.isFinite(next)) setDuration(next);
      },
      onLoadedMetadata: () => {
        const next = audioRef.current?.duration;
        if (next && Number.isFinite(next)) setDuration(next);
      },
      onTimeUpdate: () => setCurrentTime(audioRef.current?.currentTime || 0),
      onPlay: () => setPlaying(true),
      onPause: () => setPlaying(false),
      onEnded: () => {
        setPlaying(false);
        const next = audioRef.current?.duration;
        if (next && Number.isFinite(next)) setCurrentTime(next);
        coordinator.notifyEnded(id);
      },
    },
  };
}

