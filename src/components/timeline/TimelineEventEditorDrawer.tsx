import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  deleteTimelineEvent,
  fetchTimelineEvent,
  patchTimelineEvent,
} from "../../data/api";
import { PaperTexture } from "../common/PaperTexture";

const TIMELINE_EDIT_OFFSET = "+08:00";
const TIME_WHEEL_GESTURE_STEP = 18;

function trimString(value) {
  return String(value ?? "").trim();
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getTimelineTaxonomy(remoteData) {
  const sources = [remoteData?.timelineState, remoteData?.searchCache?.timeline];

  for (const source of sources) {
    if (isRecord(source?.taxonomy)) {
      return source.taxonomy;
    }
  }

  return null;
}

function buildTaxonomyOptions(remoteData) {
  const taxonomy = getTimelineTaxonomy(remoteData);
  const categorySource = Array.isArray(taxonomy?.categories)
    ? taxonomy.categories
    : [];
  const eventNodeSource = Array.isArray(taxonomy?.eventNodes)
    ? taxonomy.eventNodes
    : [];

  const categories = categorySource
    .map((category) => ({
      id: trimString(category?.id),
      label: trimString(category?.label || category?.name || category?.title),
      subcategories: Array.isArray(category?.children)
        ? category.children
            .map((subcategory) => ({
              id: trimString(subcategory?.id),
              label: trimString(
                subcategory?.label || subcategory?.name || subcategory?.title,
              ),
            }))
            .filter((subcategory) => subcategory.id)
        : [],
    }))
    .filter((category) => category.id);

  const eventNodes = eventNodeSource
    .map((eventNode) => ({
      id: trimString(eventNode?.id),
      label: trimString(eventNode?.label || eventNode?.name || eventNode?.title),
      parentId: trimString(eventNode?.parentId),
    }))
    .filter((eventNode) => eventNode.id && eventNode.parentId);

  return {
    categories,
    eventNodes,
  };
}

function toTimeValue(dateLike) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  return formatter.format(new Date(dateLike));
}

function toTimelineIso(dateText, timeText) {
  const normalizedDate = String(dateText ?? "").replace(/\./g, "-");
  return new Date(
    `${normalizedDate}T${timeText}:00${TIMELINE_EDIT_OFFSET}`,
  ).toISOString();
}

function eventToFormState(event, dateText) {
  return {
    startTime: toTimeValue(event?.startAt),
    endTime: toTimeValue(event?.endAt),
    title: trimString(event?.title),
    note: trimString(event?.note),
    categoryId: trimString(event?.categoryId),
    subcategoryId: trimString(event?.subcategoryId),
    eventNodeId: trimString(event?.eventNodeId),
    tagsText: Array.isArray(event?.tags) ? event.tags.join(", ") : "",
    confidence:
      typeof event?.confidence === "number" && Number.isFinite(event.confidence)
        ? String(event.confidence)
        : "0.5",
    dateText: String(dateText ?? ""),
  };
}

function parseTags(tagsText) {
  return Array.from(
    new Set(
      String(tagsText ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function buildTimeGroups() {
  return {
    hours: Array.from({ length: 24 }, (_, index) =>
      String(index).padStart(2, "0"),
    ),
    minutes: Array.from({ length: 60 }, (_, index) =>
      String(index).padStart(2, "0"),
    ),
  };
}

function getChoiceLabel(options, value, fallback = "None") {
  return options.find((option) => option.id === value)?.label || fallback;
}

function getLoopedIndex(index, length) {
  return ((index % length) + length) % length;
}

function PickerCardShell({
  page,
  kicker,
  title,
  onClose,
  footer,
  children,
  maxWidthClassName,
  maxHeightClassName,
  ariaLabel,
}) {
  return (
    <motion.div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/10 px-4 py-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ transform: "translateY(var(--app-keyboard-center-offset, 0px))" }}
    >
      <button
        className="absolute inset-0"
        type="button"
        aria-label={ariaLabel}
        onClick={onClose}
      />
      <motion.section
        className={`relative flex min-h-0 w-full flex-col overflow-hidden border px-4 py-4 text-black/72 shadow-[0_10px_26px_rgba(65,56,43,0.08)] ${maxWidthClassName} ${maxHeightClassName}`}
        initial={{ scale: 0.97, opacity: 0, y: 6 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.98, opacity: 0, y: 4 }}
        style={{
          background: page.paper ?? "#f6f0e6",
          borderColor: page.line,
        }}
      >
        <PaperTexture mode={page.texture} />
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div className="mb-3 border-b pb-3" style={{ borderBottomColor: page.line }}>
            <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-black/38">
              {kicker}
            </div>
            <h3
              className="mt-1 font-serif text-[20px] leading-tight"
              style={{ color: page.color }}
            >
              {title}
            </h3>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          {footer ? (
            <div className="mt-3 border-t pt-3" style={{ borderTopColor: page.line }}>
              {footer}
            </div>
          ) : null}
        </div>
      </motion.section>
    </motion.div>
  );
}

function ScrollWheelPickerColumn({
  label,
  options,
  value,
  onChange,
  page,
}) {
  const lastTouchYRef = useRef(null);
  const dragDeltaRef = useRef(0);
  const wheelDeltaRef = useRef(0);
  const selectedIndex = Math.max(0, options.indexOf(value));

  const applyStep = (direction) => {
    const nextValue = options[getLoopedIndex(selectedIndex + direction, options.length)];
    if (nextValue) {
      onChange(nextValue);
    }
  };

  const flushDelta = (delta) => {
    let nextDelta = delta;

    while (nextDelta <= -TIME_WHEEL_GESTURE_STEP) {
      applyStep(1);
      nextDelta += TIME_WHEEL_GESTURE_STEP;
    }

    while (nextDelta >= TIME_WHEEL_GESTURE_STEP) {
      applyStep(-1);
      nextDelta -= TIME_WHEEL_GESTURE_STEP;
    }

    return nextDelta;
  };

  const handleWheel = (event) => {
    event.preventDefault();
    wheelDeltaRef.current = flushDelta(wheelDeltaRef.current + event.deltaY);
  };

  const handleTouchStart = (event) => {
    lastTouchYRef.current = event.touches[0]?.clientY ?? null;
    dragDeltaRef.current = 0;
  };

  const handleTouchMove = (event) => {
    const currentY = event.touches[0]?.clientY;

    if (lastTouchYRef.current == null || currentY == null) return;
    event.preventDefault();
    dragDeltaRef.current = flushDelta(
      dragDeltaRef.current + (currentY - lastTouchYRef.current),
    );
    lastTouchYRef.current = currentY;
  };

  const handleTouchEnd = () => {
    lastTouchYRef.current = null;
    dragDeltaRef.current = 0;
  };

  return (
    <section className="flex w-[92px] flex-col items-center">
      <div className="mb-3 w-full text-center font-mono text-[9px] uppercase tracking-[0.16em] text-black/38">
        {label}
      </div>
      <div
        className="relative h-[56px] w-full select-none"
        style={{ touchAction: "none" }}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <button
          className="absolute inset-x-0 top-0 z-10 h-[18px]"
          type="button"
          aria-label={`上一${label}`}
          onClick={() => applyStep(-1)}
        />
        <button
          className="absolute inset-x-0 bottom-0 z-10 h-[18px]"
          type="button"
          aria-label={`下一${label}`}
          onClick={() => applyStep(1)}
        />
        <div
          className="pointer-events-none absolute inset-0 rounded-sm border shadow-[inset_0_1px_0_rgba(255,255,255,.55)]"
          style={{
            borderColor: `${page.line}cc`,
            background: "rgba(255,255,255,.74)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center font-mono text-[22px] tracking-[0.08em]"
          style={{ color: page.color }}
        >
          {value}
        </div>
      </div>
    </section>
  );
}

function PickerField({
  label,
  value,
  onClick,
  disabled = false,
  borderColor,
}) {
  return (
    <label className="space-y-1.5">
      <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-black/40">
        {label}
      </span>
      <button
        className="flex w-full items-center justify-between border bg-white/55 px-3 py-2 text-left text-[12px] outline-none disabled:opacity-45"
        style={{ borderColor }}
        type="button"
        onClick={onClick}
        disabled={disabled}
      >
        <span className="truncate">{value}</span>
        <span className="pl-3 text-[10px] text-black/38">v</span>
      </button>
    </label>
  );
}

function PaperChoicePickerModal({
  page,
  title,
  options,
  value,
  noneLabel,
  onSelect,
  onClose,
}) {
  return (
    <PickerCardShell
      page={page}
      kicker="picker"
      title={title}
      onClose={onClose}
      ariaLabel="关闭选择面板"
      maxWidthClassName="max-w-[312px]"
      maxHeightClassName="max-h-[360px]"
      footer={
        <div className="flex justify-end">
          <button
            className="border px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-black/52"
            style={{ borderColor: page.line }}
            type="button"
            onClick={onClose}
          >
            close
          </button>
        </div>
      }
    >
      <div className="diary-scroll min-h-0 flex-1 overflow-y-auto">
        {noneLabel ? (
          <button
            className="flex w-full items-center justify-between border-b px-1 py-2.5 text-left text-[12px] text-black/62"
            style={{ borderBottomColor: page.line }}
            type="button"
            onClick={() => {
              onSelect("");
              onClose();
            }}
          >
            <span>{noneLabel}</span>
            <span>{value ? "○" : "◉"}</span>
          </button>
        ) : null}
        {options.map((option) => {
          const active = option.id === value;

          return (
            <button
              key={option.id}
              className="flex w-full items-center justify-between border-b px-1 py-2.5 text-left text-[12px] transition"
              style={{
                borderBottomColor: page.line,
                color: active ? page.color : "rgba(0,0,0,.66)",
                background: active ? `${page.color}0d` : "transparent",
              }}
              type="button"
              onClick={() => {
                onSelect(option.id);
                onClose();
              }}
            >
              <span>{option.label || option.id}</span>
              <span>{active ? "◉" : "○"}</span>
            </button>
          );
        })}
      </div>
    </PickerCardShell>
  );
}

function PaperTimePickerModal({
  page,
  title,
  value,
  onSelect,
  onClose,
}) {
  const groups = useMemo(() => buildTimeGroups(), []);
  const [hourText, minuteText] = String(value || "00:00").split(":");
  const [selectedHour, setSelectedHour] = useState(hourText || "00");
  const [selectedMinute, setSelectedMinute] = useState(minuteText || "00");

  useEffect(() => {
    const [nextHourText, nextMinuteText] = String(value || "00:00").split(":");
    setSelectedHour(nextHourText || "00");
    setSelectedMinute(nextMinuteText || "00");
  }, [value]);

  return (
    <PickerCardShell
      page={page}
      kicker="timeline event"
      title={title}
      onClose={onClose}
      ariaLabel="关闭时间选择面板"
      maxWidthClassName="max-w-[364px]"
      maxHeightClassName="h-[236px] max-h-[236px]"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            className="border px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-black/52"
            style={{ borderColor: page.line }}
            type="button"
            onClick={onClose}
          >
            cancel
          </button>
          <button
            className="border px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.16em]"
            style={{ borderColor: page.color, color: page.color }}
            type="button"
            onClick={() => {
              onSelect(`${selectedHour}:${selectedMinute}`);
              onClose();
            }}
          >
            apply
          </button>
        </div>
      }
    >
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="flex items-end justify-center gap-4">
          <ScrollWheelPickerColumn
            label="hour"
            options={groups.hours}
            value={selectedHour}
            onChange={setSelectedHour}
            page={page}
          />
          <div
            className="pb-[10px] font-mono text-[26px] leading-none"
            style={{ color: `${page.color}80` }}
          >
            :
          </div>
          <ScrollWheelPickerColumn
            label="minute"
            options={groups.minutes}
            value={selectedMinute}
            onChange={setSelectedMinute}
            page={page}
          />
        </div>
      </div>
    </PickerCardShell>
  );
}

export function TimelineEventEditorDrawer({
  page,
  event,
  onClose,
  onEventSaved,
  onEventDeleted,
}) {
  const [formState, setFormState] = useState(() =>
    eventToFormState(event, page.date),
  );
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [choicePickerState, setChoicePickerState] = useState(null);
  const [timePickerField, setTimePickerField] = useState("");
  const taxonomyOptions = useMemo(
    () => buildTaxonomyOptions(page.remoteData),
    [page.remoteData],
  );
  const selectedCategory = taxonomyOptions.categories.find(
    (category) => category.id === formState.categoryId,
  );
  const subcategoryOptions = selectedCategory?.subcategories ?? [];
  const eventNodeOptions = taxonomyOptions.eventNodes.filter(
    (eventNode) => eventNode.parentId === formState.subcategoryId,
  );

  useEffect(() => {
    setFormState(eventToFormState(event, page.date));
    setError("");
  }, [event, page.date]);

  useEffect(() => {
    let cancelled = false;

    const refreshEvent = async () => {
      try {
        setIsRefreshing(true);
        const result = await fetchTimelineEvent(page.date, event.id);

        if (!cancelled && result?.found && result.event) {
          setFormState(eventToFormState(result.event, page.date));
        }
      } catch {
        // Keep the optimistic local event snapshot if the refresh fails.
      } finally {
        if (!cancelled) {
          setIsRefreshing(false);
        }
      }
    };

    refreshEvent();

    return () => {
      cancelled = true;
    };
  }, [event.id, page.date]);

  useEffect(() => {
    if (
      formState.categoryId &&
      !subcategoryOptions.some(
        (subcategory) => subcategory.id === formState.subcategoryId,
      )
    ) {
      setFormState((current) => ({
        ...current,
        subcategoryId: subcategoryOptions[0]?.id || "",
        eventNodeId: "",
      }));
      return;
    }

    if (
      formState.eventNodeId &&
      !eventNodeOptions.some(
        (eventNode) => eventNode.id === formState.eventNodeId,
      )
    ) {
      setFormState((current) => ({
        ...current,
        eventNodeId: "",
      }));
    }
  }, [
    formState.categoryId,
    formState.subcategoryId,
    formState.eventNodeId,
    subcategoryOptions,
    eventNodeOptions,
  ]);

  const openChoicePicker = (field, title, options, noneLabel = "") => {
    setChoicePickerState({
      field,
      title,
      options,
      noneLabel,
    });
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError("");
      const result = await patchTimelineEvent({
        date: page.date,
        eventId: event.id,
        changes: {
          startAt: toTimelineIso(page.date, formState.startTime),
          endAt: toTimelineIso(page.date, formState.endTime),
          title: formState.title,
          note: formState.note,
          categoryId: formState.categoryId,
          subcategoryId: formState.subcategoryId,
          eventNodeId: formState.eventNodeId,
          tags: parseTags(formState.tagsText),
          confidence: Number(formState.confidence),
        },
      });

      onEventSaved?.(result?.date || page.date, result?.event);
      onClose();
    } catch (error) {
      setError(String(error?.bodyText || error?.message || error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      setError("");
      const result = await deleteTimelineEvent({
        date: page.date,
        eventId: event.id,
      });

      onEventDeleted?.(result?.date || page.date, event.id);
      onClose();
    } catch (error) {
      setError(String(error?.bodyText || error?.message || error));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <motion.div
        className="fixed inset-0 z-[120] flex items-center justify-center bg-black/18 px-4 py-[calc(20px+env(safe-area-inset-top))]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{ transform: "translateY(var(--app-keyboard-center-offset, 0px))" }}
      >
        <button
          className="absolute inset-0"
          type="button"
          aria-label="关闭时间块编辑面板"
          onClick={onClose}
        />
        <motion.section
          className="relative flex max-h-[calc(var(--app-stable-height,100svh)-40px)] w-full max-w-[392px] min-h-0 flex-col overflow-hidden border bg-[#f6f0e6] p-5 text-black/72"
          initial={{ scale: 0.96, opacity: 0, y: 8 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.97, opacity: 0, y: 6 }}
          style={{ borderColor: page.line }}
        >
          <PaperTexture mode={page.texture} />
          <div className="relative flex min-h-0 flex-1 flex-col">
            <div className="mb-4 flex items-start justify-between gap-3 border-b pb-3">
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-black/38">
                  {isRefreshing ? "timeline event · refreshing" : "timeline event"}
                </div>
                <h3
                  className="mt-1 font-serif text-[22px] leading-tight"
                  style={{ color: page.color }}
                >
                  编辑事件
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
            <div className="diary-scroll min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="space-y-4 pb-4">
                <div className="grid grid-cols-2 gap-3">
                  <PickerField
                    label="start"
                    value={formState.startTime}
                    onClick={() => setTimePickerField("startTime")}
                    borderColor={page.line}
                  />
                  <PickerField
                    label="end"
                    value={formState.endTime}
                    onClick={() => setTimePickerField("endTime")}
                    borderColor={page.line}
                  />
                </div>
                <label className="block space-y-1.5">
                  <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-black/40">
                    title
                  </span>
                  <input
                    className="w-full border bg-white/55 px-3 py-2 text-[12px] outline-none"
                    style={{ borderColor: page.line }}
                    value={formState.title}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-black/40">
                    note
                  </span>
                  <textarea
                    className="min-h-[128px] w-full resize-none border bg-white/55 px-3 py-2 text-[12px] leading-[1.75] outline-none"
                    style={{ borderColor: page.line }}
                    value={formState.note}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        note: event.target.value,
                      }))
                    }
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <PickerField
                    label="category"
                    value={getChoiceLabel(
                      taxonomyOptions.categories,
                      formState.categoryId,
                      "未设置",
                    )}
                    onClick={() =>
                      openChoicePicker(
                        "categoryId",
                        "选择分类",
                        taxonomyOptions.categories,
                      )
                    }
                    borderColor={page.line}
                  />
                  <PickerField
                    label="subcategory"
                    value={getChoiceLabel(
                      subcategoryOptions,
                      formState.subcategoryId,
                      "未设置",
                    )}
                    onClick={() =>
                      openChoicePicker(
                        "subcategoryId",
                        "选择子分类",
                        subcategoryOptions,
                      )
                    }
                    disabled={!subcategoryOptions.length}
                    borderColor={page.line}
                  />
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_104px] gap-3">
                  <PickerField
                    label="event node"
                    value={getChoiceLabel(
                      eventNodeOptions,
                      formState.eventNodeId,
                      "None",
                    )}
                    onClick={() =>
                      openChoicePicker(
                        "eventNodeId",
                        "选择事件节点",
                        eventNodeOptions,
                        "None",
                      )
                    }
                    borderColor={page.line}
                  />
                  <label className="space-y-1.5">
                    <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-black/40">
                      confidence
                    </span>
                    <input
                      className="w-full border bg-white/55 px-3 py-2 text-[12px] outline-none"
                      style={{ borderColor: page.line }}
                      type="number"
                      min="0"
                      max="1"
                      step="0.05"
                      value={formState.confidence}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          confidence: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                <label className="block space-y-1.5">
                  <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-black/40">
                    tags
                  </span>
                  <input
                    className="w-full border bg-white/55 px-3 py-2 text-[12px] outline-none"
                    style={{ borderColor: page.line }}
                    value={formState.tagsText}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        tagsText: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
            </div>
            <div
              className="mt-4 shrink-0 border-t pt-3"
              style={{
                paddingBottom: "calc(12px + env(safe-area-inset-bottom))",
              }}
            >
              {error ? (
                <p className="mb-2 text-[11px] leading-5 text-[#a2594b]">
                  {error}
                </p>
              ) : null}
              <div className="flex items-center justify-between gap-2">
                <button
                  className="border px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-black/45"
                  style={{ borderColor: page.line }}
                  type="button"
                  onClick={handleDelete}
                  disabled={isSaving || isDeleting}
                >
                  {isDeleting ? "deleting..." : "delete"}
                </button>
                <div className="flex items-center gap-2">
                  <button
                    className="border px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-black/52"
                    style={{ borderColor: page.line }}
                    type="button"
                    onClick={onClose}
                    disabled={isSaving || isDeleting}
                  >
                    cancel
                  </button>
                  <button
                    className="border px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.16em]"
                    style={{ borderColor: page.color, color: page.color }}
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving || isDeleting}
                  >
                    {isSaving ? "saving..." : "save"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.section>
      </motion.div>

      {choicePickerState ? (
        <PaperChoicePickerModal
          page={page}
          title={choicePickerState.title}
          options={choicePickerState.options}
          value={formState[choicePickerState.field]}
          noneLabel={choicePickerState.noneLabel}
          onSelect={(nextValue) => {
            setFormState((current) => {
              if (choicePickerState.field === "categoryId") {
                const nextCategory = taxonomyOptions.categories.find(
                  (category) => category.id === nextValue,
                );

                return {
                  ...current,
                  categoryId: nextValue,
                  subcategoryId: nextCategory?.subcategories?.[0]?.id || "",
                  eventNodeId: "",
                };
              }

              if (choicePickerState.field === "subcategoryId") {
                return {
                  ...current,
                  subcategoryId: nextValue,
                  eventNodeId: "",
                };
              }

              return {
                ...current,
                [choicePickerState.field]: nextValue,
              };
            });
          }}
          onClose={() => setChoicePickerState(null)}
        />
      ) : null}

      {timePickerField ? (
        <PaperTimePickerModal
          page={page}
          title={timePickerField === "startTime" ? "选择开始时间" : "选择结束时间"}
          value={formState[timePickerField]}
          onSelect={(nextValue) =>
            setFormState((current) => ({
              ...current,
              [timePickerField]: nextValue,
            }))
          }
          onClose={() => setTimePickerField("")}
        />
      ) : null}
    </>
  );
}
