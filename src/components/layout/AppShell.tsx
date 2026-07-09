import { AppScrollbarStyle } from "./AppScrollbarStyle";
import type { CSSProperties } from "react";

export function AppShell({
  viewport,
  bottomNavigation,
  modalLayer,
}) {
  return (
    <div className="min-h-[var(--app-stable-height,100svh)] bg-[#eeeae1] text-stone-700">
      <AppScrollbarStyle />
      <main
        className="relative flex h-[var(--app-stable-height,100svh)] w-full flex-col overflow-hidden border-x border-transparent bg-[#eeeae1] px-4 pt-[calc(12px+env(safe-area-inset-top))]"
        style={{
          "--app-bottom-nav-space": "calc(76px + env(safe-area-inset-bottom))",
        } as CSSProperties}
      >
        {viewport}
        {bottomNavigation}
        {modalLayer}
      </main>
    </div>
  );
}
