import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  ChevronDown,
  EyeOff,
  GripHorizontal,
  LocateFixed,
  MapPin,
  Moon,
  Pin,
  PlayCircle,
  Power,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  Volume2,
  X,
  Settings as SettingsIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { MWLAdapter, builtInMethods, methodIdForCountryCode, resolveMethod } from "../core/adapters";
import { buildTrayLabel, formatHijriDateLocalized, prayerLabel, resolveLanguage, t, textDirection, type SupportedLanguage } from "../core/localization";
import { calculateTodayAndTomorrow } from "../core/engine";
import { civilDateFromDate, formatClock, zonedMidnight } from "../core/timeZone";
import { currentPrayer, ishraq, longCountdown, nextPrayer, orderedTimes, shortCountdown } from "../core/prayerTimes";
import { defaultJamaatTimes, defaultPrayerNotification, defaultSettings, resolvedNotification } from "../core/settings";
import { inferCountryCode } from "../core/systemDetection";
import { isObligatory } from "../core/types";
import type { AppSettings, CalculationMethodAdapter, Coordinates, NotificationSound, Prayer, PrayerNotificationConfig, PrayerTimes } from "../core/types";

type Tab = "general" | "location" | "calculation" | "notifications" | "focus";
type RuntimeScheduledEvent = {
  id: string;
  prayer?: Prayer;
  atMs: number;
  title: string;
  body: string;
  playSound: boolean;
  sound?: NotificationSound;
  playFullAdhan: boolean;
  startFocus: boolean;
};

const prayerIcons: Record<Prayer, typeof Sunrise> = {
  fajr: Sunrise,
  sunrise: Sunrise,
  dhuhr: Sun,
  asr: Sparkles,
  maghrib: Sunset,
  isha: Moon,
};

const prayerNames: Record<Prayer, string> = {
  fajr: "Fajr",
  sunrise: "Sunrise",
  dhuhr: "Dhuhr",
  asr: "Asr",
  maghrib: "Maghrib",
  isha: "Isha",
};

export function App() {
  const isWidget = new URLSearchParams(window.location.search).get("widget") === "true";
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [storeReady, setStoreReady] = useState(false);
  const [tab, setTab] = useState<Tab>("calculation");
  const [panelOpen, setPanelOpen] = useState(true);
  const [focusPreview, setFocusPreview] = useState(false);
  const [focusPrayer, setFocusPrayer] = useState<Prayer>("dhuhr");
  const [nativeSchedulerAvailable, setNativeSchedulerAvailable] = useState(true);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string | undefined>();
  const [now, setNow] = useState(() => new Date());
  const [audioPlaying, setAudioPlaying] = useState(false);
  const firedAlerts = useRef(new Set<string>());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timeZone = settings.timeZoneMode.kind === "explicit"
    ? settings.timeZoneMode.identifier
    : Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const language = resolveLanguage(settings.languageOverride);
  const detectedCountryCode = inferCountryCode(timeZone);
  const resolvedMethodId = settings.autoDetectMethod ? methodIdForCountryCode(detectedCountryCode) : settings.methodId;
  const method = useMemo(
    () => resolveMethod(resolvedMethodId, settings.hanafiAsr, settings.manualParameters) ?? MWLAdapter,
    [resolvedMethodId, settings.hanafiAsr, settings.manualParameters],
  );
  const coordinates = settings.manualCoordinates;

  useEffect(() => {
    let timer: number | undefined;
    const refresh = () => {
      setNow(new Date());
      timer = window.setTimeout(refresh, nextClockRefreshDelay(isWidget));
    };
    const refreshAfterVisibilityChange = () => {
      setNow(new Date());
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(refresh, nextClockRefreshDelay(isWidget));
    };
    document.addEventListener("visibilitychange", refreshAfterVisibilityChange);
    timer = window.setTimeout(refresh, nextClockRefreshDelay(isWidget));
    return () => {
      document.removeEventListener("visibilitychange", refreshAfterVisibilityChange);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [isWidget]);

  useEffect(() => {
    let cancelled = false;
    loadPersistedSettings().then((persisted) => {
      if (cancelled) return;
      if (persisted) setSettings(persisted);
      setStoreReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    void saveSettings(settings, storeReady);
  }, [settings, storeReady]);

  useEffect(() => {
    document.body.classList.toggle("widget-body", isWidget);
    document.body.dir = textDirection(language);
    document.documentElement.lang = language;
    return () => document.body.classList.remove("widget-body");
  }, [isWidget, language]);

  const updateSettings = (patch: Partial<AppSettings>) => setSettings((current) => ({ ...current, ...patch }));

  const playNotificationSound = async (sound: NotificationSound, playFullAdhan: boolean) => {
    const url = soundUrl(sound, playFullAdhan);
    if (!url) return;
    audioRef.current?.pause();
    const audio = new Audio(url);
    audioRef.current = audio;
    setAudioPlaying(true);
    audio.onended = () => setAudioPlaying(false);
    audio.onerror = () => setAudioPlaying(false);
    try {
      await audio.play();
    } catch {
      setAudioPlaying(false);
    }
  };

  const stopAudio = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    setAudioPlaying(false);
  };

  const checkForAppUpdate = async (manual = false) => {
    if (updateBusy) return;
    setUpdateBusy(true);
    if (manual) setUpdateStatus("Checking for updates...");
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();
      if (!update) {
        setUpdateStatus(manual ? "You already have the latest version." : undefined);
        return;
      }
      const approved = window.confirm(`Version ${update.version} is available. Download and install it now?`);
      if (!approved) {
        setUpdateStatus(`Update ${update.version} is available.`);
        return;
      }
      setUpdateStatus(`Downloading ${update.version}...`);
      await update.downloadAndInstall();
      setUpdateStatus(`Update ${update.version} installed. Restart the app if it does not relaunch automatically.`);
    } catch {
      setUpdateStatus(manual ? "Unable to check for updates right now." : undefined);
    } finally {
      setUpdateBusy(false);
    }
  };

  const beginFocusMode = async (prayer: Prayer = clock.next?.prayer ?? "dhuhr") => {
    setFocusPrayer(prayer);
    await startNativeFocusMode();
    setFocusPreview(true);
  };

  const endFocusMode = async () => {
    setFocusPreview(false);
    await endNativeFocusMode();
  };

  const clock = useMemo(
    () => buildPrayerClock(now, settings, method, coordinates, timeZone),
    [coordinates, method, now, settings, timeZone],
  );
  const runtimeSchedule = useMemo(
    () => buildRuntimeSchedule(clock.today, clock.tomorrow, settings, timeZone, language),
    [clock.today.date.getTime(), clock.tomorrow.date.getTime(), language, settings, timeZone],
  );

  const secondsUntilNext = clock.next ? Math.max(0, (clock.next.time.getTime() - now.getTime()) / 1000) : 0;
  const activePrayer = settings.menuBarCountdownMode === "currentWaqt"
    ? currentPrayer(clock.today, now)?.prayer ?? clock.next?.prayer
    : clock.next?.prayer;
  const currentPrayerTimeLabel = clock.next ? formatClock(clock.next.time, timeZone, language) : "--:--";
  const trayLabel = buildTrayLabel(
    language,
    settings.menuBarStyle,
    settings.menuBarCountdownMode,
    activePrayer,
    secondsUntilNext,
    currentPrayerTimeLabel,
    shortCountdown(secondsUntilNext),
  );
  const hijriDate = settings.showHijriDate ? formatHijriDateLocalized(now, settings.hijriDayAdjustment, timeZone, language) : undefined;

  useEffect(() => {
    if (!storeReady || isWidget) return;
    void setWidgetVisibility(settings.showPrayerWidget);
  }, [isWidget, settings.showPrayerWidget, storeReady]);

  useEffect(() => {
    if (!storeReady || isWidget || !settings.autoUpdateEnabled) return;
    const id = window.setTimeout(() => void checkForAppUpdate(false), 4_000);
    return () => window.clearTimeout(id);
  }, [isWidget, settings.autoUpdateEnabled, storeReady]);

  useEffect(() => {
    if (isWidget) return;
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    const attach = async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        unlisten = await listen<RuntimeScheduledEvent>("prayer-runtime-event", async (event) => {
          const payload = event.payload;
          if (payload.playSound && payload.sound) {
            await playNotificationSound(payload.sound, payload.playFullAdhan);
          }
          if (payload.startFocus && payload.prayer) {
            await beginFocusMode(payload.prayer);
          }
        });
      } catch {
        if (!cancelled) setNativeSchedulerAvailable(false);
      }
    };

    void attach();
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [isWidget]);

  useEffect(() => {
    if (!storeReady || isWidget) return;
    let cancelled = false;

    const syncSchedule = async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("sync_runtime_schedule_command", { payload: { events: runtimeSchedule } });
        if (!cancelled) setNativeSchedulerAvailable(true);
      } catch {
        if (!cancelled) setNativeSchedulerAvailable(false);
      }
    };

    void syncSchedule();
    return () => {
      cancelled = true;
    };
  }, [isWidget, runtimeSchedule, storeReady]);

  useEffect(() => {
    if (isWidget || nativeSchedulerAvailable) return;
    let cancelled = false;
    let timer: number | undefined;

    const checkAlerts = async () => {
      const currentNow = new Date();
      const currentClock = buildPrayerClock(currentNow, settings, method, coordinates, timeZone);
      await fireDueAlerts({
        now: currentNow,
        today: currentClock.today,
        tomorrow: currentClock.tomorrow,
        settings,
        timeZone,
        fired: firedAlerts.current,
        playSound: playNotificationSound,
        showFocus: async (prayer) => {
          if (shouldFocus(settings, prayer)) await beginFocusMode(prayer);
        },
      });
      if (!cancelled) {
        timer = window.setTimeout(
          checkAlerts,
          nextAlertCheckDelay(currentNow, currentClock.today, currentClock.tomorrow, settings, timeZone, firedAlerts.current),
        );
      }
    };

    void checkAlerts();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [coordinates, isWidget, method, nativeSchedulerAvailable, settings, timeZone]);

  if (isWidget) {
    return (
      <PrayerWidget
        next={clock.next}
        secondsUntilNext={secondsUntilNext}
        timeZone={timeZone}
        hijriDate={hijriDate}
        language={language}
      />
    );
  }

  return (
    <div className="desktop-shell">
      <div className="taskbar">
        <div className="taskbar-left">
          <span className="win-dot" />
          <span>{t(language, "appTitle")}</span>
        </div>
        <button className={`tray-pill ${panelOpen ? "active" : ""}`} onClick={() => setPanelOpen((open) => !open)}>
          <Moon size={16} />
          <span>{trayLabel}</span>
        </button>
        <div className="taskbar-clock">
          <span>{formatClock(now, timeZone, language)}</span>
          <span>{new Intl.DateTimeFormat(language, { weekday: "short", month: "short", day: "numeric" }).format(now)}</span>
        </div>
      </div>

      <main className="workspace">
        <section className="settings-window">
          <header className="window-titlebar">
            <span className="window-title">{tabTitle(tab, language)}</span>
          </header>
          <nav className="tabbar">
            <TabButton tab="general" active={tab} setTab={setTab} icon={SettingsIcon} label={t(language, "general")} />
            <TabButton tab="location" active={tab} setTab={setTab} icon={LocateFixed} label={t(language, "locationTime")} />
            <TabButton tab="calculation" active={tab} setTab={setTab} icon={Moon} label={t(language, "calculation")} />
            <TabButton tab="notifications" active={tab} setTab={setTab} icon={Bell} label={t(language, "notifications")} />
            <TabButton tab="focus" active={tab} setTab={setTab} icon={EyeOff} label={t(language, "focusMode")} />
          </nav>
          <div className="settings-content">
            {tab === "general" && <GeneralTab settings={settings} update={updateSettings} language={language} onCheckUpdates={() => void checkForAppUpdate(true)} updateBusy={updateBusy} updateStatus={updateStatus} />}
            {tab === "location" && <LocationTab settings={settings} update={updateSettings} coordinates={coordinates} timeZone={timeZone} language={language} detectedCountryCode={detectedCountryCode} />}
            {tab === "calculation" && <CalculationTab settings={settings} update={updateSettings} language={language} detectedCountryCode={detectedCountryCode} resolvedMethodId={resolvedMethodId} />}
            {tab === "notifications" && <NotificationsTab settings={settings} update={updateSettings} language={language} />}
            {tab === "focus" && <FocusTab settings={settings} update={updateSettings} language={language} onPreview={() => beginFocusMode(clock.next?.prayer)} />}
          </div>
        </section>

        {panelOpen && (
          <PrayerPanel
            now={now}
            language={language}
            timeZone={timeZone}
            methodName={method.displayName}
            coordinates={coordinates}
            hijriDate={hijriDate}
            next={clock.next}
            secondsUntilNext={secondsUntilNext}
            today={clock.today}
            showIshraq={settings.showIshraqTime}
            audioPlaying={audioPlaying}
            onFocusNow={() => beginFocusMode(clock.next?.prayer)}
            onStopAudio={stopAudio}
          />
        )}
      </main>
      {!settings.didCompleteOnboarding && <Onboarding settings={settings} update={updateSettings} language={language} />}
      {focusPreview && <FocusPreview settings={settings} prayer={focusPrayer} onDone={endFocusMode} language={language} />}
    </div>
  );
}

function PrayerPanel({
  now,
  language,
  timeZone,
  methodName,
  coordinates,
  hijriDate,
  next,
  secondsUntilNext,
  today,
  showIshraq,
  audioPlaying,
  onFocusNow,
  onStopAudio,
}: {
  now: Date;
  language: SupportedLanguage;
  timeZone: string;
  methodName: string;
  coordinates: Coordinates;
  hijriDate?: string;
  next?: { prayer: Prayer; time: Date };
  secondsUntilNext: number;
  today: ReturnType<typeof calculateTodayAndTomorrow>["today"];
  showIshraq: boolean;
  audioPlaying: boolean;
  onFocusNow: () => void;
  onStopAudio: () => void;
}) {
  const rows = orderedTimes(today);
  const ishraqTime = showIshraq ? ishraq(today) : undefined;

  return (
    <aside className="panel">
      <header className="panel-header">
        <div className="muted-row">
          <MapPin size={14} />
          <span>{coordinates.latitude.toFixed(4)}, {coordinates.longitude.toFixed(4)}</span>
        </div>
        {hijriDate && <div className="hijri">{hijriDate}</div>}
        {next && (
          <div className="next-block">
            <div>
              <span className="eyebrow">{t(language, "next")} · {prayerLabel(language, next.prayer)}</span>
              <strong>{formatClock(next.time, timeZone, language)}</strong>
            </div>
            <span className="countdown">{longCountdown(secondsUntilNext)}</span>
          </div>
        )}
        <div className="progress"><span style={{ width: "58%" }} /></div>
      </header>

      <div className="panel-list">
        {rows.map((entry) => (
          <PrayerRow key={entry.prayer} entry={entry} now={now} next={next} timeZone={timeZone} language={language} />
        ))}
        {ishraqTime && (
          <PrayerRow entry={{ prayer: "sunrise", time: ishraqTime }} now={now} next={next} timeZone={timeZone} language={language} label="Ishraq" minor />
        )}
      </div>

      <footer className="panel-footer">
        <button onClick={onFocusNow}><EyeOff size={15} /> {t(language, "focusNow")}</button>
        {audioPlaying && <button onClick={onStopAudio}><Volume2 size={15} /> {t(language, "stop")}</button>}
        <button className="accent"><Settings size={15} /> {t(language, "settings")}</button>
        <button onClick={quitDesktop}><Power size={15} /> {t(language, "quit")}</button>
      </footer>

      <div className="panel-summary">
        <span>{methodName}</span>
        <span>{timeZone}</span>
      </div>
    </aside>
  );
}

function PrayerRow({
  entry,
  now,
  next,
  timeZone,
  language,
  label,
  minor = false,
}: {
  entry: { prayer: Prayer; time: Date };
  now: Date;
  next?: { prayer: Prayer; time: Date };
  timeZone: string;
  language: SupportedLanguage;
  label?: string;
  minor?: boolean;
}) {
  const isNext = next?.prayer === entry.prayer && next.time.getTime() === entry.time.getTime();
  const isPast = !isNext && entry.time < now;
  const Icon = prayerIcons[entry.prayer];
  return (
    <div className={`prayer-row ${isNext ? "next" : ""} ${isPast ? "past" : ""} ${minor ? "minor" : ""}`}>
      <Icon size={17} />
      <span>{label ?? prayerLabel(language, entry.prayer)}</span>
      {isNext && <em>{shortCountdown((entry.time.getTime() - now.getTime()) / 1000)}</em>}
      <strong>{formatClock(entry.time, timeZone, language)}</strong>
    </div>
  );
}

function PrayerWidget({
  next,
  secondsUntilNext,
  timeZone,
  hijriDate,
  language,
}: {
  next?: { prayer: Prayer; time: Date };
  secondsUntilNext: number;
  timeZone: string;
  hijriDate?: string;
  language: SupportedLanguage;
}) {
  const prayer = next?.prayer ?? "dhuhr";
  const Icon = prayerIcons[prayer];
  const startDrag = () => void startWidgetDrag();
  return (
    <main className="prayer-widget" onPointerDown={startDrag}>
      <div className="widget-grip"><GripHorizontal size={15} /></div>
      <button className="widget-close" onPointerDown={(event) => event.stopPropagation()} onClick={() => setWidgetVisibility(false)} title={t(language, "desktopWidget")}><X size={14} /></button>
      <section>
        <div className="widget-icon"><Icon size={22} /></div>
        <div className="widget-copy">
          <span>{t(language, "nextPrayer")}</span>
          <strong>{prayerLabel(language, prayer)}</strong>
        </div>
      </section>
      <aside>
        <strong>{next ? formatClock(next.time, timeZone, language) : "--:--"}</strong>
        <span>{next ? longCountdown(secondsUntilNext) : t(language, "waiting")}</span>
        {hijriDate && <em>{hijriDate}</em>}
      </aside>
    </main>
  );
}

function GeneralTab({
  settings,
  update,
  language,
  onCheckUpdates,
  updateBusy,
  updateStatus,
}: SettingsTabProps & { language: SupportedLanguage; onCheckUpdates: () => void; updateBusy: boolean; updateStatus?: string }) {
  const toggleLaunchAtLogin = async () => {
    const next = !settings.launchAtLogin;
    update({ launchAtLogin: next });
    await setLaunchAtLogin(next);
  };
  const togglePrayerWidget = async () => {
    const next = !settings.showPrayerWidget;
    update({ showPrayerWidget: next });
    await setWidgetVisibility(next);
  };

  return (
    <>
      <Section title={t(language, "startup")}><SettingRow label={t(language, "launchAtLogin")} control={<Switch on={settings.launchAtLogin} onClick={toggleLaunchAtLogin} />} /></Section>
      <Section title={t(language, "desktopWidget")}>
        <SettingRow label={t(language, "showFloatingWidget")} subLabel={t(language, "widgetDescription")} control={<Switch on={settings.showPrayerWidget} onClick={togglePrayerWidget} />} />
        <SettingRow label={t(language, "widgetControls")} subLabel={t(language, "widgetControlsHelp")} control={<button className="small-button" onClick={() => setWidgetVisibility(true)}><Pin size={15} /> {t(language, "showNow")}</button>} />
      </Section>
      <Section title={t(language, "menuBar")}>
        <SettingRow label={t(language, "labelStyle")} control={<NativeSelect value={settings.menuBarStyle} onChange={(menuBarStyle) => update({ menuBarStyle })} options={[
          ["iconOnly", t(language, "iconOnly")],
          ["countdownOnly", t(language, "countdownOnly")],
          ["iconCountdown", t(language, "iconCountdown")],
          ["nextPrayerCountdown", t(language, "nextPrayerCountdown")],
          ["iconNameCountdown", t(language, "iconNameCountdown")],
          ["nextPrayerClock", t(language, "nextPrayerClock")],
          ["iconNameClock", t(language, "iconNameClock")],
        ]} />} />
        <SettingRow label={t(language, "countdownShows")} control={<NativeSelect value={settings.menuBarCountdownMode} onChange={(menuBarCountdownMode) => update({ menuBarCountdownMode })} options={[["nextPrayer", t(language, "nextPrayer")], ["currentWaqt", t(language, "currentWaqt")]]} />} />
      </Section>
      <Section title={t(language, "panel")}>
        <SettingRow label={t(language, "showIshraqTime")} control={<Switch on={settings.showIshraqTime} onClick={() => update({ showIshraqTime: !settings.showIshraqTime })} />} />
        <SettingRow label={t(language, "showHijriDate")} control={<Switch on={settings.showHijriDate} onClick={() => update({ showHijriDate: !settings.showHijriDate })} />} />
        <SettingRow label={t(language, "hijriAdjustment")} subLabel={t(language, "hijriAdjustmentHelp")} control={<NumberInput value={settings.hijriDayAdjustment} onChange={(hijriDayAdjustment) => update({ hijriDayAdjustment })} />} />
      </Section>
      <Section title={t(language, "language")}><SettingRow label={t(language, "language")} control={<NativeSelect value={settings.languageOverride ?? "system"} onChange={(code) => update({ languageOverride: code === "system" ? undefined : code })} options={[["system", t(language, "followSystem")], ["en", "English"], ["ar", "Arabic"], ["tr", "Turkish"], ["bn", "Bengali"]]} />} /></Section>
      <Section title="Updates">
        <SettingRow label="Check automatically" subLabel={updateStatus} control={<Switch on={settings.autoUpdateEnabled} onClick={() => update({ autoUpdateEnabled: !settings.autoUpdateEnabled })} />} />
        <SettingRow label="Check now" control={<button className="small-button" onClick={onCheckUpdates} disabled={updateBusy}>{updateBusy ? "Checking..." : "Check for updates"}</button>} />
      </Section>
    </>
  );
}

function LocationTab({ settings, update, coordinates, timeZone, language, detectedCountryCode }: SettingsTabProps & { coordinates: { latitude: number; longitude: number; elevation?: number }; timeZone: string; language: SupportedLanguage; detectedCountryCode?: string }) {
  const [detecting, setDetecting] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const setCoordinate = (key: "latitude" | "longitude" | "elevation", value: number) => {
    update({ manualCoordinates: { ...settings.manualCoordinates, [key]: value } });
  };
  const detectLocation = async () => {
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError(t(language, "locationUnavailable"));
      return;
    }
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        update({
          locationMode: "automatic",
          manualCoordinates: {
            latitude: Number(position.coords.latitude.toFixed(6)),
            longitude: Number(position.coords.longitude.toFixed(6)),
            elevation: position.coords.altitude ? Math.round(position.coords.altitude) : settings.manualCoordinates.elevation,
          },
        });
        setDetecting(false);
      },
      (error) => {
        setLocationError(error.message || t(language, "couldNotDetectLocation"));
        setDetecting(false);
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 10 * 60_000 },
    );
  };

  return (
    <>
      <Section title={t(language, "location")}>
        <SettingRow label={t(language, "mode")} control={<Segmented values={[t(language, "automatic"), t(language, "manual")]} active={settings.locationMode === "automatic" ? t(language, "automatic") : t(language, "manual")} onPick={(value) => update({ locationMode: value === t(language, "automatic") ? "automatic" : "manual" })} />} />
        <SettingRow label={t(language, "detectMyLocation")} subLabel={locationError ?? undefined} control={<button className="small-button" onClick={detectLocation} disabled={detecting}><LocateFixed size={15} /> {detecting ? t(language, "detecting") : t(language, "detect")}</button>} />
        <SettingRow label={t(language, "latitude")} control={<NumberInput value={coordinates.latitude} onChange={(value) => setCoordinate("latitude", value)} />} />
        <SettingRow label={t(language, "longitude")} control={<NumberInput value={coordinates.longitude} onChange={(value) => setCoordinate("longitude", value)} />} />
        <SettingRow label={t(language, "elevationMeters")} control={<NumberInput value={coordinates.elevation ?? 0} onChange={(value) => setCoordinate("elevation", value)} />} />
        {detectedCountryCode && <SettingRow label={t(language, "detectedCountry")} control={<span className="value">{detectedCountryCode}</span>} />}
      </Section>
      <Section title={t(language, "masterTimezone")}>
        <SettingRow label={t(language, "timezone")} control={<Segmented values={[t(language, "followSystemTimezone"), t(language, "pickExplicitly")]} active={settings.timeZoneMode.kind === "system" ? t(language, "followSystemTimezone") : t(language, "pickExplicitly")} onPick={(value) => update({ timeZoneMode: value === t(language, "followSystemTimezone") ? { kind: "system" } : { kind: "explicit", identifier: timeZone } })} />} />
        <SettingRow label={t(language, "resolved")} control={<span className="value">{timeZone}</span>} />
      </Section>
    </>
  );
}

function CalculationTab({ settings, update, language, detectedCountryCode, resolvedMethodId }: SettingsTabProps & { language: SupportedLanguage; detectedCountryCode?: string; resolvedMethodId: string }) {
  const setManualTime = (prayer: Prayer, minutes: number) => {
    update({
      calculationMode: "manual",
      jamaatTimes: { ...settings.jamaatTimes, [prayer]: minutes },
    });
  };

  return (
    <>
      <Section title={t(language, "source")}>
        <SettingRow label={t(language, "timeSource")} control={<Segmented values={[t(language, "calculated"), t(language, "manualFixed")]} active={settings.calculationMode === "calculated" ? t(language, "calculated") : t(language, "manualFixed")} onPick={(value) => update({ calculationMode: value === t(language, "calculated") ? "calculated" : "manual" })} />} />
      </Section>
      {settings.calculationMode === "calculated" && <>
        <Section title={t(language, "method")}>
          <SettingRow label={t(language, "calculationMethod")} control={<NativeSelect value={settings.autoDetectMethod ? resolvedMethodId : settings.methodId} onChange={(methodId) => update({ methodId, autoDetectMethod: false })} options={builtInMethods.map((method) => [method.id, method.displayName])} />} />
          <SettingRow label={t(language, "asrMadhab")} control={<NativeSelect value={settings.hanafiAsr ? "hanafi" : "standard"} onChange={(value) => update({ hanafiAsr: value === "hanafi" })} options={[["standard", t(language, "standard")], ["hanafi", t(language, "hanafi")]]} />} />
          <SettingRow label={t(language, "highLatitudeRule")} control={<NativeSelect value={settings.highLatitudeRule} onChange={(highLatitudeRule) => update({ highLatitudeRule })} options={[["automatic", t(language, "automaticRecommended")], ["none", t(language, "none")], ["middleOfNight", t(language, "middleOfNight")], ["seventhOfNight", t(language, "oneSeventh")], ["angleBased", t(language, "angleBased")]]} />} />
        </Section>
        <Section title={t(language, "automation")}>
          <SettingRow label={t(language, "autoDetectMethod")} control={<Switch on={settings.autoDetectMethod} onClick={() => update({ autoDetectMethod: !settings.autoDetectMethod })} />} />
          {settings.autoDetectMethod && <SettingRow label={t(language, "detectedMethod")} subLabel={t(language, "methodHint", { country: detectedCountryCode ?? t(language, "systemDetected") })} control={<span className="value">{resolveMethod(resolvedMethodId, settings.hanafiAsr, settings.manualParameters)?.displayName ?? MWLAdapter.displayName}</span>} />}
        </Section>
      </>}
      <Section title={t(language, "manualFixedSchedule")}>
        <SettingRow
          label={t(language, "status")}
          subLabel={t(language, "manualScheduleHelp")}
          control={settings.calculationMode === "manual"
            ? <span className="status-pill on">{t(language, "active")}</span>
            : <button className="small-button" onClick={() => update({ calculationMode: "manual" })}>{t(language, "useManualSchedule")}</button>}
        />
        <SettingRow label={t(language, "adhanBeforeJamaat")} control={<NumberInput value={settings.azanBeforeJamaat} onChange={(azanBeforeJamaat) => update({ calculationMode: "manual", azanBeforeJamaat })} />} />
        <SettingRow label={t(language, "blockScreenAtPrayerTime")} subLabel={t(language, "blockScreenHelp")} control={<Switch on={settings.focusModeEnabled} onClick={() => update({ focusModeEnabled: !settings.focusModeEnabled })} />} />
        {(["fajr", "dhuhr", "asr", "maghrib", "isha"] as Prayer[]).map((prayer) => (
          <SettingRow key={prayer} label={prayerLabel(language, prayer)} control={<TimeInput value={settings.jamaatTimes[prayer] ?? defaultJamaatTimes[prayer] ?? 0} onChange={(minutes) => setManualTime(prayer, minutes)} />} />
        ))}
      </Section>
    </>
  );
}

function NotificationsTab({ settings, update, language }: SettingsTabProps & { language: SupportedLanguage }) {
  const updatePrayer = (prayer: Prayer, patch: Partial<PrayerNotificationConfig>) => {
    const current = settings.notifications[prayer] ?? defaultPrayerNotification();
    update({ notifications: { ...settings.notifications, [prayer]: { ...current, ...patch } } });
  };
  const toggleReminder = (prayer: Prayer) => {
    const resolved = resolvedNotification(settings, prayer);
    const next = !resolved.earlyReminderEnabled;
    const fallbackLead = settings.notificationDefaults.earlyReminderMinutes > 0
      ? settings.notificationDefaults.earlyReminderMinutes
      : 10;
    const currentLead = settings.notifications[prayer]?.earlyLeadMinutesOverride
      ?? (settings.notificationDefaults.earlyReminderMinutes > 0 ? settings.notificationDefaults.earlyReminderMinutes : undefined);
    updatePrayer(prayer, {
      earlyReminderEnabled: next,
      earlyLeadMinutesOverride: next ? currentLead ?? fallbackLead : undefined,
    });
  };
  const previewDefaultSound = () => void playOneShot(settings.notificationDefaults.sound, settings.notificationDefaults.playFullAdhan);

  return (
    <>
      <Section title={t(language, "master")}>
        <SettingRow label={t(language, "enableNotifications")} subLabel={t(language, "notificationsHelp")} control={<Switch on={settings.masterNotificationsEnabled} onClick={() => update({ masterNotificationsEnabled: !settings.masterNotificationsEnabled })} />} />
        <SettingRow label={t(language, "sample")} control={<button className="small-button" onClick={() => sendDesktopNotification(t(language, "appTitle"), t(language, "sampleBody"))}><Bell size={15} /> {t(language, "sendSample")}</button>} />
      </Section>
      <Section title={t(language, "defaults")}>
        <SettingRow label={t(language, "defaultSound")} control={<><button className="icon-button" onClick={previewDefaultSound} title={t(language, "previewSound")}><PlayCircle size={18} /></button><NativeSelect value={settings.notificationDefaults.sound} onChange={(sound) => update({ notificationDefaults: { ...settings.notificationDefaults, sound } })} options={[["none", t(language, "none")], ["systemDefault", t(language, "defaultSoundName")], ["softChime", t(language, "softChime")], ["takbir", "Takbir"], ["adhanMakkah", t(language, "adhanMakkah")], ["adhanMadinah", t(language, "adhanMadinah")]]} /></>} />
        <SettingRow label={t(language, "playFullAdhanAudio")} control={<Switch on={settings.notificationDefaults.playFullAdhan} onClick={() => update({ notificationDefaults: { ...settings.notificationDefaults, playFullAdhan: !settings.notificationDefaults.playFullAdhan } })} />} />
        <SettingRow label={t(language, "earlyReminder")} control={<NativeSelect value={String(settings.notificationDefaults.earlyReminderMinutes)} onChange={(value) => update({ notificationDefaults: { ...settings.notificationDefaults, earlyReminderMinutes: Number(value) } })} options={[["0", t(language, "off")], ["5", t(language, "minutesBefore", { minutes: 5 })], ["10", t(language, "minutesBefore", { minutes: 10 })], ["15", t(language, "minutesBefore", { minutes: 15 })], ["30", t(language, "minutesBefore", { minutes: 30 })]]} />} />
        <SettingRow label={t(language, "iqamahReminder")} control={<NativeSelect value={String(settings.notificationDefaults.iqamahOffsetMinutes)} onChange={(value) => update({ notificationDefaults: { ...settings.notificationDefaults, iqamahOffsetMinutes: Number(value) } })} options={[["0", t(language, "off")], ["5", t(language, "minutesAfter", { minutes: 5 })], ["10", t(language, "minutesAfter", { minutes: 10 })], ["15", t(language, "minutesAfter", { minutes: 15 })], ["20", t(language, "minutesAfter", { minutes: 20 })]]} />} />
      </Section>
      <Section title={t(language, "perPrayer")}>
        <div className="matrix">
          <div className="matrix-head"><span /> <span>{t(language, "atTime")}</span><span>{t(language, "adhan")}</span><span>{t(language, "before")}</span><span /></div>
          {(["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"] as Prayer[]).map((prayer) => (
            <div className="matrix-row" key={prayer}>
              <span>{prayerLabel(language, prayer)}</span>
              <Switch on={resolvedNotification(settings, prayer).notify} small onClick={() => updatePrayer(prayer, { notify: !resolvedNotification(settings, prayer).notify })} />
              <Switch on={resolvedNotification(settings, prayer).playFullAdhan} small disabled={prayer === "sunrise"} onClick={() => updatePrayer(prayer, { playFullAdhan: !resolvedNotification(settings, prayer).playFullAdhan })} />
              <Switch on={resolvedNotification(settings, prayer).earlyReminderEnabled} small onClick={() => toggleReminder(prayer)} />
              <button className="icon-button" onClick={() => playOneShot(resolvedNotification(settings, prayer).sound, resolvedNotification(settings, prayer).playFullAdhan)} title={`${t(language, "previewSound")} ${prayerLabel(language, prayer)}`}><SlidersHorizontal size={16} /></button>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}

function FocusTab({ settings, update, language, onPreview }: SettingsTabProps & { language: SupportedLanguage; onPreview: () => void }) {
  return (
    <>
      <Section title={t(language, "focusMode")}>
        <SettingRow label={t(language, "enableFocusMode")} subLabel={t(language, "focusModeHelp")} control={<Switch on={settings.focusModeEnabled} onClick={() => update({ focusModeEnabled: !settings.focusModeEnabled })} />} />
      </Section>
      <Section title={t(language, "behaviour")}>
        <SettingRow label={t(language, "prayerDuration")} control={<NumberInput value={settings.focusDurationMinutes} onChange={(focusDurationMinutes) => update({ focusDurationMinutes })} />} />
        <SettingRow label={t(language, "blurIntensity")} control={<NativeSelect value={settings.focusBlurIntensity} onChange={(focusBlurIntensity) => update({ focusBlurIntensity })} options={[["low", t(language, "low")], ["medium", t(language, "medium")], ["high", t(language, "high")], ["opaque", t(language, "opaque")]]} />} />
        <SettingRow label={t(language, "triggerOn")} control={<NativeSelect value={settings.focusTrigger} onChange={(focusTrigger) => update({ focusTrigger })} options={[["obligatory", t(language, "obligatoryPrayers")], ["all", t(language, "allPrayerTimes")], ["fajrIsha", t(language, "fajrIshaOnly")]]} />} />
        <SettingRow label={t(language, "emergencyExit")} subLabel={t(language, "emergencyExitHelp")} control={<Switch on={settings.focusEmergencyExitEnabled} onClick={() => update({ focusEmergencyExitEnabled: !settings.focusEmergencyExitEnabled })} />} />
      </Section>
      <button className="try-focus" onClick={onPreview}><EyeOff size={16} /> {t(language, "tryItForTenSeconds")}</button>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="settings-section">
      <h2>{title}</h2>
      <div className="settings-group">{children}</div>
    </section>
  );
}

function SettingRow({ label, subLabel, control }: { label: string; subLabel?: string; control: React.ReactNode }) {
  return (
    <div className="setting-row">
      <span>
        {label}
        {subLabel && <small>{subLabel}</small>}
      </span>
      <div className="row-control">{control}</div>
    </div>
  );
}

function SelectLike({ value }: { value: string }) {
  return <button className="select-like">{value}<ChevronDown size={14} /></button>;
}

function Switch({ on = false, small = false, disabled = false, onClick }: { on?: boolean; small?: boolean; disabled?: boolean; onClick?: () => void }) {
  return <button type="button" className={`switch ${on ? "on" : ""} ${small ? "small" : ""} ${disabled ? "disabled" : ""}`} onClick={disabled ? undefined : onClick} aria-pressed={on}><i /></button>;
}

function Segmented({ values, active, onPick }: { values: string[]; active: string; onPick?: (value: string) => void }) {
  return <div className="segmented">{values.map((value) => <button key={value} onClick={() => onPick?.(value)} className={value === active ? "active" : ""}>{value}</button>)}</div>;
}

function TabButton({ tab, active, setTab, icon: Icon, label }: { tab: Tab; active: Tab; setTab: (tab: Tab) => void; icon: LucideIcon; label: string }) {
  return (
    <button className={active === tab ? "active" : ""} onClick={() => setTab(tab)}>
      <Icon size={22} />
      <span>{label}</span>
    </button>
  );
}

type SettingsTabProps = {
  settings: AppSettings;
  update: (patch: Partial<AppSettings>) => void;
};

function NativeSelect<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<[T, string]>;
  onChange: (value: T) => void;
}) {
  return (
    <select className="native-select" value={value} onChange={(event) => onChange(event.target.value as T)}>
      {options.map(([option, label]) => <option key={option} value={option}>{label}</option>)}
    </select>
  );
}

function NumberInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <input
      className="number-input"
      type="number"
      value={Number.isFinite(value) ? value : 0}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  );
}

function TimeInput({ value, onChange }: { value: number; onChange: (minutes: number) => void }) {
  const [text, setText] = useState(() => minutesToTime(value));

  useEffect(() => {
    setText(minutesToTime(value));
  }, [value]);

  const commit = (raw: string) => {
    setText(raw);
    const minutes = timeToMinutes(raw);
    if (minutes !== null) onChange(minutes);
  };

  return (
    <input
      className="time-field"
      type="time"
      step={60}
      value={text}
      onInput={(event) => commit(event.currentTarget.value)}
      onChange={(event) => commit(event.currentTarget.value)}
      onBlur={() => setText(minutesToTime(timeToMinutes(text) ?? value))}
    />
  );
}

function minutesToTime(value: number): string {
  const minutes = ((Math.round(value) % 1_440) + 1_440) % 1_440;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function timeToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(Math.max(0, totalSeconds) / 60);
  const seconds = Math.max(0, totalSeconds) % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function FocusPreview({
  settings,
  prayer,
  onDone,
  language,
}: {
  settings: AppSettings;
  prayer: Prayer;
  onDone: () => void;
  language: SupportedLanguage;
}) {
  const [remaining, setRemaining] = useState(() => Math.max(1, settings.focusDurationMinutes) * 60);

  useEffect(() => {
    if (remaining <= 0) {
      onDone();
      return;
    }
    const id = window.setTimeout(() => setRemaining((value) => value - 1), 1000);
    return () => window.clearTimeout(id);
  }, [onDone, remaining]);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (settings.focusEmergencyExitEnabled && event.key === "Escape") onDone();
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [onDone, settings.focusEmergencyExitEnabled]);

  return (
    <div className={`focus-preview ${settings.focusBlurIntensity}`}>
      <div>
        <span>{t(language, "prayerInProgress")}</span>
        <strong>{prayerLabel(language, prayer)}</strong>
        <p>{t(language, "focusPauseBody")}</p>
        <em>{formatDuration(remaining)}</em>
        {settings.focusEmergencyExitEnabled && <small>{t(language, "pressEscToExit")}</small>}
      </div>
    </div>
  );
}

function Onboarding({ settings, update, language }: SettingsTabProps & { language: SupportedLanguage }) {
  const [step, setStep] = useState(0);
  const steps = [
    {
      title: t(language, "setYourLocation"),
      body: t(language, "setLocationBody"),
      action: <button className="small-button" onClick={() => update({ locationMode: "automatic" })}><LocateFixed size={15} /> {t(language, "useAutomatic")}</button>,
    },
    {
      title: t(language, "chooseCalculation"),
      body: `The app starts with ${resolveMethod(settings.methodId, settings.hanafiAsr, settings.manualParameters)?.displayName ?? "MWL"}. You can switch to local authority methods anytime.`,
      action: <span className="value">{settings.hanafiAsr ? t(language, "hanafi") : t(language, "standard")}</span>,
    },
    {
      title: t(language, "keepPrayerAlertsOn"),
      body: t(language, "keepPrayerAlertsBody"),
      action: <Switch on={settings.masterNotificationsEnabled} onClick={() => update({ masterNotificationsEnabled: !settings.masterNotificationsEnabled })} />,
    },
  ];
  const current = steps[step];

  return (
    <div className="onboarding">
      <section>
        <span className="eyebrow">{t(language, "firstRunSetup")}</span>
        <strong>{current.title}</strong>
        <p>{current.body}</p>
        <div className="onboarding-action">{current.action}</div>
        <div className="onboarding-dots">{steps.map((_, index) => <i key={index} className={index === step ? "active" : ""} />)}</div>
        <footer>
          <button className="small-button" onClick={() => update({ didCompleteOnboarding: true })}>{t(language, "skip")}</button>
          {step > 0 && <button className="small-button" onClick={() => setStep((value) => value - 1)}>{t(language, "back")}</button>}
          <button className="small-button primary" onClick={() => step === steps.length - 1 ? update({ didCompleteOnboarding: true }) : setStep((value) => value + 1)}>
            {step === steps.length - 1 ? t(language, "finish") : t(language, "nextButton")}
          </button>
        </footer>
      </section>
    </div>
  );
}

function nextClockRefreshDelay(isWidget: boolean): number {
  const interval = isWidget || document.visibilityState === "visible" ? 1_000 : 60_000;
  const now = Date.now();
  return interval - (now % interval) + 25;
}

function buildPrayerClock(
  now: Date,
  settings: AppSettings,
  method: CalculationMethodAdapter,
  coordinates: Coordinates,
  timeZone: string,
) {
  const params = method.resolve(coordinates);
  if (settings.highLatitudeRule !== "automatic") params.highLatitudeRule = settings.highLatitudeRule;
  const { today, tomorrow } = calculateTodayAndTomorrow(now, coordinates, params, timeZone);
  const resolved = settings.calculationMode === "manual"
    ? {
        today: applyManualSchedule(today, settings, timeZone),
        tomorrow: applyManualSchedule(tomorrow, settings, timeZone),
      }
    : { today, tomorrow };
  const next = nextPrayer(resolved.today, now) ?? nextPrayer(resolved.tomorrow, now);
  return { today: resolved.today, tomorrow: resolved.tomorrow, next };
}

function applyManualSchedule(day: PrayerTimes, settings: AppSettings, timeZone: string): PrayerTimes {
  const civil = civilDateFromDate(day.date, timeZone);
  const base = zonedMidnight(civil, timeZone);
  const times = { ...day.times };
  for (const prayer of ["fajr", "dhuhr", "asr", "maghrib", "isha"] as Prayer[]) {
    const minutes = settings.jamaatTimes[prayer] ?? defaultJamaatTimes[prayer];
    if (minutes !== undefined) times[prayer] = new Date(base.getTime() + minutes * 60_000);
  }
  return { ...day, times };
}

function loadSettings(): AppSettings {
  const fallback = defaultSettings();
  try {
    const raw = localStorage.getItem("prayer-times-settings.v1");
    if (!raw) return fallback;
    return mergeSettings(JSON.parse(raw));
  } catch {
    return fallback;
  }
}

async function loadPersistedSettings(): Promise<AppSettings | null> {
  try {
    const { load } = await import("@tauri-apps/plugin-store");
    const store = await load("settings.json", { defaults: {}, autoSave: true });
    const saved = await store.get<Partial<AppSettings>>("settings");
    return saved ? mergeSettings(saved) : null;
  } catch {
    return loadSettings();
  }
}

async function saveSettings(settings: AppSettings, storeReady: boolean) {
  localStorage.setItem("prayer-times-settings.v1", JSON.stringify(settings));
  if (!storeReady) return;
  try {
    const { load } = await import("@tauri-apps/plugin-store");
    const store = await load("settings.json", { defaults: {}, autoSave: true });
    await store.set("settings", settings);
    await store.save();
  } catch {
    // Browser preview keeps localStorage persistence.
  }
}

function mergeSettings(saved: Partial<AppSettings>): AppSettings {
  const fallback = defaultSettings();
  return {
    ...fallback,
    ...saved,
    manualCoordinates: { ...fallback.manualCoordinates, ...saved.manualCoordinates },
    jamaatTimes: { ...fallback.jamaatTimes, ...saved.jamaatTimes },
    notificationDefaults: { ...fallback.notificationDefaults, ...saved.notificationDefaults },
    notifications: { ...fallback.notifications, ...saved.notifications },
    timeZoneMode: saved.timeZoneMode ?? fallback.timeZoneMode,
  };
}

async function sendDesktopNotification(title: string, body: string) {
  try {
    const notification = await import("@tauri-apps/plugin-notification");
    let allowed = await notification.isPermissionGranted();
    if (!allowed) {
      const permission = await notification.requestPermission();
      allowed = permission === "granted";
    }
    if (allowed) {
      notification.sendNotification({
        title,
        body,
      });
      return;
    }
  } catch {
    // Browser preview fallback below.
  }

  if ("Notification" in window) {
    const permission = await Notification.requestPermission();
    if (permission === "granted") new Notification(title, { body });
  }
}

async function setLaunchAtLogin(enabled: boolean) {
  try {
    const autostart = await import("@tauri-apps/plugin-autostart");
    if (enabled) await autostart.enable();
    else await autostart.disable();
  } catch {
    // Autostart is available only in the native Tauri shell.
  }
}

async function startNativeFocusMode() {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("start_focus_mode");
  } catch {
    // Browser preview uses the in-page overlay only.
  }
}

async function endNativeFocusMode() {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("end_focus_mode");
  } catch {
    // Browser preview uses the in-page overlay only.
  }
}

async function setWidgetVisibility(visible: boolean) {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke(visible ? "show_widget" : "hide_widget");
  } catch {
    // Browser preview and tests do not have a native widget window.
  }
}

async function startWidgetDrag() {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().startDragging();
  } catch {
    // Browser preview cannot drag native windows.
  }
}

function buildRuntimeSchedule(
  today: PrayerTimes,
  tomorrow: PrayerTimes,
  settings: AppSettings,
  timeZone: string,
  language: SupportedLanguage,
): RuntimeScheduledEvent[] {
  const events: RuntimeScheduledEvent[] = [];
  for (const day of [today, tomorrow]) {
    for (const entry of orderedTimes(day)) {
      const cfg = resolvedNotification(settings, entry.prayer);
      const label = prayerLabel(language, entry.prayer);
      const civil = civilDateFromDate(entry.time, timeZone);
      const dayKey = `${civil.year}-${civil.month}-${civil.day}`;
      if (settings.masterNotificationsEnabled && cfg.notify) {
        events.push({
          id: `${dayKey}:${entry.prayer}:adhan`,
          prayer: entry.prayer,
          atMs: notificationTime(entry.prayer, entry.time, settings).getTime(),
          title: `${label} time`,
          body: `${label} is now at ${formatClock(entry.time, timeZone, language)}.`,
          playSound: true,
          sound: cfg.sound,
          playFullAdhan: cfg.playFullAdhan,
          startFocus: false,
        });
        if (cfg.earlyReminderEnabled) {
          events.push({
            id: `${dayKey}:${entry.prayer}:early`,
            prayer: entry.prayer,
            atMs: entry.time.getTime() - cfg.earlyLeadMinutes * 60_000,
            title: `${label} soon`,
            body: `${label} starts in ${cfg.earlyLeadMinutes} minutes.`,
            playSound: false,
            sound: undefined,
            playFullAdhan: false,
            startFocus: false,
          });
        }
        if (isObligatory(entry.prayer) && cfg.iqamahOffsetMinutes > 0) {
          events.push({
            id: `${dayKey}:${entry.prayer}:iqamah`,
            prayer: entry.prayer,
            atMs: entry.time.getTime() + cfg.iqamahOffsetMinutes * 60_000,
            title: `${label} iqamah`,
            body: `${label} iqamah reminder.`,
            playSound: false,
            sound: undefined,
            playFullAdhan: false,
            startFocus: false,
          });
        }
      }
      if (shouldFocus(settings, entry.prayer)) {
        events.push({
          id: `${dayKey}:${entry.prayer}:focus`,
          prayer: entry.prayer,
          atMs: entry.time.getTime(),
          title: `${label} focus`,
          body: `${label} is in progress.`,
          playSound: false,
          sound: undefined,
          playFullAdhan: false,
          startFocus: true,
        });
      }
    }
  }
  return events;
}

async function fireDueAlerts({
  now,
  today,
  tomorrow,
  settings,
  timeZone,
  fired,
  playSound,
  showFocus,
}: {
  now: Date;
  today: PrayerTimes;
  tomorrow: PrayerTimes;
  settings: AppSettings;
  timeZone: string;
  fired: Set<string>;
  playSound: (sound: NotificationSound, playFullAdhan: boolean) => Promise<void>;
  showFocus: (prayer: Prayer) => Promise<void>;
}) {
  const notificationWindowMs = 1_150;
  const focusGraceMs = 60_000;
  for (const day of [today, tomorrow]) {
    for (const entry of orderedTimes(day)) {
      const cfg = resolvedNotification(settings, entry.prayer);
      const label = prayerNames[entry.prayer];
      const civil = civilDateFromDate(entry.time, timeZone);
      const dayKey = `${civil.year}-${civil.month}-${civil.day}`;
      const events: Array<{ kind: string; at: Date; title: string; body: string; sound: boolean }> = [
        { kind: "adhan", at: notificationTime(entry.prayer, entry.time, settings), title: `${label} time`, body: `${label} is now at ${formatClock(entry.time, timeZone)}.`, sound: true },
      ];
      if (cfg.earlyReminderEnabled) {
        events.push({ kind: "early", at: new Date(entry.time.getTime() - cfg.earlyLeadMinutes * 60_000), title: `${label} soon`, body: `${label} starts in ${cfg.earlyLeadMinutes} minutes.`, sound: false });
      }
      if (isObligatory(entry.prayer) && cfg.iqamahOffsetMinutes > 0) {
        events.push({ kind: "iqamah", at: new Date(entry.time.getTime() + cfg.iqamahOffsetMinutes * 60_000), title: `${label} iqamah`, body: `${label} iqamah reminder.`, sound: false });
      }
      for (const event of events) {
        const key = `${dayKey}:${entry.prayer}:${event.kind}`;
        if (fired.has(key)) continue;
        if (settings.masterNotificationsEnabled && cfg.notify && Math.abs(now.getTime() - event.at.getTime()) <= notificationWindowMs) {
          fired.add(key);
          await sendDesktopNotification(event.title, event.body);
          if (event.sound) await playSound(cfg.sound, cfg.playFullAdhan);
        }
      }

      const focusKey = `${dayKey}:${entry.prayer}:focus`;
      const focusDelayMs = now.getTime() - entry.time.getTime();
      if (!fired.has(focusKey) && shouldFocus(settings, entry.prayer) && focusDelayMs >= 0 && focusDelayMs <= focusGraceMs) {
        fired.add(focusKey);
        await showFocus(entry.prayer);
      }
    }
  }
}

function nextAlertCheckDelay(
  now: Date,
  today: PrayerTimes,
  tomorrow: PrayerTimes,
  settings: AppSettings,
  timeZone: string,
  fired: Set<string>,
): number {
  const upcoming: number[] = [];
  for (const day of [today, tomorrow]) {
    for (const entry of orderedTimes(day)) {
      const civil = civilDateFromDate(entry.time, timeZone);
      const dayKey = `${civil.year}-${civil.month}-${civil.day}`;
      const cfg = resolvedNotification(settings, entry.prayer);
      if (settings.masterNotificationsEnabled && cfg.notify) {
        addPendingAlertTime(upcoming, fired, `${dayKey}:${entry.prayer}:adhan`, notificationTime(entry.prayer, entry.time, settings));
        if (cfg.earlyReminderEnabled) {
          addPendingAlertTime(upcoming, fired, `${dayKey}:${entry.prayer}:early`, new Date(entry.time.getTime() - cfg.earlyLeadMinutes * 60_000));
        }
        if (isObligatory(entry.prayer) && cfg.iqamahOffsetMinutes > 0) {
          addPendingAlertTime(upcoming, fired, `${dayKey}:${entry.prayer}:iqamah`, new Date(entry.time.getTime() + cfg.iqamahOffsetMinutes * 60_000));
        }
      }
      if (shouldFocus(settings, entry.prayer)) {
        addPendingAlertTime(upcoming, fired, `${dayKey}:${entry.prayer}:focus`, entry.time);
      }
    }
  }

  const next = upcoming
    .filter((time) => time > now.getTime() + 50)
    .sort((a, b) => a - b)[0];
  if (!next) return 60_000;
  return Math.min(60_000, Math.max(250, next - now.getTime() - 500));
}

function addPendingAlertTime(upcoming: number[], fired: Set<string>, key: string, at: Date) {
  if (!fired.has(key)) upcoming.push(at.getTime());
}

function notificationTime(prayer: Prayer, time: Date, settings: AppSettings): Date {
  if (settings.calculationMode === "manual" && isObligatory(prayer)) {
    return new Date(time.getTime() - Math.max(0, settings.azanBeforeJamaat) * 60_000);
  }
  return time;
}

function shouldFocus(settings: AppSettings, prayer: Prayer): boolean {
  if (!settings.focusModeEnabled) return false;
  if (settings.focusTrigger === "all") return true;
  if (settings.focusTrigger === "fajrIsha") return prayer === "fajr" || prayer === "isha";
  return isObligatory(prayer);
}

function soundUrl(sound: NotificationSound, playFullAdhan: boolean): string | null {
  if (sound === "none" || sound === "systemDefault") return null;
  if (playFullAdhan && sound === "adhanMadinah") return "/audio/adhan-madinah.m4a";
  if (playFullAdhan && sound === "adhanMakkah") return "/audio/adhan-makkah.m4a";
  switch (sound) {
    case "adhanMadinah": return "/audio/adhan-madinah.m4a";
    case "adhanMakkah": return "/audio/adhan-makkah.m4a";
    case "softChime": return "/audio/soft-chime.caf";
    case "takbir": return "/audio/takbir.caf";
    default: return null;
  }
}

async function playOneShot(sound: NotificationSound, playFullAdhan: boolean) {
  const url = soundUrl(sound, playFullAdhan);
  if (!url) return;
  try {
    await new Audio(url).play();
  } catch {
    // Some browsers block preview playback until the next direct gesture.
  }
}

async function quitDesktop() {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("quit_app");
  } catch {
    window.close();
  }
}

function tabTitle(tab: Tab, language: SupportedLanguage): string {
  switch (tab) {
    case "general": return t(language, "general");
    case "location": return t(language, "locationTime");
    case "calculation": return t(language, "calculation");
    case "notifications": return t(language, "notifications");
    case "focus": return t(language, "focusMode");
  }
}
