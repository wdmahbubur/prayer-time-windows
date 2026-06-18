import { acos, acot, asin, atan2, cos, fixAngle, fixHour, sin, tan } from "./degreeMath";

export interface SolarPosition {
  declination: number;
  equationOfTime: number;
}

export function solarPosition(julianDate: number): SolarPosition {
  const d = julianDate - 2451545.0;
  const g = fixAngle(357.529 + 0.98560028 * d);
  const q = fixAngle(280.459 + 0.98564736 * d);
  const l = fixAngle(q + 1.915 * sin(g) + 0.02 * sin(2 * g));
  const e = 23.439 - 0.00000036 * d;

  const declination = asin(sin(e) * sin(l));
  const rightAscension = fixHour(atan2(cos(e) * sin(l), cos(l)) / 15);
  const equationOfTime = q / 15 - rightAscension;
  return { declination, equationOfTime };
}

export function julianDate(year: number, month: number, day: number): number {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + b - 1524.5;
}

export function hourAngle(altitudeBelowHorizon: number, latitude: number, declination: number): number | undefined {
  const numerator = -sin(altitudeBelowHorizon) - sin(latitude) * sin(declination);
  const denominator = cos(latitude) * cos(declination);
  const cosH = numerator / denominator;
  if (cosH < -1 || cosH > 1) return undefined;
  return acos(cosH) / 15;
}

export function asrHourAngle(shadowFactor: number, latitude: number, declination: number): number | undefined {
  const altitude = acot(shadowFactor + tan(Math.abs(latitude - declination)));
  return hourAngle(-altitude, latitude, declination);
}
