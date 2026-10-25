export type DateRange = { start: Date; end: Date };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export class InvalidDateRangeError extends Error {}

export function getBusinessTimeZone() {
  return process.env.BUSINESS_TIME_ZONE || "Asia/Kolkata";
}

function toLocalDateStart(value: string, timeZone: string) {
  if (!DATE_PATTERN.test(value)) throw new InvalidDateRangeError("Use dates in YYYY-MM-DD format.");
  const [year, month, day] = value.split("-").map(Number);
  const nominal = Date.UTC(year, month - 1, day);
  const date = new Date(nominal);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new InvalidDateRangeError("The selected date is invalid.");
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const valueOf = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const observed = Date.UTC(
    valueOf("year"),
    valueOf("month") - 1,
    valueOf("day"),
    valueOf("hour"),
    valueOf("minute"),
    valueOf("second"),
  );
  return new Date(nominal - (observed - nominal));
}

function nextCalendarDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return [
    next.getUTCFullYear(),
    String(next.getUTCMonth() + 1).padStart(2, "0"),
    String(next.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function shiftedCalendarDate(value: string, amount: number) {
  const [year, month, day] = value.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + amount));
  return [
    shifted.getUTCFullYear(),
    String(shifted.getUTCMonth() + 1).padStart(2, "0"),
    String(shifted.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function parseCustomDateRange(
  from: string,
  to: string,
  timeZone = getBusinessTimeZone(),
): DateRange {
  const start = toLocalDateStart(from, timeZone);
  toLocalDateStart(to, timeZone);
  const end = toLocalDateStart(nextCalendarDate(to), timeZone);
  if (start >= end) {
    throw new InvalidDateRangeError("The end date must be on or after the start date.");
  }
  if (end.getTime() - start.getTime() > 366 * DAY_MS) {
    throw new InvalidDateRangeError("Choose a date range of at most 366 days.");
  }
  return { start, end };
}

export function dateRangeForPreset(
  preset: "today" | "last7" | "last30" | "thisMonth",
  now = new Date(),
  timeZone = getBusinessTimeZone(),
) {
  const localToday = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const todayStart = toLocalDateStart(localToday, timeZone);
  const endDate = nextCalendarDate(localToday);
  if (preset === "today") {
    return { start: todayStart, end: toLocalDateStart(endDate, timeZone) };
  }
  if (preset === "last7" || preset === "last30") {
    const dayCount = preset === "last7" ? 7 : 30;
    const from = shiftedCalendarDate(localToday, -(dayCount - 1));
    return { start: toLocalDateStart(from, timeZone), end: toLocalDateStart(endDate, timeZone) };
  }
  const monthStart = `${localToday.slice(0, 7)}-01`;
  return {
    start: toLocalDateStart(monthStart, timeZone),
    end: toLocalDateStart(endDate, timeZone),
  };
}

export function formatBusinessDateTime(value: Date, timeZone = getBusinessTimeZone()) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export function businessDateString(value: Date, timeZone = getBusinessTimeZone()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
