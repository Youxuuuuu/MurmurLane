import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export function ThreadSwitch({ page, selectedThreadId, onSelectThread, threadIds }) {
  const [open, setOpen] = useState(false);
  const shortId = `${selectedThreadId.slice(0, 8)}…${selectedThreadId.slice(-4)}`;
  return (
    <div className="relative z-40 w-[132px] font-mono">
      <button
        className="flex w-full items-center justify-between border px-2.5 py-2 text-[8px] uppercase leading-none tracking-[0.04em]"
        style={{
          color: page.color,
          borderColor: page.color,
          background: page.pale,
        }}
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
        <span>{shortId}</span>
        <span>{open ? "▲" : "▼"}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute right-0 top-[calc(100%+6px)] w-[210px] border bg-[#f4f0e8] p-1"
            style={{ borderColor: page.line }}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
          >
            {threadIds.map((threadId) => (
              <button
                key={threadId}
                className="w-full px-2 py-2 text-left text-[8px] leading-4"
                style={{
                  color:
                    threadId === selectedThreadId
                      ? page.color
                      : "rgba(0,0,0,.46)",
                  background:
                    threadId === selectedThreadId ? page.pale : "transparent",
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
