import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { fetchStickerAssets, type StickerAsset } from "../../data/api";

export function StickerPanel({
  onSelect,
}: {
  onSelect: (sticker: StickerAsset) => Promise<void> | void;
}) {
  const [stickers, setStickers] = useState<StickerAsset[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    let cancelled = false;
    fetchStickerAssets()
      .then((result) => {
        if (!cancelled) setStickers(result.stickers || []);
      })
      .catch((nextError) => {
        if (!cancelled) setError(String(nextError?.message || "表情包加载失败"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase();
    if (!keyword) return stickers;
    return stickers.filter((sticker) =>
      [sticker.id, sticker.fileName, sticker.name, sticker.category, sticker.description, ...(sticker.tags || [])]
        .join(" ")
        .toLocaleLowerCase()
        .includes(keyword),
    );
  }, [query, stickers]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-4 pb-3 pt-1">
        <label className="flex h-10 items-center gap-2 rounded-full bg-black/[0.045] px-3 text-black/35">
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4 4" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索名称、标签或描述"
            className="min-w-0 flex-1 bg-transparent text-[16px] font-normal text-black/70 outline-none placeholder:text-black/35"
          />
        </label>
      </div>
      <div className="diary-scroll min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-3 pb-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {loading ? <p className="py-12 text-center text-[12px] text-black/35">正在整理表情包…</p> : null}
        {error ? <p className="py-12 text-center text-[12px] text-[#a75d64]">{error}</p> : null}
        {!loading && !error && !filtered.length ? <p className="py-12 text-center text-[12px] text-black/35">没有找到相近的表情包</p> : null}
        <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-6">
          {filtered.map((sticker) => (
            <motion.button
              key={sticker.id}
              type="button"
              whileTap={reduceMotion ? undefined : { scale: 0.94 }}
              onClick={async () => {
                setSelectedId(sticker.id);
                await onSelect(sticker);
                window.setTimeout(() => setSelectedId(""), 240);
              }}
              className={`aspect-square overflow-hidden rounded-[18px] p-0 transition-transform ${selectedId === sticker.id ? "scale-[0.96]" : "hover:scale-[0.98]"}`}
              aria-label={`选择表情包 ${sticker.name}`}
              title={[sticker.name, ...(sticker.tags || [])].join(" · ")}
            >
              <img
                className="h-full w-full rounded-[18px] object-cover"
                src={sticker.src}
                alt={sticker.name}
                loading="lazy"
                decoding="async"
                onError={(event) => {
                  event.currentTarget.classList.add("hidden");
                  event.currentTarget.nextElementSibling?.classList.remove("hidden");
                }}
              />
              <span className="hidden h-full w-full items-center justify-center rounded-[18px] bg-black/[0.035] text-[18px] text-[#8e819a]" aria-hidden="true">✦</span>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
