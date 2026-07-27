import { useEffect, useMemo, useState } from "react";
import {
  getConversationDisplayText,
  getConversationVisualKind,
  shouldHideConversationRecord,
} from "../../lib/conversation";
import type { ConversationRecord } from "../../types/conversation";
import type { SearchConversationOptions } from "../../types/api";

export type ConversationSearchKind = "thinking" | "dialogue" | "image" | "file" | "link";

export const conversationSearchKinds: Array<{
  id: ConversationSearchKind;
  label: string;
}> = [
  { id: "thinking", label: "Thinking" },
  { id: "dialogue", label: "对话" },
  { id: "image", label: "图片" },
  { id: "file", label: "文件" },
  { id: "link", label: "链接" },
];

function normalizeDate(value: unknown) {
  return String(value ?? "").replace(/-/g, ".");
}

function getSearchKind(record: ConversationRecord): ConversationSearchKind | null {
  const visualKind = getConversationVisualKind(record);
  if (visualKind === "thinking") return "thinking";
  if (["image", "sticker"].includes(visualKind)) return "image";
  if (visualKind === "file") return "file";

  const searchableText = `${getConversationDisplayText(record)} ${JSON.stringify(record.meta ?? {})}`;
  if (/https?:\/\/|www\.|\b[a-z0-9-]+\.(com|cn|net|org|io|app)\b/i.test(searchableText)) {
    return "link";
  }
  if (["user", "assistant", "system"].includes(visualKind)) return "dialogue";
  return null;
}

export function useConversationSearch({
  page,
  dates,
  threadId,
  limit,
  searchConversations,
}: {
  page: Record<string, any>;
  dates: string[];
  threadId?: string;
  limit: number;
  searchConversations: (options: SearchConversationOptions) => Promise<ConversationRecord[]>;
}) {
  const [query, setQuery] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [selectedKinds, setSelectedKinds] = useState<ConversationSearchKind[]>([]);
  const [results, setResults] = useState<ConversationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const normalizedDates = useMemo(
    () => Array.from(new Set(dates.map(normalizeDate))).sort().reverse(),
    [dates],
  );
  const fallbackDate = normalizedDates[0] || normalizeDate(page.date);
  const activeYear = (selectedDate || selectedMonth || fallbackDate).slice(0, 4);
  const calendarDate = selectedDate || fallbackDate;
  const [, calendarMonth = page.month, calendarDay = page.day] = calendarDate.split(".");
  const calendarPage = {
    ...page,
    date: calendarDate,
    month: calendarMonth,
    day: calendarDay,
  };

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
        const records = await searchConversations({
          threadId,
          query: trimmedQuery,
          month: selectedMonth ? selectedMonth.replace(/\./g, "-") : undefined,
          date: selectedDate ? selectedDate.replace(/\./g, "-") : undefined,
          limit,
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
  }, [limit, query, searchConversations, selectedDate, selectedMonth, threadId]);

  const visibleResults = useMemo(() => {
    if (!selectedKinds.length) return results;
    const selected = new Set(selectedKinds);
    return results.filter((record) => {
      const kind = getSearchKind(record);
      return kind ? selected.has(kind) : false;
    });
  }, [results, selectedKinds]);

  const toggleKind = (kind: ConversationSearchKind) => {
    setSelectedKinds((current) =>
      current.includes(kind)
        ? current.filter((item) => item !== kind)
        : [...current, kind],
    );
  };

  const selectAllDates = () => {
    setSelectedMonth("");
    setSelectedDate("");
  };

  const selectMonth = (month: string) => {
    setSelectedMonth(`${activeYear}.${month}`);
    setSelectedDate("");
  };

  const selectDate = (dateText: string) => {
    const date = normalizeDate(dateText);
    if (date === selectedDate) {
      selectAllDates();
      return;
    }
    setSelectedDate(date);
    setSelectedMonth(date.slice(0, 7));
  };

  return {
    query,
    setQuery,
    selectedMonth,
    selectedDate,
    selectedMonthNumber: selectedMonth.slice(5, 7),
    selectedKinds,
    toggleKind,
    datePickerOpen,
    setDatePickerOpen,
    normalizedDates,
    calendarPage,
    results,
    visibleResults,
    loading,
    error,
    selectAllDates,
    selectMonth,
    selectDate,
  };
}
