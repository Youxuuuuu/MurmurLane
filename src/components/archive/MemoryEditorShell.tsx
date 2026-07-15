import { CalendarStrip } from "../calendar/CalendarStrip";

export function MemoryEditorShell({
  page,
  draftContent,
  isPreview,
  isSaving,
  error,
  onDraftContentChange,
  onOpenDatePicker,
  onMonthSelect,
  onSave,
  onCancel,
  previewContent,
}) {
  return (
    <article className="relative z-10 flex h-full min-h-0 flex-1 flex-col pt-20">
      <div className="shrink-0">
        <CalendarStrip
          page={page}
          onOpenDatePicker={onOpenDatePicker}
          onMonthSelect={onMonthSelect}
        />
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col pt-2">
        <div
          className="diary-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
          style={{
            paddingBottom: "calc(16px + var(--app-keyboard-inset, 0px))",
          }}
        >
          {isPreview ? (
            <div className="min-h-full pb-4">{previewContent}</div>
          ) : (
            <textarea
              className="block min-h-[440px] w-full resize-none border bg-white/55 px-4 py-4 font-mono text-[12px] leading-[1.8] text-black/[0.72] outline-none"
              style={{ borderColor: page.line }}
              value={draftContent}
              onChange={(event) => onDraftContentChange(event.target.value)}
              spellCheck={false}
            />
          )}
        </div>
        <div
          className="shrink-0 border-t bg-[#f7f5ee]/95 px-0 pt-3 backdrop-blur-[2px]"
          style={{
            paddingBottom: "calc(12px + env(safe-area-inset-bottom))",
          }}
        >
          {error ? (
            <p className="mb-2 text-[11px] leading-5 text-[#a2594b]">
              {error}
            </p>
          ) : null}
          <div className="flex items-center justify-end gap-2">
            <button
              className="border px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-black/[0.52]"
              style={{ borderColor: page.line }}
              type="button"
              onClick={onCancel}
              disabled={isSaving}
            >
              cancel
            </button>
            <button
              className="border px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.16em]"
              style={{ borderColor: page.color, color: page.color }}
              type="button"
              onClick={onSave}
              disabled={isSaving}
            >
              {isSaving ? "saving..." : "save"}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
