import { motion } from "framer-motion";
import { getTimelineCategoryMeta } from "../../lib/timelinePageData";
import {
  getEventDurationMinutes,
  minutesToClock,
  toMinutes,
} from "../../lib/timeline";
import { PaperTexture } from "../common/PaperTexture";
import { useModalDialog } from "../common/useModalDialog";

export function TimelineDetailModal({
  event,
  page,
  onClose,
  onEdit,
  canEdit = true,
  editHint = "",
}) {
  const {
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
  const dialogProps = useModalDialog(onClose);
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center overscroll-contain bg-black/[0.18] px-5 py-[calc(20px+env(safe-area-inset-top))]"
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
        {...dialogProps}
        aria-labelledby="timeline-detail-title"
        className="relative flex max-h-[72dvh] w-full max-w-[342px] min-h-0 flex-col overflow-hidden border bg-[#f6f0e6] p-5 text-black/[0.72]"
        initial={{ scale: 0.96, opacity: 0, y: 8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.97, opacity: 0, y: 6 }}
        style={{ borderColor: page.line }}
      >
        <PaperTexture mode={page.texture} />
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div
            className="mb-3 flex items-start justify-between gap-3 border-b pb-3"
            style={{ borderBottomColor: category.color }}
          >
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-black/[0.38]">
                timeline detail
              </div>
              <h3
                id="timeline-detail-title"
                className="mt-1 font-serif text-[23px] leading-tight"
                style={{ color: category.color }}
              >
                {event.title}
              </h3>
            </div>
            <button
              className="min-h-11 px-2 font-mono text-[10px] uppercase tracking-[0.16em] text-black/45"
              type="button"
              onClick={onClose}
            >
              close
            </button>
          </div>
          <div className="diary-scroll min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 text-[12px] leading-6">
            <div className="font-mono text-[11px] tracking-[0.1em] text-black/[0.46]">
              {minutesToClock(toMinutes(event.startAt))} →{" "}
              {minutesToClock(toMinutes(event.endAt))} · {duration}分钟
            </div>
            {categoryDetailLabel && (
              <div className="font-mono text-[10px] tracking-[0.1em] text-black/[0.42]">
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
          <div className="mt-4 shrink-0 border-t pt-3">
            {!canEdit && editHint ? (
              <p className="mb-2 text-[11px] leading-5 text-black/[0.42]">
                {editHint}
              </p>
            ) : null}
            <div className="flex items-center justify-end gap-2">
              <button
                className="min-h-11 border px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-black/[0.52]"
                style={{ borderColor: page.line }}
                type="button"
                onClick={onClose}
              >
                close
              </button>
              <button
                className="min-h-11 border px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.16em] disabled:opacity-45"
                style={{ borderColor: category.color, color: category.color }}
                type="button"
                onClick={onEdit}
                disabled={!canEdit}
              >
                edit
              </button>
            </div>
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
}
