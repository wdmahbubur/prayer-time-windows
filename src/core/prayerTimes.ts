import type { Prayer, PrayerTimes } from "./types";
import { isObligatory, prayers } from "./types";

export interface CurrentWaqt {
  prayer: Prayer;
  start: Date;
  end: Date;
  isObligatory: boolean;
}

export function orderedTimes(day: PrayerTimes): Array<{ prayer: Prayer; time: Date }> {
  return prayers
    .map((prayer) => {
      const time = day.times[prayer];
      return time ? { prayer, time } : undefined;
    })
    .filter((entry): entry is { prayer: Prayer; time: Date } => Boolean(entry))
    .sort((a, b) => a.time.getTime() - b.time.getTime());
}

export function nextPrayer(day: PrayerTimes, after: Date): { prayer: Prayer; time: Date } | undefined {
  return orderedTimes(day).find((entry) => entry.time > after);
}

export function currentPrayer(day: PrayerTimes, at: Date): { prayer: Prayer; time: Date } | undefined {
  return orderedTimes(day)
    .filter((entry) => entry.time <= at)
    .at(-1);
}

export function resolveCurrentWaqt(at: Date, today: PrayerTimes, tomorrow: PrayerTimes): CurrentWaqt | undefined {
  const orderedToday = orderedTimes(today);
  const orderedTomorrow = orderedTimes(tomorrow);
  const all = [...orderedToday, ...orderedTomorrow];
  let current = orderedToday.filter((entry) => entry.time <= at).at(-1);

  if (!current) {
    current = { prayer: "isha", time: new Date(today.date.getTime() - 24 * 60 * 60_000) };
  }

  const end = all.find((entry) => entry.time > at)?.time;
  if (!end) return undefined;
  return {
    prayer: current.prayer,
    start: current.time,
    end,
    isObligatory: isObligatory(current.prayer),
  };
}

export function ishraq(day: PrayerTimes, offsetMinutes = 20): Date | undefined {
  const sunrise = day.times.sunrise;
  if (!sunrise) return undefined;
  return new Date(sunrise.getTime() + offsetMinutes * 60_000);
}

export function shortCountdown(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

export function longCountdown(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
