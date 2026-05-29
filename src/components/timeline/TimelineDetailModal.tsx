import { motion } from "framer-motion";
import { getTimelineCategoryMeta } from "../../lib/timelinePageData";
import {
  getEventDurationMinutes,
  minutesToClock,
  toMinutes,
} from "../../lib/timeline";
import { PaperTexture } from "../common/PaperTexture";

export function TimelineDetailModal({ event, page, onClose }) {
  const {
    normalizedEvent,
    category,
    categoryLabel,
    subcategoryLabel,
    eventNodeLabel,
  } = getTimelineCategoryMeta(event, page.remoteData);
  const duration = getEventDurationMinutes(event);
  const categoryDetailLabel = [
    categoryLabel,
    subcategoryLabel,
    eventNodeLabel,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/18 px-5 py-[calc(20px+env(safe-area-inset-top))]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <button
        className="absolute inset-0"
        type="button"
        aria-label="关闭时间块详情"
        onClick={onClose}
      />
      <motion.section
        className="relative max-h-[72dvh] w-full max-w-[342px] overflow-y-auto border bg-[#f6f0e6] p-5 text-black/72"
        initial={{ scale: 0.96, opacity: 0, y: 8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.97, opacity: 0, y: 6 }}
        style={{ borderColor: page.line }}
      >
        <PaperTexture mode={page.texture} />
        <div className="relative">
          <div
            className="mb-3 flex items-start justify-between gap-3 border-b pb-3"
            style={{ borderBottomColor: category.color }}
          >
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-black/38">
                timeline detail
              </div>
              <h3
                className="mt-1 font-serif text-[23px] leading-tight"
                style={{ color: category.color }}
              >
                {event.title}
              </h3>
            </div>
            <button
              className="font-mono text-[10px] uppercase tracking-[0.16em] text-black/45"
              type="button"
              onClick={onClose}
            >
              close
            </button>
          </div>
          <div className="space-y-3 text-[12px] leading-6">
            <div className="font-mono text-[11px] tracking-[0.1em] text-black/46">
              {minutesToClock(toMinutes(event.startAt))} →{" "}
              {minutesToClock(toMinutes(event.endAt))} · {duration}分钟
            </div>
            {categoryDetailLabel && (
              <div className="font-mono text-[10px] tracking-[0.1em] text-black/42">
                {categoryDetailLabel}
              </div>
            )}
            <p>{event.note}</p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {(event.tags ?? []).map((tag) => (
                <span
                  key={tag}
                  className="border px-2 py-1 font-mono text-[9px] text-black/45"
                  style={{ borderColor: page.line }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
}
