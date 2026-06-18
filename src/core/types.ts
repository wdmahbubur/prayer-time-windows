export type Prayer = "fajr" | "sunrise" | "dhuhr" | "asr" | "maghrib" | "isha";

export const prayers: Prayer[] = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];
export const obligatoryPrayers: Prayer[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

export function isObligatory(prayer: Prayer): boolean {
  return prayer !== "sunrise";
}

export interface Coordinates {
  latitude: number;
  longitude: number;
  elevation?: number;
}

export type HighLatitudeRule = "automatic" | "none" | "middleOfNight" | "seventhOfNight" | "angleBased";

export interface CalculationParameters {
  fajrAngle: number;
  ishaAngle?: number;
  ishaFixedMinutes?: number;
  sunriseAngle: number;
  asrShadowFactor: number;
  dhuhrOffsetMinutes: number;
  asrOffsetMinutes: number;
  manualOffsets: Partial<Record<Prayer, number>>;
  highLatitudeRule: HighLatitudeRule;
}

export interface PrayerTimes {
  date: Date;
  times: Partial<Record<Prayer, Date>>;
}

export interface CalculationMethodAdapter {
  id: string;
  displayName: string;
  summary: string;
  resolve(coordinates: Coordinates): CalculationParameters;
}

export type MenuBarStyle =
  | "iconOnly"
  | "countdownOnly"
  | "iconCountdown"
  | "nextPrayerCountdown"
  | "iconNameCountdown"
  | "nextPrayerClock"
  | "iconNameClock";

export type MenuBarCountdownMode = "nextPrayer" | "currentWaqt";
export type CalculationMode = "calculated" | "manual";
export type LocationMode = "automatic" | "manual";
export type TimeZoneMode = { kind: "system" } | { kind: "explicit"; identifier: string };
export type NotificationSound = "none" | "systemDefault" | "softChime" | "takbir" | "adhanMakkah" | "adhanMadinah";
export type FocusBlurIntensity = "low" | "medium" | "high" | "opaque";
export type FocusTrigger = "obligatory" | "all" | "fajrIsha";

export interface NotificationDefaults {
  sound: NotificationSound;
  playFullAdhan: boolean;
  earlyReminderMinutes: number;
  iqamahOffsetMinutes: number;
}

export interface PrayerNotificationConfig {
  notify: boolean;
  playFullAdhan: boolean;
  earlyReminderEnabled: boolean;
  soundOverride?: NotificationSound;
  earlyLeadMinutesOverride?: number;
  iqamahOffsetMinutesOverride?: number;
}

export interface ResolvedNotification {
  notify: boolean;
  sound: NotificationSound;
  playFullAdhan: boolean;
  earlyReminderEnabled: boolean;
  earlyLeadMinutes: number;
  iqamahOffsetMinutes: number;
}

export interface AppSettings {
  methodId: string;
  manualParameters?: CalculationParameters;
  hanafiAsr: boolean;
  highLatitudeRule: HighLatitudeRule;
  locationMode: LocationMode;
  manualCoordinates: Coordinates;
  timeZoneMode: TimeZoneMode;
  autoDetectMethod: boolean;
  calculationMode: CalculationMode;
  azanBeforeJamaat: number;
  manualKeepWaqt: boolean;
  jamaatTimes: Partial<Record<Prayer, number>>;
  menuBarStyle: MenuBarStyle;
  menuBarCountdownMode: MenuBarCountdownMode;
  showIshraqTime: boolean;
  showHijriDate: boolean;
  showPrayerWidget: boolean;
  hijriDayAdjustment: number;
  focusModeEnabled: boolean;
  focusDurationMinutes: number;
  focusBlurIntensity: FocusBlurIntensity;
  focusTrigger: FocusTrigger;
  focusEmergencyExitEnabled: boolean;
  launchAtLogin: boolean;
  languageOverride?: string;
  masterNotificationsEnabled: boolean;
  notificationDefaults: NotificationDefaults;
  notifications: Partial<Record<Prayer, PrayerNotificationConfig>>;
  autoUpdateEnabled: boolean;
  didCompleteOnboarding: boolean;
}

export function defaultCalculationParameters(overrides: Partial<CalculationParameters> = {}): CalculationParameters {
  return {
    fajrAngle: 18,
    ishaAngle: undefined,
    ishaFixedMinutes: undefined,
    sunriseAngle: -0.833,
    asrShadowFactor: 1,
    dhuhrOffsetMinutes: 0,
    asrOffsetMinutes: 0,
    manualOffsets: {},
    highLatitudeRule: "none",
    ...overrides,
  };
}
