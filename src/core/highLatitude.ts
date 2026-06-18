import type { HighLatitudeRule } from "./types";

export function nightPortion(rule: HighLatitudeRule, angle: number): number {
  switch (rule) {
    case "automatic":
    case "none":
      return 0;
    case "middleOfNight":
      return 1 / 2;
    case "seventhOfNight":
      return 1 / 7;
    case "angleBased":
      return angle / 60;
  }
}

export function clampHighLatitude(
  rule: HighLatitudeRule,
  time: number,
  base: number,
  angle: number,
  night: number,
  before: boolean,
): number {
  if (rule === "none" || rule === "automatic") return time;
  const portion = nightPortion(rule, angle) * night;
  const diff = before ? base - time : time - base;
  if (Number.isNaN(time) || diff > portion) {
    return before ? base - portion : base + portion;
  }
  return time;
}
