import { styleThemes } from "../../config/theme";

export function ChapterTabs({ page, selectedStyleId, setSelectedStyleId }) {
  return (
    <div
      className="grid grid-cols-2 gap-x-3 gap-y-1 border-y py-2 text-[10px] tracking-[0.12em] text-stone-500"
      style={{ borderColor: page.line }}
    >
      {styleThemes.map((item) => (
        <button
          key={item.id}
          onClick={() => setSelectedStyleId(item.id)}
          className="flex items-center justify-between py-1.5 text-left"
          style={{
            color: selectedStyleId === item.id ? page.color : undefined,
          }}
          type="button"
        >
          <span className="font-medium uppercase">{item.label}</span>
          <span className="font-mono text-[10px]">
            {selectedStyleId === item.id ? "●" : "○"}
          </span>
        </button>
      ))}
    </div>
  );
}
