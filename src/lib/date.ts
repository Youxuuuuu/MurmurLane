// @ts-nocheck
import { contentSourcePaths } from "../config/contentSources";
export function toDotDate(dateText) {
  return String(dateText).replaceAll("-", ".");
}
export function toHyphenDate(dateText) {
  return String(dateText).replaceAll(".", "-");
}
export function pad2(value) {
  return String(value).padStart(2, "0");
}
export function getDateParts(dateText) {
  const [year = "2026", month = "01", day = "01"] =
    toDotDate(dateText).split(".");
  return { year, month, day };
}
export function formatDiaryDate(year, month, day) {
  return `${year}.${pad2(month)}.${pad2(day)}`;
}
export function buildContentPath(mode, dateText) {
  const template = contentSourcePaths[mode] ?? contentSourcePaths.Facts;
  return template.replaceAll("{date}", toHyphenDate(dateText));
}
export function getDateLookupKeys(dateText) {
  const dotDate = toDotDate(dateText);
  return [dotDate, toHyphenDate(dotDate), String(dateText)];
}
export function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}
export function getFirstWeekday(year, month) {
  return new Date(year, month - 1, 1).getDay();
}
export function shiftMonth(year, month, offset) {
  const next = new Date(year, month - 1 + offset, 1);
  return { year: next.getFullYear(), month: next.getMonth() + 1 };
}
export function changeDateMonth(dateText, nextMonth) {
  const { year, day } = getDateParts(dateText);
  const maxDay = getDaysInMonth(Number(year), Number(nextMonth));
  return formatDiaryDate(
    Number(year),
    Number(nextMonth),
    Math.min(Number(day), maxDay),
  );
}

export function shiftDate(dateText, offset) {
  const { year, month, day } = getDateParts(dateText);
  const next = new Date(Number(year), Number(month) - 1, Number(day) + offset);
  return formatDiaryDate(
    next.getFullYear(),
    next.getMonth() + 1,
    next.getDate(),
  );
}
export function getTodayDateText() {
  const today = new Date();
  return formatDiaryDate(
    today.getFullYear(),
    today.getMonth() + 1,
    today.getDate(),
  );
}

