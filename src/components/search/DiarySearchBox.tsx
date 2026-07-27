import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { searchModeOptions, searchTimeOptions } from "../../config/searchOptions";
import { normalizeSearchText } from "../../lib/search";
import { buildSearchResultState } from "../../lib/searchPageData";
import { HighlightText } from "../common/HighlightText";
import { PaperTexture } from "../common/PaperTexture";

const ENABLE_SEARCH_PERF_LOG = false;
const conversationThreadScopeOptions = [
  { value: "all", label: "全部线程" },
  { value: "current", label: "当前线程" },
] as const;

function useDebouncedValue(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export function DiarySearchBox({
  page,
  selectedDate,
  selectedThreadId,
  onSelectResult,
  onSearchQueryChange,
  searchRemoteData,
  searchDataVersion,
  workspaceScope,
}) {
  const [inputQuery, setInputQuery] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const [focused, setFocused] = useState(false);
  const [searchFilterOpen, setSearchFilterOpen] = useState(false);
  const [searchModeFilter, setSearchModeFilter] = useState("All");
  const [searchTimeFilter, setSearchTimeFilter] = useState("All");
  const [conversationThreadScope, setConversationThreadScope] = useState<
    "all" | "current"
  >("all");
  const debouncedQuery = useDebouncedValue(inputQuery, 300);
  const searchQuery = isComposing ? "" : debouncedQuery;
  const searchBoxRef = useRef(null);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!searchBoxRef.current) return;

      if (!searchBoxRef.current.contains(event.target)) {
        setFocused(false);
        setSearchFilterOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  const searchState = useMemo(
    () => {
      const shouldLog =
        ENABLE_SEARCH_PERF_LOG &&
        searchQuery.trim().length > 0;
      const startTime = shouldLog ? performance.now() : 0;
      const nextSearchState = buildSearchResultState(searchQuery, searchRemoteData, {
        modeFilter: searchModeFilter,
        timeFilter: searchTimeFilter,
        conversationThreadScope,
        conversationThreadId: selectedThreadId,
        selectedDate,
        limit: 50,
        workspaceScope,
      });

      if (shouldLog) {
        console.debug("[MurmurLane Search Perf] buildSearchResultState", {
          query: searchQuery,
          modeFilter: searchModeFilter,
          timeFilter: searchTimeFilter,
          conversationThreadScope,
          conversationThreadId: selectedThreadId,
          selectedDate,
          searchDataVersion,
          resultsLength: nextSearchState.results.length,
          totalOccurrences: nextSearchState.totalOccurrences,
          durationMs: Number((performance.now() - startTime).toFixed(2)),
        });
      }

      return nextSearchState;
    },
    [
      searchQuery,
      searchModeFilter,
      searchTimeFilter,
      conversationThreadScope,
      selectedThreadId,
      selectedDate,
      searchRemoteData,
      searchDataVersion,
      workspaceScope,
    ],
  );
  const results = searchState.results;
  const showResultPanel = focused && inputQuery.trim().length > 0;
  const showPanel = searchFilterOpen || showResultPanel;
  const pendingSearch =
    inputQuery.trim().length > 0 &&
    normalizeSearchText(inputQuery) !== normalizeSearchText(searchQuery);

  useEffect(() => {
    if (isComposing) return;
    onSearchQueryChange(searchQuery);
  }, [isComposing, searchQuery, onSearchQueryChange]);

  return (
    <div
      ref={searchBoxRef}
      className="relative z-50 w-[116px] font-mono sm:w-[136px]"
      role="search"
      aria-label="全局内容搜索"
    >
      <div className="flex items-stretch gap-1">
        <button
          className="shrink-0 border bg-white/30 px-2 text-[8px] uppercase tracking-[0.12em] text-black/55 transition hover:bg-white/[0.45]"
          style={{
            borderColor: searchFilterOpen ? page.color : page.line,
            color: searchFilterOpen ? page.color : "rgba(0,0,0,.55)",
            background: searchFilterOpen ? `${page.color}10` : "rgba(255,255,255,.3)",
          }}
          type="button"
          aria-expanded={searchFilterOpen}
          aria-controls="diary-search-panel"
          aria-pressed={searchFilterOpen}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setSearchFilterOpen((current) => !current);
            setFocused(true);
          }}
        >
          筛选
        </button>
        <input
          className="min-w-0 flex-1 border bg-white/25 px-2.5 py-2 text-[12px] leading-none text-black/65 outline-none placeholder:text-[9px] placeholder:uppercase placeholder:tracking-[0.08em] placeholder:text-black/[0.42]"
          style={{
            borderColor: focused ? page.color : page.line,
            background: focused ? "rgba(255,255,255,.42)" : "rgba(255,255,255,.25)",
          }}
          value={inputQuery}
          type="search"
          name="global-search"
          autoComplete="off"
          aria-label="搜索回忆、时间轴和对话"
          placeholder="SEARCH…"
          onChange={(event) => {
            setInputQuery(event.target.value);
            setFocused(true);
          }}
          onCompositionStart={() => {
            setIsComposing(true);
          }}
          onCompositionEnd={(event) => {
            setIsComposing(false);
            setInputQuery(event.currentTarget.value);
            setFocused(true);
          }}
          onFocus={() => setFocused(true)}
        />
      </div>
      <AnimatePresence>
        {showPanel && (
          <motion.div
            id="diary-search-panel"
            className="absolute right-0 top-[calc(100%+6px)] w-[236px] max-w-[calc(100vw-32px)] border bg-[#f4f0e8] p-2 sm:w-[248px]"
            style={{ borderColor: page.line }}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
          >
            <PaperTexture mode={page.texture} />
            <div className="relative">
              {searchFilterOpen ? (
                <div className="space-y-3 pb-2">
                  <div>
                    <div
                      className="text-[8px] uppercase tracking-[0.12em]"
                      style={{ color: page.color }}
                    >
                      页面类型
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {searchModeOptions.map((option) => {
                        const active = option.value === searchModeFilter;

                        return (
                          <button
                            key={option.value}
                            className="border px-2 py-1 text-[8px] leading-none tracking-[0.08em] transition"
                            style={{
                              borderColor: active ? page.color : page.line,
                              color: active ? page.color : "rgba(0,0,0,0.5)",
                              background: active ? `${page.color}10` : "transparent",
                            }}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => setSearchModeFilter(option.value)}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <div
                      className="text-[8px] uppercase tracking-[0.12em]"
                      style={{ color: page.color }}
                    >
                      时间筛选
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {searchTimeOptions.map((option) => {
                        const active = option.value === searchTimeFilter;

                        return (
                          <button
                            key={option.value}
                            className="border px-2 py-1 text-[8px] leading-none tracking-[0.08em] transition"
                            style={{
                              borderColor: active ? page.color : page.line,
                              color: active ? page.color : "rgba(0,0,0,0.5)",
                              background: active ? `${page.color}10` : "transparent",
                            }}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => setSearchTimeFilter(option.value)}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <div
                      className="text-[8px] uppercase tracking-[0.12em]"
                      style={{ color: page.color }}
                    >
                      对话范围
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {conversationThreadScopeOptions.map((option) => {
                        const active = option.value === conversationThreadScope;

                        return (
                          <button
                            key={option.value}
                            className="border px-2 py-1 text-[8px] leading-none tracking-[0.08em] transition"
                            style={{
                              borderColor: active ? page.color : page.line,
                              color: active ? page.color : "rgba(0,0,0,0.5)",
                              background: active ? `${page.color}10` : "transparent",
                            }}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => setConversationThreadScope(option.value)}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : null}
              {searchFilterOpen && showResultPanel ? (
                <div
                  className="mb-2 h-px"
                  style={{ background: `${page.line}` }}
                />
              ) : null}
              {showResultPanel ? (
                pendingSearch ? (
                  <div className="px-2 py-3 text-[10px] text-black/[0.48]" role="status" aria-live="polite">
                    正在整理搜索范围…
                  </div>
                ) : (
                  <div>
                    <div className="mb-2 px-1 text-[9px] text-black/[0.48]">
                      <span className="font-mono uppercase tracking-[0.08em]">
                        “{searchQuery.trim()}”
                      </span>{" "}
                      出现 {searchState.totalOccurrences} 次
                    </div>
                    <div className="search-scroll relative max-h-[230px] overflow-y-auto space-y-1.5 pr-0">
                      {results.length ? (
                        results.map((result) => (
                          <button
                            key={`${result.mode}-${result.date}-${result.targetId}`}
                            className="w-full border px-2 py-2 text-left"
                            style={{ borderColor: page.line }}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              onSelectResult(result);
                              setInputQuery("");
                              onSearchQueryChange("");
                              setFocused(false);
                              setSearchFilterOpen(false);
                            }}
                          >
                            <div
                              className="text-[9px] tracking-[0.12em]"
                              style={{ color: page.color }}
                            >
                              {result.label}
                            </div>
                            <div className="mt-1 font-mono text-[8px] uppercase tracking-[0.1em] text-black/35">
                              {result.fieldLabel}
                            </div>
                            <div className="mt-1 line-clamp-2 text-[9px] leading-4 text-black/[0.38]">
                              <HighlightText
                                text={result.excerpt}
                                query={result.query}
                                color={page.color}
                              />
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="px-2 py-3 text-[10px] text-black/[0.48]" role="status">
                          没有搜到内容碎片
                        </div>
                      )}
                    </div>
                  </div>
                )
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
