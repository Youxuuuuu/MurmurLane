import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarStrip } from "../calendar/CalendarStrip";
import { MemoryContent } from "./MemoryContent";
import { MemoryEditorShell } from "./MemoryEditorShell";
import { PageBottomMark } from "../layout/PageBottomMark";
import { CardScrollArea } from "../layout/CardScrollArea";
import { PageCard } from "../layout/PageCard";
import { TopModeSwitch } from "../controls/TopModeSwitch";
import {
  fetchEditableMemoryDocument,
  saveEditableMemoryDocument,
} from "../../data/api";
import {
  buildEditableMemoryTemplate,
  getEditableMemoryDocumentForPage,
  parseEditableMemoryContent,
} from "../../lib/editableMemory";

export function DirectoryPage({
  page,
  highlightResult,
  onOpenDatePicker,
  onMonthSelect,
  onOpenShare,
  onSelectMode,
  selectedMode,
  onSelectedShareTextChange,
  scrollHitIntoView,
  onMemoryEntrySaved,
  onToggleOpenLoop,
  canEdit,
  editHint,
}) {
  const pageRef = useRef(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const [draftContent, setDraftContent] = useState("");
  const [editorError, setEditorError] = useState("");
  const [isEditorLoading, setIsEditorLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [openLoopError, setOpenLoopError] = useState("");
  const [pendingOpenLoopNo, setPendingOpenLoopNo] = useState("");
  const editableDocument = useMemo(
    () => getEditableMemoryDocumentForPage(page),
    [page.mode, page.date],
  );
  const previewEntry = useMemo(() => {
    if (!editableDocument) {
      return null;
    }

    return parseEditableMemoryContent(editableDocument, draftContent);
  }, [editableDocument, draftContent]);

  useEffect(() => {
    setIsEditing(false);
    setIsPreview(false);
    setDraftContent("");
    setEditorError("");
    setOpenLoopError("");
    setPendingOpenLoopNo("");
  }, [page.mode, page.date]);

  useEffect(() => {
    if (!highlightResult || highlightResult.mode !== page.mode) return;
    if (page.dateBased && highlightResult.date !== page.date) return;
    scrollHitIntoView(highlightResult.targetId);
  }, [highlightResult, page.mode, page.date, page.dateBased, scrollHitIntoView]);

  const getSelectedTextInsidePage = () => {
    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return "";
    }

    const root = pageRef.current;
    const anchorNode = selection.anchorNode;
    const focusNode = selection.focusNode;

    if (!root || !anchorNode || !focusNode) {
      return "";
    }

    if (!root.contains(anchorNode) || !root.contains(focusNode)) {
      return "";
    }

    return selection
      .toString()
      .replace(/\r\n/g, "\n")
      .replace(/\u00a0/g, " ")
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean)
      .join("\n")
      .trim();
  };

  const rememberSelectedShareText = () => {
    const nextSelectedText = getSelectedTextInsidePage();

    if (nextSelectedText) {
      onSelectedShareTextChange?.(nextSelectedText);
    }
  };

  const handleOpenShare = () => {
    const nextSelectedText = getSelectedTextInsidePage();

    if (nextSelectedText) {
      onSelectedShareTextChange?.(nextSelectedText);
    }

    clearTextSelection();

    onOpenShare?.();
  };

  const clearTextSelection = () => {
    const selection = window.getSelection();

    if (selection) {
      selection.removeAllRanges();
    }

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  const handleStartEditing = async () => {
    if (!editableDocument) {
      return;
    }

    if (!canEdit) {
      setEditorError(editHint || "编辑当前不可用。");
      return;
    }

    try {
      setIsEditorLoading(true);
      setEditorError("");
      const result = await fetchEditableMemoryDocument(editableDocument);
      setDraftContent(
        result.content || buildEditableMemoryTemplate(editableDocument),
      );
      setIsEditing(true);
      setIsPreview(false);
    } catch (error) {
      setEditorError(String(error?.message || error || "Failed to load document."));
    } finally {
      setIsEditorLoading(false);
    }
  };

  const handleCancelEditing = () => {
    setIsEditing(false);
    setIsPreview(false);
    setEditorError("");
  };

  const handleSaveEditing = async () => {
    if (!editableDocument) {
      return;
    }

    try {
      setIsSaving(true);
      setEditorError("");
      const result = await saveEditableMemoryDocument({
        ...editableDocument,
        content: draftContent,
      });
      onMemoryEntrySaved?.(editableDocument, result.entry);
      setDraftContent(result.content);
      setIsEditing(false);
      setIsPreview(false);
    } catch (error) {
      setEditorError(String(error?.bodyText || error?.message || error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleOpenLoop = async (no, checked) => {
    if (!onToggleOpenLoop) {
      return;
    }

    try {
      setOpenLoopError("");
      setPendingOpenLoopNo(String(no));
      await onToggleOpenLoop(no, checked);
    } catch (error) {
      setOpenLoopError(String(error?.bodyText || error?.message || error));
    } finally {
      setPendingOpenLoopNo("");
    }
  };

  const renderActionButtons = () => {
    if (isEditing) {
      return (
        <button
          className="absolute right-0 top-[80px] z-20 border px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.16em]"
          style={{ borderColor: page.color, color: page.color }}
          type="button"
          onClick={() => setIsPreview((current) => !current)}
        >
          {isPreview ? "raw" : "preview"}
        </button>
      );
    }

    const showShare =
      (page.mode === "Diary" || page.mode === "Letters") &&
      page.hasEntry &&
      onOpenShare;
    const editLabel = page.hasEntry ? "edit" : "create";
    const editDisabled = isEditorLoading || !canEdit;

    if (showShare) {
      return (
        <div className="absolute right-0 top-[80px] z-20 flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-2">
            <button
              className="border px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.16em] disabled:opacity-45"
              style={{ borderColor: page.color, color: page.color }}
              type="button"
              onClick={handleStartEditing}
              disabled={editDisabled}
            >
              {isEditorLoading ? "loading..." : editLabel}
            </button>
            <button
              className="border px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.16em]"
              style={{ borderColor: page.color, color: page.color }}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
              }}
              onClick={handleOpenShare}
            >
              share
            </button>
          </div>
          {!canEdit && editHint ? (
            <p className="max-w-[210px] text-right text-[10px] leading-4 text-black/42">
              {editHint}
            </p>
          ) : null}
        </div>
      );
    }

    return (
      <div className="absolute right-0 top-[80px] z-20 flex flex-col items-end gap-1.5">
        <button
          className="border px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.16em] disabled:opacity-45"
          style={{ borderColor: page.color, color: page.color }}
          type="button"
          onClick={handleStartEditing}
          disabled={editDisabled}
        >
          {isEditorLoading ? "loading..." : editLabel}
        </button>
        {!canEdit && editHint ? (
          <p className="max-w-[200px] text-right text-[10px] leading-4 text-black/42">
            {editHint}
          </p>
        ) : null}
      </div>
    );
  };

  const previewPage = previewEntry
    ? {
        ...page,
        ...previewEntry,
        hasEntry: true,
      }
    : page;

  return (
    <PageCard
      sectionRef={pageRef}
      motionKey={`${page.id}-${page.mode}-${page.date}`}
      onMouseUp={rememberSelectedShareText}
      onKeyUp={rememberSelectedShareText}
      onTouchEnd={() => {
        window.setTimeout(rememberSelectedShareText, 80);
      }}
      page={page}
      className="relative flex h-full min-h-0 flex-col overflow-hidden border bg-[#f7f5ee] p-5"
    >
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
          {renderActionButtons()}
          {isEditing ? (
            <MemoryEditorShell
              page={page}
              draftContent={draftContent}
              isPreview={isPreview}
              isSaving={isSaving}
              error={editorError}
              onDraftContentChange={setDraftContent}
              onOpenDatePicker={onOpenDatePicker}
              onMonthSelect={onMonthSelect}
              onSave={handleSaveEditing}
              onCancel={handleCancelEditing}
              previewContent={
                <div className="flex min-h-full flex-col">
                  <MemoryContent
                    page={previewPage}
                    highlightResult={null}
                  />
                  <PageBottomMark page={previewPage} />
                </div>
              }
            />
          ) : (
            <article className="relative z-10 flex min-h-0 flex-1 flex-col pt-20">
              <div className="shrink-0">
                <CalendarStrip
                  page={page}
                  onOpenDatePicker={onOpenDatePicker}
                  onMonthSelect={onMonthSelect}
                />
              </div>
              {page.hasEntry ? (
                <CardScrollArea className="pb-8 pt-2">
                  <div className="flex min-h-full flex-col">
                    {openLoopError ? (
                      <p className="mb-3 text-[11px] leading-5 text-[#a2594b]">
                        {openLoopError}
                      </p>
                    ) : null}
                    <MemoryContent
                      page={page}
                      highlightResult={highlightResult}
                      onToggleOpenLoop={
                        page.mode === "Openloops" ? handleToggleOpenLoop : undefined
                      }
                      pendingOpenLoopNo={pendingOpenLoopNo}
                    />
                    <PageBottomMark page={page} />
                  </div>
                </CardScrollArea>
              ) : (
                <CardScrollArea className="pb-8 pt-3">
                  <div className="flex min-h-full flex-col">
                    <p className="whitespace-nowrap font-serif text-[11px] leading-none text-black/48">
                      {page.blankText}
                    </p>
                    <PageBottomMark page={page} />
                  </div>
                </CardScrollArea>
              )}
            </article>
          )}
        </div>
    </PageCard>
  );
}
