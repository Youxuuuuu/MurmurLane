import { useEffect, useMemo, useState } from "react";
import { searchConversation } from "../../data/api";
import { shouldHideConversationRecord } from "../../lib/conversation";
import type { ConversationRecord } from "../../types/conversation";
import type {
  ConversationIdentity,
  ConversationThreadProfile,
} from "../../lib/conversationProfiles";
import { CardScrollArea } from "../layout/CardScrollArea";
import { CalendarStrip } from "../calendar/CalendarStrip";
import { DatePickerModal } from "../calendar/DatePickerModal";
import { ConversationAvatar } from "./ConversationAvatar";
import { ConversationSearchResultList } from "./ConversationSearchResultList";

function normalizeDate(value: unknown) {
  return String(value ?? "").replace(/-/g, ".");
}

export function ConversationSearchPage({
  page,
  threadId,
  threadDates,
  userProfile,
  threadProfile,
  onBack,
  onEditThread,
  onSelectResult,
}: {
  page: Record<string, any>;
  threadId: string;
  threadDates: string[];
  userProfile: ConversationIdentity;
  threadProfile: ConversationThreadProfile;
  onBack: () => void;
  onEditThread: () => void;
  onSelectResult: (record: ConversationRecord) => void | Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [results, setResults] = useState<ConversationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const normalizedDates = useMemo(
    () => Array.from(new Set(threadDates.map(normalizeDate))).sort().reverse(),
    [threadDates],
  );
  const fallbackDate = normalizedDates[0] || normalizeDate(page.date);
  const activeYear = (selectedDate || selectedMonth || fallbackDate).slice(0, 4);
  const calendarDate = selectedDate || fallbackDate;
  const [, calendarMonth = page.month, calendarDay = page.day] =
    calendarDate.split(".");
  const calendarPage = {
    ...page,
    date: calendarDate,
    month: calendarMonth,
    day: calendarDay,
  };
  const stripPage = {
    ...calendarPage,
    color: "#d7dadd",
  };
  const pickerPage = {
    ...calendarPage,
    color: "#b9c8d2",
    line: "#dfe5e9",
  };
  const selectedMonthNumber = selectedMonth.slice(5, 7);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setResults([]);
      setLoading(false);
      setError("");
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const records = await searchConversation({
          threadId,
          query: trimmedQuery,
          month: selectedMonth ? selectedMonth.replace(/\./g, "-") : undefined,
          date: selectedDate ? selectedDate.replace(/\./g, "-") : undefined,
          limit: 120,
          signal: controller.signal,
        });
        setResults(records.filter((record) => !shouldHideConversationRecord(record)));
      } catch (searchError) {
        if ((searchError as Error)?.name !== "AbortError") {
          setError("搜索失败，请确认 MurmurLane 后端正在运行。");
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, selectedDate, selectedMonth, threadId]);

  return (
    <section
      className="relative flex h-full min-h-0 flex-col font-sans text-black"
      style={{ backgroundColor: threadProfile.background || "#fbfbfa" }}
    >
      <header className="shrink-0 px-4 pb-3 pt-2">
        <div className="grid grid-cols-[44px_minmax(0,1fr)_52px] items-start">
          <button
            type="button"
            onClick={onBack}
            className="flex h-11 items-center text-[32px] font-light leading-none text-black/70"
            aria-label="返回当前聊天"
          >
            ‹
          </button>
          <div className="min-w-0 pt-1 text-center">
            <div className="truncate text-[15px] font-semibold text-black/62">
              {threadProfile.handle || `@${threadProfile.name}`}
            </div>
            <p className="mt-1 line-clamp-2 text-[10px] leading-[1.35] text-black/30">
              {threadProfile.signature}
            </p>
          </div>
          <div className="justify-self-end">
            <ConversationAvatar
              src={userProfile.avatar}
              name={userProfile.name || "我"}
              size="md"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button type="button" onClick={onEditThread} className="shrink-0">
            <ConversationAvatar
              src={threadProfile.avatar}
              name={threadProfile.name}
              size="md"
            />
          </button>
          <div className="flex min-w-0 flex-1 overflow-hidden rounded-[7px] border border-[#d7dadd] bg-white/60 focus-within:border-[#b9c8d2]">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">搜索当前聊天记录</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                autoFocus
                placeholder="搜索当前聊天记录"
                className="h-11 w-full bg-transparent px-4 text-[13px] text-black/72 outline-none placeholder:text-black/28"
              />
            </label>
            <button
              type="button"
              onClick={() => setDatePickerOpen(true)}
              className="h-11 shrink-0 border-l border-[#d7dadd] px-3 font-mono text-[9px] tracking-[0.08em] text-black/38"
              aria-label="按日期筛选"
            >
              DATE
            </button>
          </div>
        </div>

        <div className="mt-4">
          <CalendarStrip
            page={stripPage}
            selectedMonth={selectedMonthNumber}
            showAll
            showCurrentDate={false}
            allSelected={!selectedMonth && !selectedDate}
            onSelectAll={() => {
              setSelectedMonth("");
              setSelectedDate("");
            }}
            onOpenDatePicker={() => setDatePickerOpen(true)}
            onMonthSelect={(month: string) => {
              setSelectedMonth(`${activeYear}.${month}`);
              setSelectedDate("");
            }}
          />
        </div>
      </header>

      <CardScrollArea className="min-h-0 flex-1 px-3 pb-8 pt-2">
        {!query.trim() ? (
          <div className="flex min-h-[42vh] items-center justify-center px-10 text-center text-[12px] leading-6 text-black/28">
            只搜索当前聊天框里的对话记录
          </div>
        ) : loading ? (
          <div className="py-16 text-center text-[11px] text-black/28">正在搜索…</div>
        ) : error ? (
          <div className="py-16 text-center text-[11px] text-[#b56f78]">{error}</div>
        ) : results.length === 0 ? (
          <div className="py-16 text-center text-[11px] text-black/28">没有找到相关记录</div>
        ) : (
          <ConversationSearchResultList
            page={page}
            query={query}
            results={results}
            userProfile={userProfile}
            fallbackThreadProfile={threadProfile}
            onEditThread={onEditThread}
            onSelectResult={onSelectResult}
          />
        )}
      </CardScrollArea>

      {datePickerOpen && (
        <DatePickerModal
          page={pickerPage}
          variant="conversation"
          markedDates={normalizedDates}
          onClose={() => setDatePickerOpen(false)}
          onSelectDate={(dateText: string) => {
            const date = normalizeDate(dateText);
            if (date === selectedDate) {
              setSelectedDate("");
              setSelectedMonth("");
              return;
            }
            setSelectedDate(date);
            setSelectedMonth(date.slice(0, 7));
          }}
        />
      )}
    </section>
  );
}
