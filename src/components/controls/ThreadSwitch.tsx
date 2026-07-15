import { useState } from "react";

function ChevronIcon({ open }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 12"
      className={`h-3 w-3 shrink-0 ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.25 4.5 6 8.25 9.75 4.5" />
    </svg>
  );
}

export function ThreadSwitch({
  page,
  selectedThreadId,
  onSelectThread,
  threadIds,
}) {
  const [open, setOpen] = useState(false);
  const shortId = `${selectedThreadId.slice(0, 8)}…${selectedThreadId.slice(-4)}`;
  const selectedIndex = threadIds.indexOf(selectedThreadId);
  const threadLabel =
    selectedIndex >= 0
      ? `Thread ${String(selectedIndex + 1).padStart(2, "0")} · ${selectedThreadId.slice(32, 36)}`
      : shortId;

  return (
    <div className="relative z-40 w-full max-w-[126px] font-mono sm:max-w-[148px]" onKeyDown={(event) => {
      if (event.key === "Escape") setOpen(false);
    }}>
      <button
        className="flex min-h-8 w-full min-w-0 items-center justify-between gap-1.5 border px-2 py-1.5 text-[8px] uppercase leading-none tracking-[0.06em]"
        style={{
          color: page.color,
          borderColor: page.color,
          background: `${page.color}12`,
        }}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        title={selectedThreadId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="min-w-0 truncate text-left">{threadLabel}</span>
        <ChevronIcon open={open} />
      </button>
      {open && (
          <div className="absolute left-1/2 top-[calc(100%+6px)] z-[60] w-[210px] max-w-[calc(100vw-48px)] -translate-x-1/2">
            <div
              role="listbox"
              aria-label="选择对话线程"
              className="border bg-[#f4f0e8] p-1"
              style={{ borderColor: page.line }}
            >
            {threadIds.map((threadId) => (
              <button
                key={threadId}
                className="min-h-9 w-full border border-transparent px-2 py-1.5 text-left text-[8px] leading-4"
                role="option"
                aria-selected={threadId === selectedThreadId}
                style={{
                  color:
                    threadId === selectedThreadId
                      ? page.color
                      : "rgba(0,0,0,.46)",
                  background:
                    threadId === selectedThreadId
                      ? `${page.color}12`
                      : "transparent",
                }}
                type="button"
                onClick={() => {
                  onSelectThread(threadId);
                  setOpen(false);
                }}
              >
                {threadId}
              </button>
            ))}
          </div>
          </div>
        )}
    </div>
  );
}
