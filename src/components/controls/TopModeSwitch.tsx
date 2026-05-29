import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { pageModes } from "../../config/pageModes";

export function TopModeSwitch({ page, selectedMode, onSelectMode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative z-40 mt-1 w-[132px] font-mono">
      <button
        className="flex w-full items-center justify-between border px-2.5 py-2 text-[9px] uppercase leading-none tracking-[0.1em]"
        style={{
          color: page.color,
          borderColor: page.color,
          background: page.pale,
        }}
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
        <span>{selectedMode}</span>
        <span>{open ? "▲" : "▼"}</span>
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
            {pageModes.map((mode) => (
              <button
                key={mode}
                className="flex w-full items-center justify-between px-2 py-2 text-left text-[9px] uppercase leading-none"
                style={{
                  color: selectedMode === mode ? page.color : "rgba(0,0,0,.46)",
                  background: selectedMode === mode ? page.pale : "transparent",
                }}
                type="button"
                onClick={() => {
                  onSelectMode(mode);
                  setOpen(false);
                }}
              >
                <span>{mode}</span>
                <span>{selectedMode === mode ? "●" : ""}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
