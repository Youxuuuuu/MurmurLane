import { useEffect, useMemo, useState } from "react";
import type { ConversationRecord } from "../../types/conversation";
import type {
  ConversationIdentity,
  ConversationThreadProfile,
} from "../../lib/conversationProfiles";
import { CalendarStrip } from "../calendar/CalendarStrip";
import { DatePickerModal } from "../calendar/DatePickerModal";
import { CardScrollArea } from "../layout/CardScrollArea";
import { ConversationAvatar } from "./ConversationAvatar";
import { ConversationNavBar } from "./ConversationNavBar";
import { ConversationSearchFilters } from "./ConversationSearchFilters";
import { ConversationSearchResultList } from "./ConversationSearchResultList";
import { useConversationSearch } from "./useConversationSearch";

export function ConversationGlobalSearchPage({
  page,
  conversationDates,
  userProfile,
  threadProfiles,
  onBack,
  onSelectResult,
}: {
  page: Record<string, any>;
  conversationDates: string[];
  userProfile: ConversationIdentity;
  threadProfiles: Record<string, ConversationThreadProfile>;
  onBack: () => void;
  onSelectResult: (record: ConversationRecord) => void | Promise<void>;
}) {
  const [selectedThreadId, setSelectedThreadId] = useState("");
  const search = useConversationSearch({
    page,
    dates: conversationDates,
    limit: 200,
  });
  const {
    query,
    setQuery,
    selectedMonth,
    selectedDate,
    selectedMonthNumber,
    selectedKinds,
    toggleKind,
    datePickerOpen,
    setDatePickerOpen,
    normalizedDates,
    calendarPage,
    results,
    visibleResults: kindFilteredResults,
    loading,
    error,
    selectAllDates,
    selectMonth,
    selectDate,
  } = search;
  const stripPage = { ...calendarPage, color: "#d7dadd" };
  const pickerPage = {
    ...calendarPage,
    color: "#b9c8d2",
    line: "#dfe5e9",
  };
  const matchingThreads = useMemo(() => {
    const counts = new Map<string, number>();
    kindFilteredResults.forEach((record) => {
      const threadId = String(record.threadId || "");
      if (threadId && threadProfiles[threadId]) {
        counts.set(threadId, (counts.get(threadId) || 0) + 1);
      }
    });
    return Array.from(counts, ([threadId, count]) => ({ threadId, count }));
  }, [kindFilteredResults, threadProfiles]);
  const visibleResults = useMemo(
    () =>
      selectedThreadId
        ? kindFilteredResults.filter((record) => record.threadId === selectedThreadId)
        : kindFilteredResults,
    [kindFilteredResults, selectedThreadId],
  );

  useEffect(() => {
    if (
      selectedThreadId &&
      !matchingThreads.some((item) => item.threadId === selectedThreadId)
    ) {
      setSelectedThreadId("");
    }
  }, [matchingThreads, selectedThreadId]);

  return (
    <section className="relative flex h-full min-h-0 flex-col bg-[#fbfbfa] font-sans text-black">
      <header className="shrink-0 px-4 pb-3 pt-2">
        <ConversationNavBar
          title={userProfile.name}
          subtitle={userProfile.signature}
          onBack={onBack}
          backLabel="返回对话列表"
          trailing={
            <ConversationAvatar
              src={userProfile.avatar}
              name={userProfile.name || "我"}
              size="md"
            />
          }
        />

        <div className="mt-4 flex overflow-hidden rounded-[7px] border border-[#d7dadd] bg-white/60 focus-within:border-[#b9c8d2]">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">搜索全部聊天记录</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoFocus
              placeholder="搜索全部聊天记录"
              className="h-11 w-full bg-transparent px-4 text-[13px] text-black/[0.72] outline-none placeholder:text-black/[0.28]"
            />
          </label>
          <button
            type="button"
            onClick={() => setDatePickerOpen(true)}
            className="h-11 shrink-0 border-l border-[#d7dadd] px-3 font-mono text-[9px] tracking-[0.08em] text-black/[0.38]"
            aria-label="按日期筛选"
          >
            DATE
          </button>
        </div>
        <ConversationSearchFilters
          selectedKinds={selectedKinds}
          onToggle={toggleKind}
        />

        <div className="mt-4">
          <CalendarStrip
            page={stripPage}
            selectedMonth={selectedMonthNumber}
            showAll
            showCurrentDate={false}
            allSelected={!selectedMonth && !selectedDate}
            onSelectAll={selectAllDates}
            onOpenDatePicker={() => setDatePickerOpen(true)}
            onMonthSelect={selectMonth}
          />
        </div>
      </header>

      <CardScrollArea className="min-h-0 flex-1 px-3 pb-8 pt-1">
        {!query.trim() ? (
          <div className="flex min-h-[38vh] items-center justify-center px-10 text-center text-[12px] leading-6 text-black/[0.28]">
            搜索全部聊天记录
          </div>
        ) : loading ? (
          <div className="py-16 text-center text-[11px] text-black/[0.28]">正在搜索…</div>
        ) : error ? (
          <div className="py-16 text-center text-[11px] text-[#9a737a]">{error}</div>
        ) : results.length === 0 ? (
          <div className="py-16 text-center text-[11px] text-black/[0.28]">没有找到相关记录</div>
        ) : (
          <>
            <section className="mb-6 border-b border-black/[0.055] pb-5">
              <h2 className="mb-3 px-1 text-[12px] font-semibold text-black/[0.62]">
                相关对话
              </h2>
              <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="flex min-w-max gap-5 px-1">
                  {matchingThreads.map(({ threadId, count }) => {
                    const profile = threadProfiles[threadId];
                    const active = selectedThreadId === threadId;
                    return (
                      <button
                        key={threadId}
                        type="button"
                        onClick={() =>
                          setSelectedThreadId(active ? "" : threadId)
                        }
                        className="flex w-[64px] flex-col items-center gap-1.5"
                        aria-pressed={active}
                      >
                        <ConversationAvatar
                          src={profile.avatar}
                          name={profile.name}
                          size="md"
                          className={active ? "shadow-[0_0_0_2px_#b9c8d2]" : ""}
                        />
                        <span className="max-w-full truncate text-[11px] font-medium text-black/[0.58]">
                          {profile.name}
                        </span>
                        <span className="text-[9px] text-black/[0.28]">· {count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <ConversationSearchResultList
              page={page}
              query={query}
              results={visibleResults}
              userProfile={userProfile}
              threadProfiles={threadProfiles}
              onSelectResult={onSelectResult}
            />
          </>
        )}
      </CardScrollArea>

      {datePickerOpen && (
        <DatePickerModal
          page={pickerPage}
          variant="conversation"
          markedDates={normalizedDates}
          onClose={() => setDatePickerOpen(false)}
          onSelectDate={selectDate}
        />
      )}
    </section>
  );
}
