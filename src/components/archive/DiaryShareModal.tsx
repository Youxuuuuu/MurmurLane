import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { toPng } from "html-to-image";
import { toHyphenDate } from "../../lib/date";
import { PaperTexture } from "../common/PaperTexture";

export function normalizeSelectedShareText(text) {
  return String(text ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

export function trimShareText(text, maxLength) {
  const value = normalizeSelectedShareText(text);

  if (value.length <= maxLength) return value;

  return `${value.slice(0, maxLength).trim()}...`;
}

export function getDiaryShareExcerpt(page, selectedText = "") {
  const selectedValue = normalizeSelectedShareText(selectedText);

  if (selectedValue) {
    return trimShareText(selectedValue, 170);
  }

  const lineBreak = String.fromCharCode(10);
  const dividerBreak = `${lineBreak}---${lineBreak}`;
  const text = page.sections
    .map((item) => item.text)
    .filter(Boolean)
    .join(lineBreak);
  const firstBlock = text.split(dividerBreak)[0]?.trim() || page.excerpt || "";

  return firstBlock.length > 170
    ? `${firstBlock.slice(0, 170).trim()}...`
    : firstBlock;
}

export function getDiaryShareLongText(page, selectedText = "") {
  const selectedValue = normalizeSelectedShareText(selectedText);

  if (selectedValue) {
    return selectedValue;
  }

  const lineBreak = String.fromCharCode(10);
    return page.sections
      .map((item) => item.text)
      .filter(Boolean)
      .join(lineBreak)
      .trim();
}

export function DiaryShareText({ text, className }) {
  const lineBreak = String.fromCharCode(10);
  const paragraphs = String(text ?? "")
    .split(lineBreak)
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <div className={className}>
      {paragraphs.map((paragraph, index) => (
        <p key={`${index}-${paragraph.slice(0, 8)}`} className="mb-2 last:mb-0">
          {paragraph}
        </p>
      ))}
    </div>
  );
}

export const shareTemplateBackgrounds = {
  tag: "#fbf6ea",
  rain: "#edf3f1",
  paper: "#f4eee4",
};

export function getShareExportFileName(page, template) {
  const mode = page.mode === "Letters" ? "letters" : "diary";
  const dateText = toHyphenDate(page.date);
  return `murmur-lane-${mode}-${dateText}-${template}.png`;
}

export function getShareButtonLabel(saveStatus) {
  if (saveStatus === "saving") return "saving...";
  if (saveStatus === "saved") return "saved";
  if (saveStatus === "error") return "retry";
  return "save image";
}

export function downloadShareImage(dataUrl, fileName) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export async function createShareImageFile(dataUrl, fileName) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], fileName, { type: "image/png" });
}

export function DiaryShareModal({ page, onClose, selectedText = "" }) {
  const shareCardRef = useRef(null);
  const [shareTemplate, setShareTemplate] = useState("tag");
  const [saveStatus, setSaveStatus] = useState("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const selectedShareText = normalizeSelectedShareText(selectedText);
  const excerpt = getDiaryShareExcerpt(page, selectedShareText);
  const longText = getDiaryShareLongText(page, selectedShareText);
  const shareModeLabel = page.mode === "Letters" ? "letter" : "diary";
  const shareBackgroundColor =
    shareTemplateBackgrounds[shareTemplate] ?? shareTemplateBackgrounds.tag;

  const handleSaveImage = async () => {
    if (!shareCardRef.current) return;
    setSaveStatus("saving");
    setSaveMessage("");

    try {
      const pixelRatio =
        window.devicePixelRatio >= 3
          ? 3
          : window.devicePixelRatio >= 2
            ? 2
            : 2;
      const dataUrl = await toPng(shareCardRef.current, {
        pixelRatio,
        cacheBust: true,
        backgroundColor: shareBackgroundColor,
      });
      const fileName = getShareExportFileName(page, shareTemplate);

      if (navigator.share && navigator.canShare) {
        const file = await createShareImageFile(dataUrl, fileName);
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: page.title,
          });
          setSaveStatus("saved");
          return;
        }
      }

      downloadShareImage(dataUrl, fileName);
      setSaveStatus("saved");
    } catch (error) {
      if (error?.name === "AbortError") {
        setSaveStatus("idle");
        return;
      }
      console.error("Failed to export share image", error);
      setSaveStatus("error");
      setSaveMessage("保存失败，请稍后再试");
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/24 px-5 py-[calc(20px+env(safe-area-inset-top))]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <button
        className="absolute inset-0"
        type="button"
        aria-label="关闭分享预览"
        onClick={onClose}
      />
      <motion.section
        className="share-scroll relative max-h-[82dvh] w-full max-w-[342px] overflow-y-auto border bg-[#f3eee4] p-4 shadow-[0_24px_80px_rgba(64,44,26,.22)]"
        initial={{ y: 14, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 10, opacity: 0, scale: 0.97 }}
        style={{ borderColor: page.line }}
      >
        <PaperTexture mode="warm" />
        <div className="relative mb-3 flex items-center justify-between">
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-black/38">
            share {shareModeLabel}
          </div>
          <button
            className="font-mono text-[10px] uppercase tracking-[0.16em] text-black/45"
            type="button"
            onClick={onClose}
          >
            close
          </button>
        </div>
        <div className="relative mb-3 grid grid-cols-3 gap-1 font-mono text-[9px] uppercase tracking-[0.12em]">
          {[
            { id: "tag", label: "摘要" },
            { id: "rain", label: "雨滴" },
            { id: "paper", label: "旧纸" },
          ].map((item) => (
            <button
              key={item.id}
              className="px-2 py-2"
              type="button"
              style={{
                color:
                  shareTemplate === item.id ? page.color : "rgba(0,0,0,.42)",
                background:
                  shareTemplate === item.id ? page.pale : "transparent",
              }}
              onClick={() => {
                setShareTemplate(item.id);
                setSaveStatus("idle");
                setSaveMessage("");
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="max-h-[70vh] overflow-y-auto overflow-x-auto px-2 py-2">
          <div ref={shareCardRef} className="mx-auto w-fit">
          {shareTemplate === "tag" ? (
            <div className="relative mx-auto w-[286px] bg-[#fbf6ea] px-7 pb-8 pt-10 text-center shadow-[0_16px_42px_rgba(96,69,38,.10)]">
              <PaperTexture mode="warm" />
              <div className="absolute left-1/2 top-3 h-4 w-4 -translate-x-1/2 rounded-full bg-[#f3eee4] shadow-inner" />
              <div className="absolute left-1/2 top-1 h-px w-24 -translate-x-1/2 rotate-[-8deg] bg-[#9b8064]/45" />
              <div className="absolute left-1/2 top-1 h-px w-24 -translate-x-1/2 rotate-[8deg] bg-[#9b8064]/40" />
              <div className="relative mt-3 font-mono text-[9px] uppercase tracking-[0.18em] text-black/38">
                {page.date} · {shareModeLabel} archive
              </div>
              <h3
                className="relative mt-6 font-serif text-[24px] leading-[1.25] tracking-[0.08em]"
                style={{ color: page.color }}
              >
                {page.title}
              </h3>
              <DiaryShareText
                text={excerpt}
                className="relative mt-4 text-left font-serif text-[12px] leading-[1.72] tracking-[0.02em] text-black/62"
              />
              <div
                className="relative mt-5 font-serif text-[18px] leading-none"
                style={{ color: page.color }}
              >
                ✦
              </div>
              <div className="relative mt-4 font-mono text-[8px] uppercase tracking-[0.18em] text-black/34">
                from memory carrier
              </div>
            </div>
          ) : shareTemplate === "rain" ? (
            <div className="relative mx-auto w-[486px] overflow-hidden bg-[#edf3f1] px-7 pb-9 pt-8 text-left shadow-[0_16px_42px_rgba(71,91,86,.12)]">
              <PaperTexture mode="light" />
              <div className="pointer-events-none absolute inset-0 opacity-35">
                {Array.from({ length: 20 }, (_, index) => (
                  <span
                    key={index}
                    className="absolute font-serif text-[13px] leading-none text-[#7faab0]"
                    style={{
                      left: `${7 + ((index * 17) % 84)}%`,
                      top: `${5 + ((index * 23) % 88)}%`,
                      transform: `rotate(${index % 2 === 0 ? -16 : 14}deg)`,
                    }}
                  >
                    ꧞
                  </span>
                ))}
              </div>
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-black/38">
                    rain {shareModeLabel}
                  </div>
                  <div className="mt-1 font-mono text-[9px] tracking-[0.16em] text-black/34">
                    {page.date}
                  </div>
                </div>
                <div className="font-serif text-[16px] leading-none text-[#7faab0]">
                  ♡
                </div>
              </div>
              <h3 className="relative mt-5 font-serif text-[23px] leading-[1.22] tracking-[0.06em] text-[#5f7773]">
                {page.title}
              </h3>
              <DiaryShareText
                text={longText}
                className="relative mt-4 font-serif text-[11px] leading-[1.62] tracking-[0.02em] text-black/62"
              />
              <div className="relative mt-5 flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.16em] text-black/34">
                <span className="h-px flex-1 bg-[#9bbdb9]/45" />
                <span>rain marks / soft archive</span>
                <span className="h-px flex-1 bg-[#9bbdb9]/45" />
              </div>
            </div>
          ) : (
            <div className="relative w-[620px] min-h-[594px] overflow-visible border border-[#d8cbbb] bg-[#f4eee4] px-10 py-12">
              <PaperTexture mode="warm" />

              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-black/36">
                    {page.date}
                  </div>
                  <div className="mt-1 font-mono text-[8px] uppercase tracking-[0.16em] text-black/28">
                    handwritten archive
                  </div>
                </div>
                <div className="font-serif text-[17px] leading-none text-[#8a745f]">
                  ✎
                </div>
              </div>
              <h3 className="relative mt-5 font-serif text-[23px] leading-[1.22] tracking-[0.04em] text-[#705b49]">
                {page.title}
              </h3>
              <DiaryShareText
                text={longText}
                className="relative mt-4 font-serif text-[11px] leading-6 tracking-[0.02em] text-black/62"
              />
              <div className="relative mt-5 flex items-center justify-between gap-3">
                <span className="font-serif text-[15px] text-[#8a745f]">✧</span>
                <span className="h-px flex-1 bg-[#b9a58d]/45" />
                <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-black/34">
                  memory note
                </span>
              </div>
            </div>
          )}
          </div>
        </div>
        <div className="relative mt-4 grid grid-cols-2 gap-2 font-mono text-[10px] uppercase tracking-[0.12em]">
          <button
            className="border px-3 py-2"
            type="button"
            disabled={saveStatus === "saving"}
            style={{
              borderColor: page.color,
              color: page.color,
              background: page.pale,
            }}
            onClick={handleSaveImage}
          >
            {getShareButtonLabel(saveStatus)}
          </button>
          <button
            className="border px-3 py-2 text-black/45"
            type="button"
            style={{ borderColor: page.line }}
            onClick={onClose}
          >
            cancel
          </button>
        </div>
        {saveMessage && (
          <div className="relative mt-3 text-center font-serif text-[11px] text-black/45">
            {saveMessage}
          </div>
        )}
      </motion.section>
    </motion.div>
  );
}
