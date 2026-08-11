import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";

export interface CoordinatedAudioTarget {
  pause(): void;
  play(): Promise<void>;
  readonly paused: boolean;
  currentTime: number;
}

export class AudioPlaybackCoordinator {
  private readonly targets = new Map<string, CoordinatedAudioTarget>();
  private activeId = "";

  register(id: string, target: CoordinatedAudioTarget) {
    this.targets.set(id, target);
    return () => {
      if (this.targets.get(id) !== target) return;
      if (this.activeId === id) {
        target.pause();
        this.activeId = "";
      }
      this.targets.delete(id);
    };
  }

  async play(id: string) {
    const target = this.targets.get(id);
    if (!target) return;

    if (this.activeId && this.activeId !== id) {
      this.targets.get(this.activeId)?.pause();
    }
    this.activeId = id;

    try {
      await target.play();
    } catch (error) {
      if (this.activeId === id) this.activeId = "";
      throw error;
    }
  }

  notifyEnded(id: string) {
    if (this.activeId === id) this.activeId = "";
  }

  stopAll() {
    if (this.activeId) this.targets.get(this.activeId)?.pause();
    this.activeId = "";
  }

  getActiveId() {
    return this.activeId;
  }
}

const AudioPlaybackContext = createContext<AudioPlaybackCoordinator | null>(null);

export function AudioPlaybackCoordinatorProvider({ children }: { children: ReactNode }) {
  const coordinator = useMemo(() => new AudioPlaybackCoordinator(), []);

  useEffect(() => () => coordinator.stopAll(), [coordinator]);

  return (
    <AudioPlaybackContext.Provider value={coordinator}>
      {children}
    </AudioPlaybackContext.Provider>
  );
}

export function useAudioPlaybackCoordinator() {
  const coordinator = useContext(AudioPlaybackContext);
  if (!coordinator) {
    throw new Error("AudioPlaybackCoordinatorProvider is required");
  }
  return coordinator;
}
