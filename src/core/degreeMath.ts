export function fixAngle(angle: number): number {
  return fix(angle, 360);
}

export function fixHour(hour: number): number {
  return fix(hour, 24);
}

export function sin(degrees: number): number {
  return Math.sin(toRadians(degrees));
}

export function cos(degrees: number): number {
  return Math.cos(toRadians(degrees));
}

export function tan(degrees: number): number {
  return Math.tan(toRadians(degrees));
}

export function asin(value: number): number {
  return toDegrees(Math.asin(value));
}

export function acos(value: number): number {
  return toDegrees(Math.acos(value));
}

export function atan2(y: number, x: number): number {
  return toDegrees(Math.atan2(y, x));
}

export function acot(value: number): number {
  return toDegrees(Math.atan(1 / value));
}

function fix(value: number, range: number): number {
  const result = value - range * Math.floor(value / range);
  return result < 0 ? result + range : result;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}
