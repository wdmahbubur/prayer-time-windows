import { asrHourAngle, hourAngle, julianDate, solarPosition } from "./solar";
import { clampHighLatitude } from "./highLatitude";
import type { CalculationParameters, Coordinates, Prayer, PrayerTimes } from "./types";
import { addDays, getTimeZoneOffsetHours, zonedMidnight, type CivilDate } from "./timeZone";

interface RawHours {
  fajr: number;
  sunrise: number;
  dhuhr: number;
  asr: number;
  maghrib: number;
  isha: number;
}

export function calculatePrayerTimes(
  date: CivilDate,
  coordinates: Coordinates,
  params: CalculationParameters,
  timeZone: string,
): PrayerTimes {
  const base = zonedMidnight(date, timeZone);
  const tz = getTimeZoneOffsetHours(base, timeZone);
  const jd0 = julianDate(date.year, date.month, date.day);
  const lat = coordinates.latitude;
  const lng = coordinates.longitude;
  const dip = -params.sunriseAngle;

  let h: RawHours = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, maghrib: 18, isha: 18 };
  for (let i = 0; i < 3; i += 1) {
    h = computePass(h, jd0, lat, lng, tz, dip, params);
  }

  const rule = params.highLatitudeRule;
  if (rule !== "none" && !Number.isNaN(h.sunrise) && !Number.isNaN(h.maghrib)) {
    const night = 24 - h.maghrib + h.sunrise;
    h.fajr = clampHighLatitude(rule, h.fajr, h.sunrise, params.fajrAngle, night, true);
    if (params.ishaAngle !== undefined) {
      h.isha = clampHighLatitude(rule, h.isha, h.maghrib, params.ishaAngle, night, false);
    }
  }

  h.dhuhr += params.dhuhrOffsetMinutes / 60;
  h.asr += params.asrOffsetMinutes / 60;

  if (params.ishaFixedMinutes !== undefined) {
    h.isha = h.maghrib + params.ishaFixedMinutes / 60;
  }

  const times: Partial<Record<Prayer, Date>> = {
    fajr: instant(base, tune(h.fajr, "fajr", params)),
    sunrise: instant(base, tune(h.sunrise, "sunrise", params)),
    dhuhr: instant(base, tune(h.dhuhr, "dhuhr", params)),
    asr: instant(base, tune(h.asr, "asr", params)),
    maghrib: instant(base, tune(h.maghrib, "maghrib", params)),
    isha: instant(base, tune(h.isha, "isha", params)),
  };

  for (const key of Object.keys(times) as Prayer[]) {
    if (!times[key]) delete times[key];
  }

  return { date: base, times };
}

export function calculateTodayAndTomorrow(
  now: Date,
  coordinates: Coordinates,
  params: CalculationParameters,
  timeZone: string,
): { today: PrayerTimes; tomorrow: PrayerTimes } {
  const todayDate = dateInTimeZone(now, timeZone);
  const tomorrowDate = addDays(todayDate, 1);
  return {
    today: calculatePrayerTimes(todayDate, coordinates, params, timeZone),
    tomorrow: calculatePrayerTimes(tomorrowDate, coordinates, params, timeZone),
  };
}

function computePass(
  guess: RawHours,
  jd0: number,
  lat: number,
  lng: number,
  tz: number,
  dip: number,
  params: CalculationParameters,
): RawHours {
  const noon = (t: number) => {
    const pos = solarPosition(jd0 + (t - tz) / 24);
    return 12 - lng / 15 - pos.equationOfTime + tz;
  };
  const declination = (t: number) => solarPosition(jd0 + (t - tz) / 24).declination;
  const angleTime = (angle: number, at: number, before: boolean) => {
    const n = noon(at);
    const ha = hourAngle(angle, lat, declination(at));
    if (ha === undefined) return Number.NaN;
    return before ? n - ha : n + ha;
  };

  const dhuhr = noon(guess.dhuhr);
  const sunrise = angleTime(dip, guess.sunrise, true);
  const maghrib = angleTime(dip, guess.maghrib, false);
  const fajr = angleTime(params.fajrAngle, guess.fajr, true);
  const isha = params.ishaAngle === undefined ? guess.isha : angleTime(params.ishaAngle, guess.isha, false);
  const asrHa = asrHourAngle(params.asrShadowFactor, lat, declination(guess.asr));
  const asr = asrHa === undefined ? Number.NaN : noon(guess.asr) + asrHa;

  return { fajr, sunrise, dhuhr, asr, maghrib, isha };
}

function tune(value: number, prayer: Prayer, params: CalculationParameters): number {
  return value + (params.manualOffsets[prayer] ?? 0) / 60;
}

function instant(base: Date, hours: number): Date | undefined {
  if (!Number.isFinite(hours)) return undefined;
  const minutes = Math.round(hours * 60);
  return new Date(base.getTime() + minutes * 60_000);
}

function dateInTimeZone(date: Date, timeZone: string): CivilDate {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }
  return { year: values.year, month: values.month, day: values.day };
}
