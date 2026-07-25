import type { ConversationMediaItem } from "../../types/conversation";

type FileCardPage = {
  color?: string;
  line?: string;
};

export function ConversationFileCard({
  item,
  page,
  fallbackName = "文件",
}: {
  item: ConversationMediaItem;
  page?: FileCardPage;
  fallbackName?: string;
}) {
  const fileName = String(item.fileName || item.label || fallbackName);
  const fileMeta = String(
    item.fileMeta || item.relativePath || item.path || "FILE",
  );

  return (
    <div
      className="flex max-w-[204px] items-center gap-2 border bg-white/[0.72] px-3 py-2 text-left"
      style={{ borderColor: page?.line }}
      data-conversation-media="file-card"
    >
      <div
        className="flex h-9 w-8 shrink-0 items-center justify-center border bg-white/50 font-mono text-[9px] uppercase tracking-[0.08em]"
        style={{ color: page?.color, borderColor: page?.line }}
      >
        {fileName.split(".").pop()}
      </div>
      <div className="min-w-0">
        <div className="truncate text-[12px] leading-4 text-black/[0.72]">
          {fileName}
        </div>
        <div className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.1em] text-black/35">
          {fileMeta}
        </div>
      </div>
    </div>
  );
}
