import { AppScrollbarStyle } from "./AppScrollbarStyle";
import type { CSSProperties } from "react";

export function AppShell({
  viewport,
  bottomNavigation,
  modalLayer,
  edgeToEdge = false,
}) {
  return (
    <div className="app-shell h-full min-h-0 bg-[#eeeae1] text-stone-700">
      <AppScrollbarStyle />
      <main
        className={`app-shell relative flex h-full min-h-0 w-full flex-col overflow-hidden border-x border-transparent ${edgeToEdge ? "bg-white px-0 pt-[env(safe-area-inset-top)]" : "bg-[#eeeae1] px-4 pt-[calc(12px+env(safe-area-inset-top))]"}`}
        style={{
          "--app-bottom-nav-space": bottomNavigation
            ? "calc(76px + env(safe-area-inset-bottom))"
            : "0px",
        } as CSSProperties}
      >
        {viewport}
        {bottomNavigation}
        {modalLayer}
      </main>
    </div>
  );
}
