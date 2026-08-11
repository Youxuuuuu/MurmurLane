import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

export const VOICE_MIN_DURATION_MS = 800;
export const VOICE_WARNING_MS = 50_000;
export const VOICE_MAX_DURATION_MS = 60_000;
export const VOICE_CANCEL_DISTANCE_PX = 54;
export const VOICE_GESTURE_HYSTERESIS_PX = 10;

export type VoiceRecorderPhase = "idle" | "requesting" | "recording" | "cancelling" | "draft";

export interface VoiceDraft {
  id: string;
  blob: Blob;
  objectUrl: string;
  durationMs: number;
  mimeType: string;
}

export type VoiceRecorderErrorCode =
  | "insecure-context"
  | "permission-denied"
  | "device-missing"
  | "unsupported"
  | "too-short"
  | "unknown";

function createDraftId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `voice-draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function classifyVoiceRecorderError(error: unknown): VoiceRecorderErrorCode {
  if (typeof window !== "undefined" && !window.isSecureContext) return "insecure-context";
  const name = String((error as { name?: string } | null)?.name || "");
  if (name === "NotAllowedError" || name === "SecurityError") return "permission-denied";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "device-missing";
  if (name === "NotSupportedError") return "unsupported";
  return "unknown";
}

export function voiceRecorderErrorText(code: VoiceRecorderErrorCode) {
  const messages: Record<VoiceRecorderErrorCode, string> = {
    "insecure-context": "录音需要 HTTPS 或 localhost 安全环境。",
    "permission-denied": "麦克风权限被拒绝，请在浏览器设置中允许。",
    "device-missing": "没有找到可用的麦克风设备。",
    unsupported: "当前浏览器不支持录音。",
    "too-short": "说话时间太短，请按住至少 0.8 秒。",
    unknown: "无法开始录音，请稍后重试。",
  };
  return messages[code];
}

export function shouldCancelVoiceGesture(currentOffsetY: number, cancelling: boolean) {
  return cancelling
    ? currentOffsetY <= -(VOICE_CANCEL_DISTANCE_PX - VOICE_GESTURE_HYSTERESIS_PX)
    : currentOffsetY <= -VOICE_CANCEL_DISTANCE_PX;
}

export function useVoiceDraftRecorder({
  onDraftPresenceChange,
}: {
  onDraftPresenceChange?: (hasDraft: boolean) => void;
} = {}) {
  const [phase, setPhase] = useState<VoiceRecorderPhase>("idle");
  const [durationMs, setDurationMs] = useState(0);
  const [warning, setWarning] = useState(false);
  const [draft, setDraft] = useState<VoiceDraft | null>(null);
  const [errorCode, setErrorCode] = useState<VoiceRecorderErrorCode | null>(null);
  const phaseRef = useRef<VoiceRecorderPhase>("idle");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const pointerActiveRef = useRef(false);
  const pointerStartYRef = useRef(0);
  const startedAtRef = useRef(0);
  const finishCancelledRef = useRef(false);
  const intervalRef = useRef<number | null>(null);
  const warningTimerRef = useRef<number | null>(null);
  const maxTimerRef = useRef<number | null>(null);
  const objectUrlRef = useRef("");

  const updatePhase = useCallback((next: VoiceRecorderPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const clearTimers = useCallback(() => {
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    if (warningTimerRef.current !== null) window.clearTimeout(warningTimerRef.current);
    if (maxTimerRef.current !== null) window.clearTimeout(maxTimerRef.current);
    intervalRef.current = null;
    warningTimerRef.current = null;
    maxTimerRef.current = null;
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  const discardDraft = useCallback(() => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = "";
    setDraft(null);
    setDurationMs(0);
    setWarning(false);
    setErrorCode(null);
    updatePhase("idle");
  }, [updatePhase]);

  const finishRecording = useCallback((cancelled = false) => {
    pointerActiveRef.current = false;
    finishCancelledRef.current = cancelled;
    clearTimers();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
      return;
    }
    stopStream();
    updatePhase("idle");
  }, [clearTimers, stopStream, updatePhase]);

  const beginRecording = useCallback(async () => {
    setErrorCode(null);
    setWarning(false);
    setDurationMs(0);
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setErrorCode("insecure-context");
      pointerActiveRef.current = false;
      updatePhase("idle");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setErrorCode("unsupported");
      pointerActiveRef.current = false;
      updatePhase("idle");
      return;
    }

    updatePhase("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!pointerActiveRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        updatePhase("idle");
        return;
      }
      const recorder = new MediaRecorder(stream);
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      startedAtRef.current = performance.now();
      finishCancelledRef.current = false;

      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const elapsed = Math.min(VOICE_MAX_DURATION_MS, Math.max(0, performance.now() - startedAtRef.current));
        clearTimers();
        stopStream();
        setWarning(false);
        if (finishCancelledRef.current) {
          setDurationMs(0);
          updatePhase("idle");
          return;
        }
        if (elapsed < VOICE_MIN_DURATION_MS) {
          setDurationMs(0);
          setErrorCode("too-short");
          updatePhase("idle");
          return;
        }
        const mimeType = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (!blob.size) {
          setErrorCode("unknown");
          setDurationMs(0);
          updatePhase("idle");
          return;
        }
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        const objectUrl = URL.createObjectURL(blob);
        objectUrlRef.current = objectUrl;
        setDurationMs(elapsed);
        setDraft({ id: createDraftId(), blob, objectUrl, durationMs: elapsed, mimeType });
        updatePhase("draft");
      };

      recorder.start(120);
      updatePhase("recording");
      intervalRef.current = window.setInterval(() => {
        setDurationMs(Math.min(VOICE_MAX_DURATION_MS, performance.now() - startedAtRef.current));
      }, 100);
      warningTimerRef.current = window.setTimeout(() => {
        setWarning(true);
        if (navigator.vibrate) navigator.vibrate(18);
      }, VOICE_WARNING_MS);
      maxTimerRef.current = window.setTimeout(() => finishRecording(false), VOICE_MAX_DURATION_MS);
    } catch (error) {
      stopStream();
      pointerActiveRef.current = false;
      setErrorCode(classifyVoiceRecorderError(error));
      updatePhase("idle");
    }
  }, [clearTimers, finishRecording, stopStream, updatePhase]);

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (draft || phaseRef.current !== "idle") return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointerActiveRef.current = true;
    pointerStartYRef.current = event.clientY;
    void beginRecording();
  }, [beginRecording, draft]);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (!pointerActiveRef.current) return;
    const cancelling = phaseRef.current === "cancelling";
    const nextCancelling = shouldCancelVoiceGesture(event.clientY - pointerStartYRef.current, cancelling);
    if (nextCancelling !== cancelling) updatePhase(nextCancelling ? "cancelling" : "recording");
  }, [updatePhase]);

  const releasePointer = useCallback((event: ReactPointerEvent<HTMLElement>, forcedCancel = false) => {
    if (!pointerActiveRef.current) return;
    event.preventDefault();
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const cancelled = forcedCancel || phaseRef.current === "cancelling";
    pointerActiveRef.current = false;
    if (phaseRef.current === "requesting") return;
    finishRecording(cancelled);
  }, [finishRecording]);

  useEffect(() => {
    onDraftPresenceChange?.(Boolean(draft));
  }, [draft, onDraftPresenceChange]);

  useEffect(() => {
    if (!draft) return undefined;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [draft]);

  useEffect(() => () => {
    clearTimers();
    if (recorderRef.current?.state !== "inactive") recorderRef.current?.stop();
    stopStream();
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, [clearTimers, stopStream]);

  return {
    phase,
    durationMs,
    warning,
    draft,
    errorCode,
    errorText: errorCode ? voiceRecorderErrorText(errorCode) : "",
    discardDraft,
    finishRecording,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp: (event: ReactPointerEvent<HTMLElement>) => releasePointer(event),
    handlePointerCancel: (event: ReactPointerEvent<HTMLElement>) => releasePointer(event, true),
  };
}

