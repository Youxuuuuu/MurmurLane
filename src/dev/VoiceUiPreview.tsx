import React, { useEffect, useState } from "react";
import { VoiceComposerBar, type VoiceComposerFixtureMode } from "../components/conversation/VoiceComposerBar";
import { useVoiceDraftRecorder, type VoiceDraft } from "../components/conversation/useVoiceDraftRecorder";
import { VoiceMessageBubble, type VoiceBubbleVariant } from "../components/voice/VoiceMessageBubble";
import "./voiceUiPreview.css";

function createToneWavBlob(frequency: number, seconds = 8) {
  const sampleRate = 8_000;
  const sampleCount = sampleRate * seconds;
  const buffer = new ArrayBuffer(44 + sampleCount * 2);
  const view = new DataView(buffer);
  const writeText = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
  };
  writeText(0, "RIFF");
  view.setUint32(4, 36 + sampleCount * 2, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, sampleCount * 2, true);
  for (let index = 0; index < sampleCount; index += 1) {
    const envelope = Math.min(1, index / 400) * Math.min(1, (sampleCount - index) / 400);
    const sample = Math.sin((index / sampleRate) * Math.PI * 2 * frequency) * .13 * envelope;
    view.setInt16(44 + index * 2, sample * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

function useFixtureDraft(frequency: number, durationMs = 8_000) {
  const [draft, setDraft] = useState<VoiceDraft | null>(null);
  useEffect(() => {
    const blob = createToneWavBlob(frequency, durationMs / 1_000);
    const objectUrl = URL.createObjectURL(blob);
    setDraft({
      id: `fixture-${frequency}`,
      blob,
      objectUrl,
      durationMs,
      mimeType: blob.type,
    });
    return () => URL.revokeObjectURL(objectUrl);
  }, [durationMs, frequency]);
  return draft;
}

function RecorderPreview() {
  const recorder = useVoiceDraftRecorder();
  const [text, setText] = useState("");
  const [notice, setNotice] = useState("按住波形入口可直接测试浏览器 MediaRecorder");
  return (
    <div className="voice-preview-recorder">
      <VoiceComposerBar
        mode={recorder.phase}
        text={text}
        onTextChange={setText}
        durationMs={recorder.durationMs}
        warning={recorder.warning}
        draft={recorder.draft}
        onOpenMore={() => setNotice("附件面板保持原入口；Preview 不打开生产附件流。")}
        onOpenEmoji={() => setNotice("表情入口保持原位置。")}
        onSendText={() => setNotice(text.trim() ? "文字发送在 Preview 中被 mock。" : "请输入文字。")}
        onDeleteDraft={recorder.discardDraft}
        onSendDraft={() => {
          setNotice("已触发 mock Voice Draft Command；没有上传或写盘。")
          recorder.discardDraft();
        }}
        onStopRecording={() => recorder.finishRecording(false)}
        onVoicePointerDown={recorder.handlePointerDown}
        onVoicePointerMove={recorder.handlePointerMove}
        onVoicePointerUp={recorder.handlePointerUp}
        onVoicePointerCancel={recorder.handlePointerCancel}
      />
      <p role={recorder.errorText ? "alert" : "status"}>{recorder.errorText || notice}</p>
    </div>
  );
}

const fixtureModes: Array<{ id: VoiceComposerFixtureMode | "too-short" | "warning" | "limit"; label: string }> = [
  { id: "idle", label: "文字输入" },
  { id: "recording", label: "录音中" },
  { id: "cancelling", label: "上滑取消" },
  { id: "too-short", label: "过短" },
  { id: "warning", label: "50 秒提醒" },
  { id: "limit", label: "60 秒结束" },
  { id: "draft", label: "Draft" },
  { id: "uploading", label: "上传中" },
  { id: "disabled", label: "不可用" },
];

export function VoiceUiPreview() {
  const [variant, setVariant] = useState<VoiceBubbleVariant>("cloud");
  const [fixtureMode, setFixtureMode] = useState<(typeof fixtureModes)[number]["id"]>("idle");
  const [fixtureText, setFixtureText] = useState("");
  const [fixtureNotice, setFixtureNotice] = useState("状态由 Preview 控件直接提供，不模拟后端推进。")
  const [messageActionNotice, setMessageActionNotice] = useState("复核、重试与失败状态均由 fixture 接住，不调用生产接口。")
  const firstDraft = useFixtureDraft(262);
  const secondDraft = useFixtureDraft(330);
  const composerDraft = useFixtureDraft(392);

  const controlledMode: VoiceComposerFixtureMode = fixtureMode === "too-short"
    ? "idle"
    : fixtureMode === "warning"
      ? "recording"
    : fixtureMode === "limit"
      ? "draft"
      : fixtureMode;
  const controlledDuration = fixtureMode === "recording" ? 18_400
    : fixtureMode === "cancelling" ? 12_800
      : fixtureMode === "warning" ? 50_000
      : fixtureMode === "limit" ? 60_000
        : composerDraft?.durationMs || 8_000;
  const controlledDraft = controlledMode === "draft" || controlledMode === "uploading" ? composerDraft : null;

  return (
    <main className="voice-ui-preview">
      <header className="voice-ui-preview__header">
        <div><span>DEV · VOICE UI</span><h1>语音交互验收台</h1><p>真实组件、内存音频、零 Provider、零生产上传。</p></div>
        <a href="/" aria-label="返回正式页面">返回应用</a>
      </header>

      <section className="voice-preview-section" aria-labelledby="voice-message-title">
        <div className="voice-preview-section__heading"><div><span>MESSAGE BUBBLE</span><h2 id="voice-message-title">紧凑语音条</h2></div><div className="voice-preview-skins" aria-label="CSS 皮肤切换">{(["cloud", "sage", "cream", "outline", "pebble", "ribbon"] as VoiceBubbleVariant[]).map((skin) => <button type="button" key={skin} aria-pressed={variant === skin} onClick={() => setVariant(skin)}>{skin}</button>)}</div></div>
        <div className="voice-preview-conversation">
          <VoiceMessageBubble id="preview-message-one" audioSrc={firstDraft?.objectUrl || ""} durationHint={8} transcript="我把今天拍到的照片整理好了，颜色比想象中更温柔。" variant={variant} playbackDisabled={!firstDraft} />
          <VoiceMessageBubble id="preview-message-two" audioSrc={secondDraft?.objectUrl || ""} durationHint={8} transcript="好呀，发来看看。播放另一条时，上一条会停在原来的位置。" variant={variant} side="user" playbackDisabled={!secondDraft} />
          <VoiceMessageBubble id="preview-processing" audioSrc="" transcript="这是一条仅由 fixture 提供的处理中展示。" variant={variant} playbackDisabled statusLabel="正在处理" busy />
          <VoiceMessageBubble
            id="preview-review"
            audioSrc={firstDraft?.objectUrl || ""}
            durationHint={8}
            transcript="机器转写待确认"
            variant={variant}
            side="user"
            playbackDisabled={!firstDraft}
            statusLabel="需要确认文字"
            needsTranscriptReview
            onConfirmTranscript={(text) => setMessageActionNotice(`已由 fixture 接住确认：${text}`)}
            onRetryTranscription={() => setMessageActionNotice("已由 fixture 接住重新转写。")}
          />
          <VoiceMessageBubble
            id="preview-failed"
            audioSrc={secondDraft?.objectUrl || ""}
            durationHint={8}
            transcript="原始音频仍可播放，也可以重新转写。"
            variant={variant}
            side="user"
            playbackDisabled={!secondDraft}
            statusLabel="转写失败"
            retryable
            onRetryTranscription={() => setMessageActionNotice("已由 fixture 接住失败重试。")}
          />
        </div>
        <p className="voice-preview-message-notice" role="status">{messageActionNotice}</p>
      </section>

      <section className="voice-preview-section" aria-labelledby="composer-title">
        <div className="voice-preview-section__heading"><div><span>COMPOSER FLOW</span><h2 id="composer-title">状态与真实录音</h2></div></div>
        <div className="voice-preview-mode-switch" aria-label="Composer fixture 状态">{fixtureModes.map((item) => <button type="button" key={item.id} aria-pressed={fixtureMode === item.id} onClick={() => { setFixtureMode(item.id); setFixtureNotice(item.id === "too-short" ? "说话时间太短，请按住至少 0.8 秒。" : item.id === "limit" ? "60 秒已自动结束，只形成 Voice Draft。" : "状态由 Preview 控件直接提供，不模拟后端推进。"); }}>{item.label}</button>)}</div>
        <div className="voice-preview-composer-stage">
          <VoiceComposerBar
            mode={controlledMode}
            text={fixtureText}
            onTextChange={setFixtureText}
            durationMs={controlledDuration}
            warning={fixtureMode === "warning"}
            draft={controlledDraft}
            onOpenMore={() => setFixtureNotice("更多功能入口保持原位置。")}
            onOpenEmoji={() => setFixtureNotice("表情入口保持原位置。")}
            onSendText={() => setFixtureNotice("文字发送已由 fixture 接住。")}
            onDeleteDraft={() => { setFixtureMode("idle"); setFixtureNotice("Draft 已从 Preview 内存中删除。"); }}
            onSendDraft={() => setFixtureNotice("已触发 mock Command；没有上传。")}
            onStopRecording={() => setFixtureMode("draft")}
          />
          <p role={fixtureMode === "too-short" ? "alert" : "status"}>{fixtureNotice}</p>
        </div>
        <div className="voice-preview-real-recorder"><h3>真实浏览器录音</h3><RecorderPreview /></div>
      </section>

      <section className="voice-preview-section voice-preview-future" aria-labelledby="future-title">
        <div className="voice-preview-section__heading"><div><span>RESERVED</span><h2 id="future-title">后续验收接口</h2></div></div>
        <div className="voice-preview-future__grid"><span>CSS 换肤</span><span>波形入口替换</span><span>透明底兰花入口</span><span>Processing State 图标</span><span>Assistant Voice Message</span><span>Speech Rendition</span></div>
      </section>
    </main>
  );
}
