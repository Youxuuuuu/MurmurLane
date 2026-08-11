import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { readVoiceMessageView } from "../src/lib/voiceMessage";
import { getConversationMediaItems, getConversationVisualKind } from "../src/lib/conversation";

const sharedFixture = JSON.parse(fs.readFileSync(path.resolve(
  import.meta.dirname,
  "../../murmurlane-stack/tracker/webchat-voice-message/fixtures/conversation-voice-message.json",
), "utf8"));

test("shared sanitized producer fixtures remain safe for new and legacy MurmurLane consumers", () => {
  const delivered = readVoiceMessageView(sharedFixture.cases.delivered.meta.voiceMessage);
  const review = readVoiceMessageView(sharedFixture.cases.needsReview.meta.voiceMessage);
  const failed = readVoiceMessageView(sharedFixture.cases.transcriptionFailed.meta.voiceMessage);
  const unknown = readVoiceMessageView(sharedFixture.cases.unknownFutureState);

  assert.equal(delivered?.state, "delivered");
  assert.equal(delivered?.transcript, "今天很开心。");
  assert.equal(review?.state, "needs-transcript-review");
  assert.equal(review?.transcriptStatus, "needs-review");
  assert.equal(failed?.state, "transcription-failed");
  assert.equal(unknown?.supported, false);
  assert.equal(unknown?.transcript, "仍应显示的文字");
  assert.equal(sharedFixture.cases.legacyVoiceAttachment.meta.voiceMessage, undefined);
});

test("v1 Voice Message exposes transcript and backend processing fact without inventing waveform data", () => {
  const view = readVoiceMessageView({
    schemaVersion: 1,
    origin: "user",
    asset: { durationMs: 8_250 },
    processing: { state: "transcribing", reason: null, updatedAt: "2026-08-09T00:00:00.000Z" },
    transcript: { status: "pending", originalText: "", normalizedText: "", correctedByUser: false },
    affect: { status: "pending" },
  });

  assert.equal(view?.supported, true);
  assert.equal(view?.statusLabel, "转写中");
  assert.equal(view?.busy, true);
  assert.equal(view?.durationSeconds, 8.25);
  assert.equal("peaks" in (view || {}), false);
});

test("unknown Voice Message state is visible as unsupported and never treated as delivered", () => {
  const view = readVoiceMessageView({
    schemaVersion: 1,
    origin: "user",
    processing: { state: "future-state", updatedAt: "2026-08-09T00:00:00.000Z" },
    transcript: { status: "ready", originalText: "你好", normalizedText: "你好" },
  });

  assert.equal(view?.supported, false);
  assert.equal(view?.statusLabel, "语音状态暂不支持");
  assert.equal(view?.transcript, "你好");
});

test("processing and failed voice messages remain voice bubbles without a playable asset", () => {
  const record = {
    id: "assistant-voice-failed",
    type: "assistant" as const,
    text: "这句文字仍可展开",
    meta: {
      voiceMessage: {
        schemaVersion: 1,
        origin: "assistant",
        processing: { state: "synthesis-failed", reason: "provider-timeout", updatedAt: "2026-08-09T00:00:00.000Z" },
        transcript: { status: "ready", originalText: "这句文字仍可展开", normalizedText: "这句文字仍可展开", correctedByUser: false },
        synthesis: {
          provider: "minimax",
          model: "speech-2.8-hd",
          generationId: "generation-failed",
          sourceTextHash: "sha256:failed",
          voiceProfileVersion: "voice-profile-v1",
          speechDeliveryPlanVersion: "speech-delivery-plan-v1",
        },
      },
    },
  };
  assert.equal(getConversationVisualKind(record), "voice");
  const [voice] = getConversationMediaItems(record);
  assert.equal(voice?.kind, "voice");
  assert.equal(voice?.path, "");
});

test("voice asset paths reject traversal before constructing the media URL", () => {
  const record = {
    id: "voice-traversal",
    type: "assistant" as const,
    text: "不可播放",
    meta: {
      voiceMessage: {
        schemaVersion: 1,
        origin: "assistant",
        asset: { relativePath: "threads/../secrets/a.mp3", mimeType: "audio/mpeg", durationMs: 1000 },
        processing: { state: "delivered", updatedAt: "2026-08-09T00:00:00.000Z" },
        transcript: { status: "ready", originalText: "不可播放", normalizedText: "不可播放", correctedByUser: false },
        synthesis: {
          provider: "minimax",
          model: "speech-2.8-hd",
          generationId: "generation-safe",
          sourceTextHash: "sha256:safe",
          voiceProfileVersion: "voice-profile-v1",
          speechDeliveryPlanVersion: "speech-delivery-plan-v1",
        },
      },
    },
  };
  const [voice] = getConversationMediaItems(record);
  assert.equal(voice?.kind, "voice");
  assert.equal(voice?.path, "");
});
