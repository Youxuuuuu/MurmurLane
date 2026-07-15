export function BottomNav({ activeSection, onSelectSection, page }) {
  const items = [
    { id: "Conversation", label: "对话" },
    { id: "Timeline", label: "时间轴" },
    { id: "Archive", label: "回忆" },
  ];
  return (
    <nav
      aria-label="主要页面"
      className="absolute inset-x-0 bottom-0 z-30 border-t bg-[#eeeae1]/95 px-3 py-3 pb-[calc(12px+env(safe-area-inset-bottom))] backdrop-blur"
      style={{
        borderColor: page.line,
        transform: "translateY(var(--app-keyboard-inset, 0px))",
      }}
    >
      <div className="grid grid-cols-3 gap-2 font-mono text-[10px] uppercase tracking-[0.12em]">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className="min-h-11 border px-2 py-2"
            aria-current={activeSection === item.id ? "page" : undefined}
            style={{
              color: activeSection === item.id ? page.color : "rgba(0,0,0,.45)",
              borderColor: activeSection === item.id ? page.color : page.line,
              background: activeSection === item.id ? page.pale : "transparent",
            }}
            onClick={() => onSelectSection(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
