import { useEffect } from "react";
import { motion } from "framer-motion";
import { CalendarStrip } from "../calendar/CalendarStrip";
import { PaperTexture } from "../common/PaperTexture";
import { TinyIcon } from "../common/TinyIcon";
import { ContinuousStaticMemoryContent } from "../archive/MemoryContent";
import { XiaoyeModeSwitch } from "../controls/XiaoyeModeSwitch";

export function XiaoyePage({
  page,
  highlightResult,
  onOpenDatePicker,
  onMonthSelect,
  onSelectXiaoyeMode,
  selectedXiaoyeMode,
  scrollHitIntoView,
}) {
  useEffect(() => {
    if (!highlightResult || highlightResult.mode !== "Xiaoye") return;
    scrollHitIntoView(highlightResult.targetId);
  }, [highlightResult, page.xiaoyeMode, scrollHitIntoView]);

  return (
    <motion.section
      key={`${page.id}-${page.mode}-${page.xiaoyeMode}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="relative min-h-[980px] border bg-[#f7f5ee] p-5 pb-10"
      style={{ background: page.paper, borderColor: page.line }}
    >
      <PaperTexture mode={page.texture} />
      <div className="relative min-h-[920px]">
        <div className="absolute right-0 top-0 z-20">
          <XiaoyeModeSwitch
            page={page}
            selectedXiaoyeMode={selectedXiaoyeMode}
            onSelectXiaoyeMode={onSelectXiaoyeMode}
          />
        </div>
        <aside
          id="hit-Xiaoye-static-title"
          className="absolute left-0 top-0 z-10 space-y-4"
        >
          <div>
            <div className="mb-1 text-[10px] tracking-[0.22em] text-black/35">
              XIAOYE · {page.mark}
            </div>
            <h2 className="max-w-[270px] font-serif text-2xl leading-[1.15] tracking-[0.08em] text-black/75">
              {page.title}
            </h2>
          </div>
        </aside>
        <article className="relative min-h-[900px] pt-20">
          <CalendarStrip
            page={page}
            onOpenDatePicker={onOpenDatePicker}
            onMonthSelect={onMonthSelect}
          />
          {page.hasEntry ? (
            <div className="relative min-h-[780px] pb-16 pt-2">
              <ContinuousStaticMemoryContent
                page={page}
                highlightResult={highlightResult}
              />
              <div className="absolute bottom-12 right-1 scale-75 opacity-70">
                <TinyIcon color={page.color} />
              </div>
            </div>
          ) : (
            <div className="relative min-h-[780px] pb-16 pt-3">
              <p className="whitespace-nowrap font-serif text-[11px] leading-none text-black/48">
                {page.blankText}
              </p>
              <div className="absolute bottom-12 right-1 scale-75 opacity-70">
                <TinyIcon color={page.color} />
              </div>
            </div>
          )}
        </article>
      </div>
    </motion.section>
  );
}
