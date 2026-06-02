import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

function ChevronIcon({ open }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 12"
      className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
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
      ? `Thread ${String(selectedIndex + 1).padStart(2, "0")} · ${shortId}`
      : shortId;

  return (
    <div className="relative z-40 w-full max-w-[140px] font-mono sm:max-w-[176px]">
      <button
        className="flex w-full min-w-0 items-center justify-between gap-2 border px-2.5 py-1.5 text-[8px] uppercase leading-none tracking-[0.08em]"
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
      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute right-0 top-[calc(100%+6px)] w-[220px] max-w-[calc(100vw-48px)] border bg-[#f4f0e8] p-1"
            style={{ borderColor: page.line }}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
          >
            {threadIds.map((threadId) => (
              <button
                key={threadId}
                className="w-full border border-transparent px-2 py-2 text-left text-[8px] leading-4"
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
