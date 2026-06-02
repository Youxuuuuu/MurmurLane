export function SegmentSwitch({
  page,
  items,
  selectedId,
  onSelect,
  className = "",
}) {
  return (
    <div
      className={`inline-flex min-w-0 items-center gap-0.5 font-mono text-[9px] uppercase tracking-[0.08em] sm:gap-1 ${className}`}
    >
      {items.map((item) => {
        const active = item.id === selectedId;

        return (
          <button
            key={item.id}
            type="button"
            className="min-w-0 whitespace-nowrap border px-2 py-1.5 transition-colors sm:px-3"
            style={{
              color: active ? page.color : "rgba(0,0,0,.5)",
              borderColor: active ? page.color : page.line,
              background: active ? `${page.color}14` : "rgba(255,255,255,.18)",
            }}
            onClick={() => onSelect(item.id)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
