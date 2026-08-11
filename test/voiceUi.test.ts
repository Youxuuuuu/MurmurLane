import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AudioPlaybackCoordinator,
  AudioPlaybackCoordinatorProvider,
  type CoordinatedAudioTarget,
} from "../src/components/voice/AudioPlaybackCoordinator";
import { VoiceMessageBubble } from "../src/components/voice/VoiceMessageBubble";
import {
  VOICE_CANCEL_DISTANCE_PX,
  VOICE_GESTURE_HYSTERESIS_PX,
  VOICE_MAX_DURATION_MS,
  VOICE_MIN_DURATION_MS,
  VOICE_WARNING_MS,
  shouldCancelVoiceGesture,
  voiceRecorderErrorText,
} from "../src/components/conversation/useVoiceDraftRecorder";
import { getConversationMediaDisplayGroups } from "../src/lib/conversationMediaDisplay";
import { resolveComposerEnterAction } from "../src/components/conversation/VoiceComposerBar";

const conversationComposerSource = readFileSync(
  new URL("../src/components/conversation/ConversationComposer.tsx", import.meta.url),
  "utf8",
);
const voiceComposerBarSource = readFileSync(
  new URL("../src/components/conversation/VoiceComposerBar.tsx", import.meta.url),
  "utf8",
);

class FakeAudio implements CoordinatedAudioTarget {
  paused = true;
  currentTime = 0;
  playCount = 0;
  pauseCount = 0;

  async play() {
    this.paused = false;
    this.playCount += 1;
  }

  pause() {
    this.paused = true;
    this.pauseCount += 1;
  }
}

test("Audio Playback Coordinator keeps one active audio without rewinding paused targets", async () => {
  const coordinator = new AudioPlaybackCoordinator();
  const first = new FakeAudio();
  const second = new FakeAudio();
  const draft = new FakeAudio();
  coordinator.register("first", first);
  coordinator.register("second", second);
  coordinator.register("draft", draft);

  await coordinator.play("first");
  first.currentTime = 3.25;
  await coordinator.play("second");
  assert.equal(first.paused, true);
  assert.equal(first.currentTime, 3.25);
  assert.equal(second.paused, false);

  second.paused = true;
  coordinator.notifyEnded("second");
  assert.equal(first.paused, true);
  assert.equal(first.playCount, 1);
  assert.equal(coordinator.getActiveId(), "");

  await coordinator.play("first");
  assert.equal(first.currentTime, 3.25);
  assert.equal(first.playCount, 2);
  assert.equal(second.paused, true);

  await coordinator.play("draft");
  assert.equal(first.paused, true);
  assert.equal(draft.paused, false);
  coordinator.stopAll();
  assert.equal(draft.paused, true);
});

test("voice gesture cancellation uses a reversible 10px hysteresis band", () => {
  assert.equal(VOICE_CANCEL_DISTANCE_PX, 54);
  assert.equal(VOICE_GESTURE_HYSTERESIS_PX, 10);
  assert.equal(shouldCancelVoiceGesture(-53, false), false);
  assert.equal(shouldCancelVoiceGesture(-54, false), true);
  assert.equal(shouldCancelVoiceGesture(-45, true), true);
  assert.equal(shouldCancelVoiceGesture(-43, true), false);
});

test("voice recorder limits and capability messages remain explicit", () => {
  assert.equal(VOICE_MIN_DURATION_MS, 800);
  assert.equal(VOICE_WARNING_MS, 50_000);
  assert.equal(VOICE_MAX_DURATION_MS, 60_000);
  assert.match(voiceRecorderErrorText("insecure-context"), /HTTPS|localhost/);
  assert.match(voiceRecorderErrorText("permission-denied"), /权限/);
  assert.match(voiceRecorderErrorText("device-missing"), /麦克风/);
  assert.match(voiceRecorderErrorText("too-short"), /0\.8 秒/);
});

test("legacy audio media is classified as voice without inventing production fields", () => {
  const groups = getConversationMediaDisplayGroups([
    { kind: "voice", relativePath: "inbox/example.webm" },
    { contentType: "audio/ogg", relativePath: "inbox/example.ogg" },
    { kind: "file", relativePath: "inbox/readme.txt" },
  ]);
  assert.equal(groups.voices.length, 2);
  assert.equal(groups.files.length, 1);
  assert.deepEqual(Object.keys(groups).sort(), ["files", "images", "stickers", "voices"]);
});

test("cloud voice bubble renders one stable audio and two identical decorative wave layers", () => {
  const markup = renderToStaticMarkup(createElement(
    AudioPlaybackCoordinatorProvider,
    null,
    createElement(VoiceMessageBubble, {
      id: "fixture-voice",
      audioSrc: "fixture.wav",
      durationHint: 8,
      transcript: "同一气泡中的文字",
    }),
  ));
  assert.match(markup, /voice-message-bubble--cloud/);
  assert.equal((markup.match(/<audio/g) || []).length, 1);
  assert.equal((markup.match(/voice-waveform__geometry/g) || []).length, 2);
  assert.equal((markup.match(/<i style=/g) || []).length, 24);
  assert.match(markup, /aria-expanded="false"/);
  assert.match(markup, /同一气泡中的文字/);
});

test("processing and failed states reuse the transcript control instead of adding a visible status row", () => {
  const processing = renderToStaticMarkup(createElement(
    AudioPlaybackCoordinatorProvider,
    null,
    createElement(VoiceMessageBubble, {
      id: "processing-voice",
      audioSrc: "",
      transcript: "处理中仍可展开的文字",
      playbackDisabled: true,
      statusLabel: "正在处理",
      busy: true,
    }),
  ));
  const failed = renderToStaticMarkup(createElement(
    AudioPlaybackCoordinatorProvider,
    null,
    createElement(VoiceMessageBubble, {
      id: "failed-voice",
      audioSrc: "",
      transcript: "失败后仍可展开的文字",
      playbackDisabled: true,
      statusLabel: "生成失败",
    }),
  ));
  assert.match(processing, /is-processing/);
  assert.match(processing, /正在处理，展开文字/);
  assert.match(failed, /is-failed/);
  assert.match(failed, /生成失败，展开文字/);
  assert.doesNotMatch(processing, /voice-message-bubble__status is-busy/);
});

test("plain Enter stages the current text instead of sending the logical message", () => {
  assert.equal(resolveComposerEnterAction({ key: "Enter", shiftKey: false, isComposing: false }), "stage");
  assert.equal(resolveComposerEnterAction({ key: "Enter", shiftKey: true, isComposing: false }), "newline");
  assert.equal(resolveComposerEnterAction({ key: "Enter", shiftKey: false, isComposing: true }), "newline");
  assert.equal(resolveComposerEnterAction({ key: "a", shiftKey: false, isComposing: false }), "none");
  assert.match(conversationComposerSource, /onStageText=\{queueCurrent\}/u);
  assert.match(conversationComposerSource, /onSendText=\{sendAll\}/u);
  assert.match(voiceComposerBarSource, /onStageText\(\)/u);
});
