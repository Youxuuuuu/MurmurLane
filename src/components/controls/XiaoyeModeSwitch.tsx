import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { xiaoyeModeMeta, xiaoyeModes } from "../../config/pageModes";

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

export function XiaoyeModeSwitch({ page, selectedXiaoyeMode, onSelectXiaoyeMode }) {
  const [open, setOpen] = useState(false);
  const selectedMeta =
    xiaoyeModeMeta[selectedXiaoyeMode] ?? xiaoyeModeMeta.Ins;

  return (
    <div className="relative z-40 w-[116px] font-mono sm:w-[140px]">
      <button
        className="flex w-full items-center justify-between gap-2 border px-2.5 py-1.5 text-[9px] uppercase leading-none tracking-[0.1em]"
        style={{
          color: page.color,
          borderColor: page.color,
          background: `${page.color}12`,
        }}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="truncate">{selectedMeta.title}</span>
        <ChevronIcon open={open} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute right-0 top-[calc(100%+6px)] w-full border bg-[#f4f0e8] p-1"
            style={{ borderColor: page.line }}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
          >
            {xiaoyeModes.map((mode) => {
              const modeMeta = xiaoyeModeMeta[mode];

              return (
                <button
                  key={mode}
                  className="flex w-full items-center justify-between gap-2 px-2 py-2 text-left text-[9px] uppercase leading-none"
                  style={{
                    color:
                      selectedXiaoyeMode === mode
                        ? page.color
                        : "rgba(0,0,0,.46)",
                    background:
                      selectedXiaoyeMode === mode
                        ? `${page.color}12`
                        : "transparent",
                  }}
                  type="button"
                  onClick={() => {
                    onSelectXiaoyeMode(mode);
                    setOpen(false);
                  }}
                >
                  <span>{modeMeta.title}</span>
                  <span>{selectedXiaoyeMode === mode ? "•" : ""}</span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
