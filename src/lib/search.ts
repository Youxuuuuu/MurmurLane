import type {
  SearchField,
  SearchFilters,
  SearchResult,
  SearchSnippetMatch,
} from "../types/search";
import { getDateParts, getTodayDateText, toDotDate, toHyphenDate } from "./date";
export function normalizeSearchText(value: unknown) {
  return Array.from(String(value).toLowerCase())
    .filter((char) => char.trim())
    .join("");
}
export function buildSearchFields(
  fields: Array<SearchField | (SearchField & { value?: unknown })>,
): SearchField[] {
  return fields.map((field) => {
    const value = String(field.value ?? "");

    return {
      ...field,
      value,
      normalizedValue: normalizeSearchText(value),
    };
  });
}
export function countNormalizedSearchOccurrences(
  normalizedValue: string,
  normalizedQuery: string,
) {
  if (!normalizedQuery) return 0;

  let count = 0;
  let cursor = 0;

  while (cursor <= normalizedValue.length - normalizedQuery.length) {
    const index = normalizedValue.indexOf(normalizedQuery, cursor);

    if (index < 0) break;

    count += 1;
    cursor = index + normalizedQuery.length;
  }

  return count;
}
export function countSearchOccurrences(value: unknown, query: unknown) {
  return countNormalizedSearchOccurrences(
    normalizeSearchText(value),
    normalizeSearchText(query),
  );
}
export function getWeekRange(dateText: string) {
  const { year, month, day } = getDateParts(dateText);
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  const dayOfWeek = date.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const start = new Date(date);
  start.setDate(date.getDate() + mondayOffset);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

export function getDateOnlyTime(dateText: string) {
  const { year, month, day } = getDateParts(dateText);
  return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
}
export function matchesSearchFilters(
  result: SearchResult,
  filters: SearchFilters = {},
  selectedDate = getTodayDateText(),
) {
  const { modeFilter = "All", timeFilter = "All" } = filters;

  if (modeFilter !== "All" && result.mode !== modeFilter) return false;
  if (timeFilter === "All") return true;

  const resultDate = result.filterDate ?? result.date;
  if (!resultDate) return false;

  if (timeFilter === "Day") {
    return toDotDate(resultDate) === toDotDate(selectedDate);
  }
  if (timeFilter === "Week") {
  const resultTime = getDateOnlyTime(resultDate);
  const { start, end } = getWeekRange(selectedDate);

  return resultTime >= start.getTime() && resultTime <= end.getTime();
  }

  const resultParts = getDateParts(resultDate);
  const selectedParts = getDateParts(selectedDate);

  if (timeFilter === "Month") {
    return (
      resultParts.year === selectedParts.year &&
      resultParts.month === selectedParts.month
    );
  }

  if (timeFilter === "Year") {
    return resultParts.year === selectedParts.year;
  }

  return true;
}
export function getSearchResultSortTime(result: SearchResult) {
  if (result.timestamp) {
    const timestamp = new Date(result.timestamp).getTime();

    if (!Number.isNaN(timestamp)) return timestamp;
  }

  const sortDate = result.filterDate ?? result.date;
  if (!sortDate) return null;

  const dateTime = new Date(
    `${toHyphenDate(sortDate)}T23:59:59.999+08:00`,
  ).getTime();

  return Number.isNaN(dateTime) ? null : dateTime;
}
export function sortSearchResults(results: SearchResult[]): SearchResult[] {
  return [...results].sort((left, right) => {
    const leftTime = getSearchResultSortTime(left);
    const rightTime = getSearchResultSortTime(right);

    if (leftTime === null && rightTime !== null) return 1;
    if (leftTime !== null && rightTime === null) return -1;
    if (leftTime !== null && rightTime !== null && leftTime !== rightTime) {
      return rightTime - leftTime;
    }

    const leftDate = String(left.filterDate ?? left.date ?? "");
    const rightDate = String(right.filterDate ?? right.date ?? "");
    const dateCompare = rightDate.localeCompare(leftDate);

    if (dateCompare) return dateCompare;

    return String(left.label ?? "").localeCompare(String(right.label ?? ""));
  });
}
export function findMatchedSnippet(
  query: unknown,
  fields: SearchField[],
  normalizedQueryOverride?: string,
): SearchSnippetMatch {
  const cleanQuery = String(query).trim();
  const normalizedQuery =
    normalizedQueryOverride ?? normalizeSearchText(cleanQuery);
  const fallback = fields.find((field) => field.value)?.value ?? "";
  if (!normalizedQuery)
    return { fieldLabel: "内容", snippet: fallback, matchedText: "" };
  for (const field of fields) {
    const value = String(field.value ?? "");
    const index = value.toLowerCase().indexOf(cleanQuery.toLowerCase());
    if (index >= 0)
      return {
        fieldLabel: field.label,
        snippet: value.slice(
          Math.max(0, index - 18),
          Math.min(value.length, index + cleanQuery.length + 34),
        ),
        matchedText: cleanQuery,
      };
  }
  for (const field of fields) {
    const value = String(field.value ?? "");
    const normalizedValue =
      field.normalizedValue ?? normalizeSearchText(value);
    if (normalizedValue.includes(normalizedQuery))
      return {
        fieldLabel: field.label,
        snippet: value.slice(0, 68),
        matchedText: cleanQuery,
      };
  }
  return {
    fieldLabel: "内容",
    snippet: String(fallback).slice(0, 68),
    matchedText: cleanQuery,
  };
}


