import { useEffect, useMemo, useState } from "react";
import { CalendarStrip } from "../calendar/CalendarStrip";
import { PageBottomMark } from "../layout/PageBottomMark";
import { CardScrollArea } from "../layout/CardScrollArea";
import { PageCard } from "../layout/PageCard";
import { ContinuousStaticMemoryContent } from "../archive/MemoryContent";
import { MemoryEditorShell } from "../archive/MemoryEditorShell";
import { XiaoyeModeSwitch } from "../controls/XiaoyeModeSwitch";
import {
  buildEditableMemoryTemplate,
  getEditableMemoryDocumentForPage,
  parseEditableMemoryContent,
} from "../../lib/editableMemory";

export function XiaoyePage({
  page,
  highlightResult: requestedHighlightResult,
  onOpenDatePicker,
  onMonthSelect,
  onSelectXiaoyeMode,
  selectedXiaoyeMode,
  scrollHitIntoView,
  canEdit,
  editHint,
  onLoadEditableDocument,
  onSaveEditableDocument,
}) {
  const [highlightResult, setHighlightResult] = useState(
    requestedHighlightResult,
  );
  useEffect(() => {
    setHighlightResult(requestedHighlightResult);
    if (!requestedHighlightResult) return;
    const timer = window.setTimeout(
      () => setHighlightResult(null),
      3000,
    );
    return () => window.clearTimeout(timer);
  }, [requestedHighlightResult]);
  const [isEditing, setIsEditing] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const [draftContent, setDraftContent] = useState("");
  const [editorError, setEditorError] = useState("");
  const [isEditorLoading, setIsEditorLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const editableDocument = useMemo(
    () => getEditableMemoryDocumentForPage(page),
    [page.mode, page.xiaoyeMode],
  );
  const previewEntry = useMemo(() => {
    if (!editableDocument) {
      return null;
    }

    return parseEditableMemoryContent(editableDocument, draftContent);
  }, [editableDocument, draftContent]);

  useEffect(() => {
    if (!highlightResult || highlightResult.mode !== "Xiaoye") return;
    scrollHitIntoView(highlightResult.targetId);
  }, [highlightResult, page.xiaoyeMode, scrollHitIntoView]);

  useEffect(() => {
    setIsEditing(false);
    setIsPreview(false);
    setDraftContent("");
    setEditorError("");
  }, [page.xiaoyeMode]);

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
      const result = await onLoadEditableDocument(editableDocument);
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

  const handleSaveEditing = async () => {
    if (!editableDocument) {
      return;
    }

    try {
      setIsSaving(true);
      setEditorError("");
      const result = await onSaveEditableDocument({
        ...editableDocument,
        content: draftContent,
      });
      setDraftContent(result.content);
      setIsEditing(false);
      setIsPreview(false);
    } catch (error) {
      setEditorError(String(error?.bodyText || error?.message || error));
    } finally {
      setIsSaving(false);
    }
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
      page={page}
      motionKey={`${page.id}-${page.mode}-${page.xiaoyeMode}`}
      className="relative flex h-full min-h-0 flex-col overflow-hidden border bg-[#f7f5ee] p-5"
    >
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
        {isEditing ? (
          <button
            className="absolute right-0 top-[80px] z-20 border px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.16em]"
            style={{ borderColor: page.color, color: page.color }}
            type="button"
            onClick={() => setIsPreview((current) => !current)}
          >
            {isPreview ? "raw" : "preview"}
          </button>
        ) : (
          <div className="absolute right-0 top-[80px] z-20 flex flex-col items-end gap-1.5">
            <button
              className="border px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.16em] disabled:opacity-45"
              style={{ borderColor: page.color, color: page.color }}
              type="button"
              onClick={handleStartEditing}
              disabled={isEditorLoading || !canEdit}
            >
              {isEditorLoading ? "loading…" : page.hasEntry ? "edit" : "create"}
            </button>
            {!canEdit && editHint ? (
              <p className="max-w-[210px] text-right text-[10px] leading-4 text-black/[0.42]">
                {editHint}
              </p>
            ) : null}
          </div>
        )}
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
            onCancel={() => {
              setIsEditing(false);
              setIsPreview(false);
              setEditorError("");
            }}
            previewContent={
              <div className="flex min-h-full flex-col">
                <ContinuousStaticMemoryContent
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
              <CardScrollArea className="pb-4 pt-1">
                <div className="flex min-h-full flex-col">
                  <ContinuousStaticMemoryContent
                    page={page}
                    highlightResult={highlightResult}
                  />
                  <PageBottomMark page={page} />
                </div>
              </CardScrollArea>
            ) : (
              <CardScrollArea className="pb-4 pt-1">
                <div className="flex min-h-full flex-col">
                  <p className="text-[11px] leading-7 tracking-[0.08em] text-[#8f877b]">
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
