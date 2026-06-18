import type { AppSettings, Coordinates, Prayer, PrayerNotificationConfig, ResolvedNotification } from "./types";
import { defaultCalculationParameters, prayers } from "./types";

export const defaultCoordinates: Coordinates = { latitude: 41.0082, longitude: 28.9784, elevation: 0 };

export const defaultJamaatTimes: Partial<Record<Prayer, number>> = {
  fajr: 5 * 60,
  dhuhr: 13 * 60 + 30,
  asr: 17 * 60,
  maghrib: 18 * 60 + 30,
  isha: 20 * 60,
};

export function defaultNotifications(): Partial<Record<Prayer, PrayerNotificationConfig>> {
  const configs: Partial<Record<Prayer, PrayerNotificationConfig>> = {};
  for (const prayer of prayers) {
    if (prayer === "sunrise") {
      configs[prayer] = defaultPrayerNotification({ notify: false });
    } else if (prayer === "dhuhr") {
      configs[prayer] = defaultPrayerNotification({ earlyReminderEnabled: true, earlyLeadMinutesOverride: 20 });
    } else if (prayer === "maghrib") {
      configs[prayer] = defaultPrayerNotification({ earlyReminderEnabled: true, earlyLeadMinutesOverride: 10 });
    } else {
      configs[prayer] = defaultPrayerNotification();
    }
  }
  return configs;
}

export function defaultSettings(): AppSettings {
  return {
    methodId: "mwl",
    manualParameters: defaultCalculationParameters({ fajrAngle: 18, ishaAngle: 17 }),
    hanafiAsr: false,
    highLatitudeRule: "automatic",
    locationMode: "automatic",
    manualCoordinates: defaultCoordinates,
    timeZoneMode: { kind: "system" },
    autoDetectMethod: true,
    calculationMode: "calculated",
    azanBeforeJamaat: 15,
    manualKeepWaqt: true,
    jamaatTimes: defaultJamaatTimes,
    menuBarStyle: "iconNameCountdown",
    menuBarCountdownMode: "nextPrayer",
    showIshraqTime: false,
    showHijriDate: true,
    hijriDayAdjustment: 0,
    focusModeEnabled: false,
    focusDurationMinutes: 15,
    focusBlurIntensity: "medium",
    focusTrigger: "obligatory",
    focusEmergencyExitEnabled: true,
    launchAtLogin: false,
    masterNotificationsEnabled: true,
    notificationDefaults: {
      sound: "takbir",
      playFullAdhan: false,
      earlyReminderMinutes: 0,
      iqamahOffsetMinutes: 0,
    },
    notifications: defaultNotifications(),
    autoUpdateEnabled: true,
    didCompleteOnboarding: false,
  };
}

export function resolvedNotification(settings: AppSettings, prayer: Prayer): ResolvedNotification {
  const cfg = settings.notifications[prayer] ?? defaultPrayerNotification();
  const lead = cfg.earlyLeadMinutesOverride ?? settings.notificationDefaults.earlyReminderMinutes;
  const iqamah = prayer !== "sunrise" ? cfg.iqamahOffsetMinutesOverride ?? settings.notificationDefaults.iqamahOffsetMinutes : 0;
  return {
    notify: cfg.notify,
    sound: cfg.soundOverride ?? settings.notificationDefaults.sound,
    playFullAdhan: prayer !== "sunrise" && cfg.playFullAdhan,
    earlyReminderEnabled: cfg.earlyReminderEnabled && lead > 0,
    earlyLeadMinutes: Math.max(1, lead),
    iqamahOffsetMinutes: Math.max(0, iqamah),
  };
}

export function defaultPrayerNotification(
  overrides: Partial<PrayerNotificationConfig> = {},
): PrayerNotificationConfig {
  return {
    notify: true,
    playFullAdhan: false,
    earlyReminderEnabled: false,
    ...overrides,
  };
}
