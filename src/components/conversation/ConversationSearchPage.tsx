import type { ConversationRecord } from "../../types/conversation";
import type { SearchConversationOptions } from "../../types/api";
import type {
  ConversationIdentity,
  ConversationThreadProfile,
} from "../../lib/conversationProfiles";
import { CardScrollArea } from "../layout/CardScrollArea";
import { CalendarStrip } from "../calendar/CalendarStrip";
import { DatePickerModal } from "../calendar/DatePickerModal";
import { ConversationAvatar } from "./ConversationAvatar";
import { ConversationNavBar } from "./ConversationNavBar";
import { ConversationSearchFilters } from "./ConversationSearchFilters";
import { ConversationSearchResultList } from "./ConversationSearchResultList";
import { useConversationSearch } from "./useConversationSearch";

export function ConversationSearchPage({
  page,
  threadId,
  threadDates,
  userProfile,
  threadProfile,
  onBack,
  onEditThread,
  onSelectResult,
  searchConversations,
  mediaUrls,
}: {
  page: Record<string, any>;
  threadId: string;
  threadDates: string[];
  userProfile: ConversationIdentity;
  threadProfile: ConversationThreadProfile;
  onBack: () => void;
  onEditThread: () => void;
  onSelectResult: (record: ConversationRecord) => void | Promise<void>;
  searchConversations: (options: SearchConversationOptions) => Promise<ConversationRecord[]>;
  mediaUrls: import("../../lib/conversation").ConversationMediaUrlPort;
}) {
  const search = useConversationSearch({
    page,
    dates: threadDates,
    threadId,
    limit: 120,
    searchConversations,
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
    visibleResults,
    loading,
    error,
    selectAllDates,
    selectMonth,
    selectDate,
  } = search;
  const stripPage = {
    ...calendarPage,
    color: "#d7dadd",
  };
  const pickerPage = {
    ...calendarPage,
    color: "#b9c8d2",
    line: "#dfe5e9",
  };
  return (
    <section
      className="relative flex h-full min-h-0 flex-col font-sans text-black"
      style={{ backgroundColor: threadProfile.background || "#fbfbfa" }}
    >
      <header className="shrink-0 px-4 pb-3 pt-2">
        <ConversationNavBar
          title={threadProfile.handle || `@${threadProfile.name}`}
          subtitle={threadProfile.signature}
          onBack={onBack}
          backLabel="返回当前聊天"
          trailing={
            <ConversationAvatar
              src={userProfile.avatar}
              name={userProfile.name || "我"}
              size="md"
            />
          }
        />

        <div className="mt-4 flex items-center gap-3">
          <button type="button" onClick={onEditThread} className="shrink-0" aria-label={`编辑${threadProfile.name}的聊天资料`}>
            <ConversationAvatar
              src={threadProfile.avatar}
              name={threadProfile.name}
              size="md"
            />
          </button>
          <div className="flex min-w-0 flex-1 overflow-hidden rounded-[7px] border border-[#d7dadd] bg-white/60">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">搜索当前聊天记录</span>
              <input
                type="search"
                name="conversation-thread-search"
                autoComplete="off"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索当前聊天记录…"
                className="h-11 w-full bg-transparent px-4 text-[13px] text-black/[0.72] outline-none placeholder:text-black/[0.42]"
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

      <CardScrollArea className="min-h-0 flex-1 px-3 pb-8 pt-2">
        {!query.trim() ? (
          <div className="flex min-h-[42vh] items-center justify-center px-10 text-center text-[12px] leading-6 text-black/[0.28]">
            只搜索当前聊天框里的对话记录
          </div>
        ) : loading ? (
          <div className="py-16 text-center text-[11px] text-black/[0.28]">正在搜索…</div>
        ) : error ? (
          <div className="py-16 text-center text-[11px] text-[#b56f78]">{error}</div>
        ) : visibleResults.length === 0 ? (
          <div className="py-16 text-center text-[11px] text-black/[0.28]">没有找到相关记录</div>
        ) : (
          <ConversationSearchResultList
            page={page}
            query={query}
            results={visibleResults}
            userProfile={userProfile}
            fallbackThreadProfile={threadProfile}
            onEditThread={onEditThread}
            onSelectResult={onSelectResult}
            mediaUrls={mediaUrls}
          />
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
