import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarStrip } from "../calendar/CalendarStrip";
import { PaperTexture } from "../common/PaperTexture";
import { DiaryShareModal } from "./DiaryShareModal";
import { MemoryContent } from "./MemoryContent";
import { PageBottomMark } from "../layout/PageBottomMark";
import { TopModeSwitch } from "../controls/TopModeSwitch";

export function DirectoryPage({
  page,
  highlightResult,
  onOpenDatePicker,
  onMonthSelect,
  onOpenShare,
  onSelectMode,
  selectedMode,
  diaryShareOpen,
  onCloseShare,
  scrollHitIntoView,
}) {
  useEffect(() => {
    if (!highlightResult || highlightResult.mode !== page.mode) return;
    if (page.dateBased && highlightResult.date !== page.date) return;
    scrollHitIntoView(highlightResult.targetId);
  }, [highlightResult, page.mode, page.date, page.dateBased, scrollHitIntoView]);

  return (
    <>
      <motion.section
        key={`${page.id}-${page.mode}-${page.date}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="relative flex h-full min-h-0 flex-col overflow-hidden border bg-[#f7f5ee] p-5"
        style={{ background: page.paper, borderColor: page.line }}
      >
        <PaperTexture mode={page.texture} />
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div className="absolute right-0 top-5 z-[30]">
            <TopModeSwitch
              page={page}
              selectedMode={selectedMode}
              onSelectMode={onSelectMode}
            />
          </div>
          <aside
            id={`hit-${page.mode}-${page.dateBased ? page.date : "static"}-title`}
            className="absolute left-0 top-0 z-10 space-y-4"
          >
            <div>
              <div className="mb-1 text-[10px] tracking-[0.22em] text-black/35">
                {page.mode.toUpperCase()} · {page.mark}
              </div>
              <h2 className="max-w-[200px] font-serif text-2xl leading-[1.15] tracking-[0.08em] text-black/75">
                {page.title}
              </h2>
            </div>
          </aside>
          {(page.mode === "Diary" || page.mode === "Letters") &&
            page.hasEntry &&
            onOpenShare && (
            <button
              className="absolute right-0 top-[80px] z-20 border px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.16em]"
              style={{ borderColor: page.color, color: page.color }}
              type="button"
              onClick={onOpenShare}
            >
              share
            </button>
          )}
          <article className="relative z-10 flex min-h-0 flex-1 flex-col pt-20">
            <div className="shrink-0">
              <CalendarStrip
                page={page}
                onOpenDatePicker={onOpenDatePicker}
                onMonthSelect={onMonthSelect}
              />
            </div>
            {page.hasEntry ? (
              <div className="diary-scroll relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-8 pt-2">
                <MemoryContent page={page} highlightResult={highlightResult} />
                <PageBottomMark page={page} />
              </div>
            ) : (
              <div className="diary-scroll relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-8 pt-3">
                <p className="whitespace-nowrap font-serif text-[11px] leading-none text-black/48">
                  {page.blankText}
                </p>
                <PageBottomMark page={page} />
              </div>
            )}
          </article>
        </div>
      </motion.section>
      <AnimatePresence>
        {diaryShareOpen &&
          (page.mode === "Diary" || page.mode === "Letters") && (
          <DiaryShareModal page={page} onClose={onCloseShare} />
        )}
      </AnimatePresence>
    </>
  );
}
