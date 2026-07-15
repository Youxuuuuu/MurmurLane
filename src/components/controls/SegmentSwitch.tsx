export function SegmentSwitch({
  page,
  items,
  selectedId,
  onSelect,
  className = "",
}) {
  return (
    <div
      role="group"
      className={`grid min-w-0 overflow-hidden border font-mono text-[9px] uppercase tracking-[0.08em] ${className}`}
      style={{
        gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
        borderColor: page.line,
        background: "rgba(255,255,255,.18)",
      }}
    >
      {items.map((item, index) => {
        const active = item.id === selectedId;
        const isLast = index === items.length - 1;

        return (
          <button
            key={item.id}
            type="button"
            className="min-h-8 min-w-0 px-3 py-1.5 text-center"
            aria-pressed={active}
            style={{
              color: active ? page.color : "rgba(0,0,0,.55)",
              background: active ? `${page.color}14` : "transparent",
              borderRight: isLast ? "none" : `1px solid ${page.line}`,
            }}
            onClick={() => onSelect(item.id)}
          >
            <span className="block truncate">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
