export function TimelineModeSwitch({ page, selectedView, onSelectView }) {
  const items = [
    { id: "line", label: "时间轴" },
    { id: "stats", label: "统计" },
    { id: "reminders", label: "提醒" },
  ];
  return (
    <div className="mb-3 grid grid-cols-3 gap-2 font-mono text-[9px] uppercase tracking-[0.1em]">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className="border px-3 py-2"
          style={{
            color: selectedView === item.id ? page.color : "rgba(0,0,0,.45)",
            borderColor: selectedView === item.id ? page.color : page.line,
            background:
              selectedView === item.id ? page.pale : "rgba(255,255,255,.18)",
          }}
          onClick={() => onSelectView(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
