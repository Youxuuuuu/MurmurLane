import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PaperTexture } from "../common/PaperTexture";
import {
  formatDiaryDate,
  getDateParts,
  getDaysInMonth,
  getFirstWeekday,
  pad2,
  shiftMonth,
} from "../../lib/date";
import { hasConversationForDate } from "../../lib/conversationPageData";
import { hasCalendarMarkForPage } from "../../lib/memoryPageData";
import {
  getTimelineDay,
  hasRemoteDateIndexMark,
} from "../../lib/timelinePageData";

export function DatePickerModal({
  page,
  onClose,
  onSelectDate,
  variant = "archive",
  markedDates = null,
}) {
  const isConversation = variant === "conversation";
  const parts = getDateParts(page.date);
  const [view, setView] = useState(() => ({
    year: Number(parts.year),
    month: Number(parts.month),
  }));
  const [isYearPickerOpen, setIsYearPickerOpen] = useState(false);
  const yearPickerRef = useRef(null);
  const activeYearRef = useRef(null);
  const days = getDaysInMonth(view.year, view.month);
  const blanks = Array.from(
    { length: getFirstWeekday(view.year, view.month) },
    (_, index) => `blank-${index}`,
  );
  const yearOptions = useMemo(
    () => Array.from({ length: 41 }, (_, index) => view.year - 20 + index),
    [view.year],
  );

  useLayoutEffect(() => {
    if (!isYearPickerOpen) return;

    const yearPicker = yearPickerRef.current;
    const activeYear = activeYearRef.current;

    if (!yearPicker || !activeYear) return;

    yearPicker.scrollTop =
      activeYear.offsetTop -
      yearPicker.clientHeight / 2 +
      activeYear.clientHeight / 2;
  }, [isYearPickerOpen, view.year]);

  const moveMonth = (offset) => {
    setView((current) => shiftMonth(current.year, current.month, offset));
  };
  const handleClose = () => {
    setIsYearPickerOpen(false);
    onClose();
  };

  return (
    <motion.div
      className={`absolute inset-0 z-50 flex items-end bg-black/[0.18] ${isConversation ? "px-0 pb-0" : "px-4 pb-[calc(18px+env(safe-area-inset-bottom))]"}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <button
        className="absolute inset-0"
        type="button"
        aria-label="关闭日期选择"
        onClick={handleClose}
      />
      <motion.section
        className={`relative w-full p-5 text-black/70 ${isConversation ? "rounded-t-[24px] border-0 bg-white pb-[calc(24px+env(safe-area-inset-bottom))] font-sans shadow-[0_-12px_35px_rgba(0,0,0,.08)]" : "border bg-[#f3efe6]"}`}
        initial={{ y: 28, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        style={{ borderColor: page.line }}
      >
        {!isConversation && <PaperTexture mode={page.texture} />}
        <div
          className="relative mb-4 flex items-start justify-between border-b pb-3"
          style={{ borderBottomColor: page.color }}
        >
          <div className="relative">
            <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-black/[0.38]">
              {isConversation ? "jump to date" : "select date"}
            </div>
            <div
              className="mt-1 flex items-center gap-1 font-serif text-[28px] leading-none tracking-[0.08em]"
              style={{ color: page.color }}
            >
              <button
                className="p-0 font-serif text-[28px] leading-none tracking-[0.08em]"
                style={{
                  background: "transparent",
                  border: "none",
                  color: page.color,
                }}
                type="button"
                onClick={() => setIsYearPickerOpen((current) => !current)}
              >
                {view.year}
              </button>
              <span>.{pad2(view.month)}</span>
            </div>
            <AnimatePresence>
              {isYearPickerOpen && (
                <motion.div
                  ref={yearPickerRef}
                  className="year-picker-scroll absolute left-1/2 top-[52px] z-20 max-h-[168px] w-[124px] -translate-x-1/2 overflow-y-auto border p-2 shadow-[0_10px_24px_rgba(120,90,70,.12)]"
                  style={{
                    borderColor: `${page.color}38`,
                    background: "rgba(255,252,246,.96)",
                    borderRadius: 14,
                    scrollBehavior: "auto",
                  }}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                >
                  {yearOptions.map((year) => {
                    const active = year === view.year;

                    return (
                      <button
                        key={year}
                        ref={active ? activeYearRef : null}
                        className="flex min-h-8 w-full items-center justify-between px-2 text-[12px] leading-none"
                        style={{
                          color: active ? page.color : "#76685f",
                          background: active
                            ? `${page.color}18`
                            : "transparent",
                          borderRadius: 10,
                        }}
                        type="button"
                        onClick={() => {
                          setView((current) => ({
                            ...current,
                            year,
                          }));
                          setIsYearPickerOpen(false);
                        }}
                      >
                        <span>{year}</span>
                        <span>{active ? "✓" : ""}</span>
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button
            className="font-mono text-[11px] uppercase tracking-[0.18em] text-black/45"
            type="button"
            onClick={handleClose}
          >
            close
          </button>
        </div>
        <div className="relative mb-4 flex items-center justify-between font-mono text-[11px] tracking-[0.16em] text-black/50">
          <button
            className="px-1 py-2"
            type="button"
            onClick={() => moveMonth(-1)}
          >
            ← prev
          </button>
          <div>{pad2(view.month)} / 12</div>
          <button
            className="px-1 py-2"
            type="button"
            onClick={() => moveMonth(1)}
          >
            next →
          </button>
        </div>
        <div className="relative grid grid-cols-7 gap-y-3 pb-2 text-center font-mono">
          {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((label) => (
            <div key={label} className="text-[8px] text-black/[0.32]">
              {label}
            </div>
          ))}
          {blanks.map((item) => (
            <div key={item} className="h-9" />
          ))}
          {Array.from({ length: days }, (_, index) => index + 1).map((day) => {
            const dateText = formatDiaryDate(view.year, view.month, day);
            const normalizedDate = dateText.replace(/-/g, ".");
            const selected = normalizedDate === String(page.date).replace(/-/g, ".");
            const marked = Array.isArray(markedDates)
              ? markedDates.some(
                  (item) => String(item).replace(/-/g, ".") === normalizedDate,
                )
              : hasCalendarMarkForPage(page, dateText, undefined, {
                  hasConversationForDate,
                  hasRemoteDateIndexMark,
                  getTimelineDay,
                });
            return (
              <button
                key={dateText}
                className="relative mx-auto flex h-9 w-9 items-center justify-center text-[12px]"
                style={{
                  color: selected
                    ? "#fff"
                    : marked
                      ? page.color
                      : "rgba(0,0,0,.48)",
                  background: selected ? page.color : "transparent",
                  border: "1px solid transparent",
                  opacity: isConversation && !marked ? 0.24 : 1,
                }}
                type="button"
                disabled={isConversation && !marked}
                onClick={() => {
                  onSelectDate(dateText);
                  onClose();
                }}
              >
                {pad2(day)}
                {marked && !selected && (
                  <span
                    className="absolute bottom-0 h-1 w-1 rounded-full"
                    style={{ background: page.color }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </motion.section>
    </motion.div>
  );
}
