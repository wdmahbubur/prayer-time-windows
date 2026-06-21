export interface CivilDate {
  year: number;
  month: number;
  day: number;
}

export function getTimeZoneOffsetHours(date: Date, timeZone: string): number {
  const parts = getZonedParts(date, timeZone);
  const utcAsLocal = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return (utcAsLocal - date.getTime()) / 3_600_000;
}

export function zonedMidnight(date: CivilDate, timeZone: string): Date {
  const utcGuess = new Date(Date.UTC(date.year, date.month - 1, date.day, 0, 0, 0));
  const offset = getTimeZoneOffsetHours(utcGuess, timeZone);
  return new Date(utcGuess.getTime() - offset * 3_600_000);
}

export function addDays(date: CivilDate, days: number): CivilDate {
  const utc = new Date(Date.UTC(date.year, date.month - 1, date.day + days, 12, 0, 0));
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
}

export function civilDateFromDate(date: Date, timeZone: string): CivilDate {
  const parts = getZonedParts(date, timeZone);
  return { year: parts.year, month: parts.month, day: parts.day };
}

export function minutesSinceMidnight(date: Date, timeZone: string): number {
  const parts = getZonedParts(date, timeZone);
  return parts.hour * 60 + parts.minute + (parts.second >= 30 ? 1 : 0);
}

export function formatClock(date: Date, timeZone: string, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatLongDate(date: Date, timeZone: string, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    dateStyle: "full",
  }).format(date);
}

function getZonedParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const values: Record<string, number> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}
