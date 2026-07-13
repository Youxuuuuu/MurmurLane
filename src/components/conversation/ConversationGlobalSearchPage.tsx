import { useEffect, useMemo, useState } from "react";
import { searchConversation } from "../../data/api";
import { shouldHideConversationRecord } from "../../lib/conversation";
import type { ConversationRecord } from "../../types/conversation";
import type {
  ConversationIdentity,
  ConversationThreadProfile,
} from "../../lib/conversationProfiles";
import { CalendarStrip } from "../calendar/CalendarStrip";
import { DatePickerModal } from "../calendar/DatePickerModal";
import { CardScrollArea } from "../layout/CardScrollArea";
import { ConversationAvatar } from "./ConversationAvatar";
import { ConversationSearchResultList } from "./ConversationSearchResultList";

function normalizeDate(value: unknown) {
  return String(value ?? "").replace(/-/g, ".");
}

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
  const [query, setQuery] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedThreadId, setSelectedThreadId] = useState("");
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [results, setResults] = useState<ConversationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const normalizedDates = useMemo(
    () =>
      Array.from(new Set(conversationDates.map(normalizeDate))).sort().reverse(),
    [conversationDates],
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
  const stripPage = { ...calendarPage, color: "#d7dadd" };
  const pickerPage = {
    ...calendarPage,
    color: "#b9c8d2",
    line: "#dfe5e9",
  };
  const selectedMonthNumber = selectedMonth.slice(5, 7);

  const matchingThreads = useMemo(() => {
    const counts = new Map<string, number>();
    results.forEach((record) => {
      const threadId = String(record.threadId || "");
      if (threadId && threadProfiles[threadId]) {
        counts.set(threadId, (counts.get(threadId) || 0) + 1);
      }
    });
    return Array.from(counts, ([threadId, count]) => ({ threadId, count }));
  }, [results, threadProfiles]);
  const visibleResults = useMemo(
    () =>
      selectedThreadId
        ? results.filter((record) => record.threadId === selectedThreadId)
        : results,
    [results, selectedThreadId],
  );

  useEffect(() => {
    if (
      selectedThreadId &&
      !matchingThreads.some((item) => item.threadId === selectedThreadId)
    ) {
      setSelectedThreadId("");
    }
  }, [matchingThreads, selectedThreadId]);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setResults([]);
      setSelectedThreadId("");
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
          query: trimmedQuery,
          month: selectedMonth ? selectedMonth.replace(/\./g, "-") : undefined,
          date: selectedDate ? selectedDate.replace(/\./g, "-") : undefined,
          limit: 200,
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
  }, [query, selectedDate, selectedMonth]);

  return (
    <section className="relative flex h-full min-h-0 flex-col bg-[#fbfbfa] font-sans text-black">
      <header className="shrink-0 px-4 pb-3 pt-2">
        <div className="grid grid-cols-[44px_minmax(0,1fr)_52px] items-start">
          <button
            type="button"
            onClick={onBack}
            className="flex h-11 items-center text-[32px] font-light leading-none text-black/70"
            aria-label="返回对话列表"
          >
            ‹
          </button>
          <div className="min-w-0 pt-1 text-center">
            <div className="truncate text-[15px] font-semibold text-black/68">
              {userProfile.name}
            </div>
            <p className="mt-1 line-clamp-2 text-[10px] leading-[1.35] text-black/30">
              {userProfile.signature}
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

        <div className="mt-4 flex overflow-hidden rounded-[7px] border border-[#d7dadd] bg-white/60 focus-within:border-[#b9c8d2]">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">搜索全部聊天记录</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoFocus
              placeholder="搜索全部聊天记录"
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

      <CardScrollArea className="min-h-0 flex-1 px-3 pb-8 pt-1">
        {!query.trim() ? (
          <div className="flex min-h-[38vh] items-center justify-center px-10 text-center text-[12px] leading-6 text-black/28">
            搜索全部聊天记录
          </div>
        ) : loading ? (
          <div className="py-16 text-center text-[11px] text-black/28">正在搜索…</div>
        ) : error ? (
          <div className="py-16 text-center text-[11px] text-[#9a737a]">{error}</div>
        ) : results.length === 0 ? (
          <div className="py-16 text-center text-[11px] text-black/28">没有找到相关记录</div>
        ) : (
          <>
            <section className="mb-6 border-b border-black/[0.055] pb-5">
              <h2 className="mb-3 px-1 text-[12px] font-semibold text-black/62">
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
                        <span className="max-w-full truncate text-[11px] font-medium text-black/58">
                          {profile.name}
                        </span>
                        <span className="text-[9px] text-black/28">· {count}</span>
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
