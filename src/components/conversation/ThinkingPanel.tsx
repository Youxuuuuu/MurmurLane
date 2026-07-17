import { useState } from "react";
import { getConversationDisplayText } from "../../lib/conversation";
import type { ConversationRecord } from "../../types/conversation";

export function ThinkingPanel({
  records,
  panelId,
  face = ">ᴗo ಣ >",
  standalone = false,
}: {
  records: ConversationRecord[];
  panelId: string;
  face?: string;
  standalone?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const text = records
    .map((record) => getConversationDisplayText(record).trim())
    .filter(Boolean)
    .join("\n\n");

  return (
    <div
      data-thinking-panel-id={panelId}
      data-thinking-record-count={records.length}
      className={standalone ? "max-w-[min(86vw,520px)] px-3 py-2" : "mb-2"}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-1.5 font-mono text-[10px] font-semibold leading-none tracking-[0.08em] text-black/[0.34]"
      >
        <span>{face}</span>
        <span className="text-[11px]">{open ? "⌄" : "›"}</span>
      </button>
      {open && (
        <div className="mt-2 whitespace-pre-line font-serif text-[10px] font-normal leading-[1.5] text-black/45">
          {text}
        </div>
      )}
    </div>
  );
}
