import {
  conversationSearchKinds,
  type ConversationSearchKind,
} from "./useConversationSearch";

export function ConversationSearchFilters({
  selectedKinds,
  onToggle,
}: {
  selectedKinds: ConversationSearchKind[];
  onToggle: (kind: ConversationSearchKind) => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-2" aria-label="搜索内容类型">
      {conversationSearchKinds.map((kind) => {
        const active = selectedKinds.includes(kind.id);
        return (
          <button
            key={kind.id}
            type="button"
            onClick={() => onToggle(kind.id)}
            aria-pressed={active}
            className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors ${
              active
                ? "border-[#7d8da0] bg-[#e7ecf2] text-[#53677e]"
                : "border-black/10 bg-white/[0.72] text-black/[0.42]"
            }`}
          >
            {active ? "✓ " : ""}{kind.label}
          </button>
        );
      })}
    </div>
  );
}
