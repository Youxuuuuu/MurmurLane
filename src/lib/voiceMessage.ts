const KNOWN_STATES = new Set([
  "uploading",
  "transcribing",
  "analyzing-affect",
  "needs-transcript-review",
  "synthesizing",
  "delivered",
  "transcription-failed",
  "synthesis-failed",
  "failed",
]);

const STATUS_LABELS: Record<string, string> = {
  uploading: "上传中",
  transcribing: "转写中",
  "analyzing-affect": "情绪分析中",
  "needs-transcript-review": "需要确认文字",
  synthesizing: "生成语音中",
  delivered: "",
  "transcription-failed": "转写失败",
  "synthesis-failed": "语音生成失败",
  failed: "处理失败",
};

const BUSY_STATES = new Set(["uploading", "transcribing", "analyzing-affect", "synthesizing"]);

export interface VoiceMessageView {
  supported: boolean;
  state: string;
  statusLabel: string;
  busy: boolean;
  transcript: string;
  transcriptStatus: string;
  correctedByUser: boolean;
  durationSeconds: number;
}

export interface SpeechRenditionView {
  status: "synthesizing" | "ready" | "failed" | "unsupported";
  durationSeconds: number;
  assetPath: string;
  activeGenerationId: string;
}

export function readVoiceMessageView(value: unknown): VoiceMessageView | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const voice = value as Record<string, unknown>;
  const processing = objectValue(voice.processing);
  const transcript = objectValue(voice.transcript);
  const asset = objectValue(voice.asset);
  const rawState = textValue(processing.state);
  const supported = voice.schemaVersion === 1 && KNOWN_STATES.has(rawState);
  const state = supported ? rawState : "unsupported";
  const normalizedText = textValue(transcript.normalizedText);
  const originalText = textValue(transcript.originalText);
  const durationMs = Number(asset.durationMs);
  return {
    supported,
    state,
    statusLabel: supported ? STATUS_LABELS[state] || "" : "语音状态暂不支持",
    busy: supported && BUSY_STATES.has(state),
    transcript: normalizedText || originalText,
    transcriptStatus: textValue(transcript.status),
    correctedByUser: transcript.correctedByUser === true,
    durationSeconds: Number.isFinite(durationMs) && durationMs > 0 ? durationMs / 1_000 : 0,
  };
}

export function readSpeechRenditionView(value: unknown): SpeechRenditionView | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const rendition = value as Record<string, unknown>;
  const status = textValue(rendition.status);
  if (!new Set(["synthesizing", "ready", "failed"]).has(status)) {
    return { status: "unsupported", durationSeconds: 0, assetPath: "", activeGenerationId: "" };
  }
  const asset = objectValue(rendition.asset);
  const durationMs = Number(asset.durationMs);
  return {
    status: status as SpeechRenditionView["status"],
    durationSeconds: Number.isFinite(durationMs) && durationMs > 0 ? durationMs / 1_000 : 0,
    assetPath: textValue(asset.relativePath),
    activeGenerationId: textValue(rendition.activeGenerationId),
  };
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
