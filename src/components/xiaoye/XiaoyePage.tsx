import { useEffect } from "react";
import { motion } from "framer-motion";
import { CalendarStrip } from "../calendar/CalendarStrip";
import { PaperTexture } from "../common/PaperTexture";
import { PageBottomMark } from "../layout/PageBottomMark";
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
      className="relative flex h-full min-h-0 flex-col overflow-hidden border bg-[#f7f5ee] p-5"
      style={{ background: page.paper, borderColor: page.line }}
    >
      <PaperTexture mode={page.texture} />
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="absolute right-0 top-5 z-[30]">
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
        <article className="relative z-10 flex min-h-0 flex-1 flex-col pt-20">
          <div className="shrink-0">
            <CalendarStrip
              page={page}
              onOpenDatePicker={onOpenDatePicker}
              onMonthSelect={onMonthSelect}
            />
          </div>
          {page.hasEntry ? (
            <div className="diary-scroll relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-4 pt-1">
              <div className="flex min-h-full flex-col">
                <ContinuousStaticMemoryContent page={page} highlightResult={highlightResult} />
                <PageBottomMark page={page} />
              </div>
            </div>
          ) : (
            <div className="diary-scroll relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-4 pt-1">
              <div className="flex min-h-full flex-col">
                <p className="text-[11px] leading-7 tracking-[0.08em] text-[#8f877b]">
                  {page.blankText}
                </p>

                <PageBottomMark page={page} />
              </div>
            </div>
          )}
        </article>
      </div>
    </motion.section>
  );
}
