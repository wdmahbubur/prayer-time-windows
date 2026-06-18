# Prayer Times Windows Port Analysis

Source cloned from: https://github.com/tareq1988/prayer-times-macos.git
Local source checkout: `prayer-times-macos/`
Upstream commit inspected: `a20435b chore(release): appcast for v0.6.0`

## Goal

Build a Windows PC version with the same product behavior, visual direction, and feature set as the macOS app, adapted only where Windows platform conventions require it.

## Source App Summary

The macOS app is a native SwiftUI menu-bar agent with:

- `PrayerKit`: pure prayer-time calculation engine and models.
- `PrayerTimes`: macOS app shell, menu-bar panel, settings, onboarding, notifications, audio, location, login item, update service, and focus overlay.
- `design_handoff`: high-fidelity HTML/CSS/React reference for the redesigned settings window and menu-bar panel.
- `docs/images/screenshot.png`: current menu-bar panel visual reference.

The important implementation files are:

- `PrayerTimes/PrayerTimesApp.swift`: app composition and service wiring.
- `PrayerTimes/App/PrayerClock.swift`: live ticking, recompute, next prayer, notifications, Adhan, focus trigger.
- `PrayerTimes/App/MenuBarPanel.swift`: dropdown panel.
- `PrayerTimes/App/MenuBarLabel.swift`: compact menu-bar label.
- `PrayerTimes/Settings/*.swift`: five settings tabs.
- `PrayerTimes/Onboarding/OnboardingView.swift`: first-run wizard.
- `PrayerTimes/Services/*.swift`: notifications, audio, location, login, updates, settings persistence.
- `PrayerKit/Sources/PrayerKit`: calculation engine, adapters, models.
- `PrayerKit/Tests/PrayerKitTests`: parity tests and golden references.

## Feature Inventory To Match

Core behavior:

- Resident background app.
- Shows next prayer and live countdown.
- Click opens a compact prayer-times panel.
- Computes today and tomorrow, so "after Isha" rolls to tomorrow's Fajr.
- Recomputes on settings changes, local day rollover, timezone/location changes.
- Supports current-waqt countdown mode.
- Optional Ishraq line.
- Optional Hijri date with day adjustment.

Calculation:

- Six tracked daily events: Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha.
- Built-in methods: Diyanet, MWL, ISNA, Umm al-Qura, Egyptian, Karachi, JAKIM, Kemenag, Moonsighting, Manual.
- Hanafi Asr as a modifier, not a separate method.
- High-latitude rules: Automatic, None, Middle of Night, Seventh of Night, Angle Based.
- Manual method editor for angles, fixed Isha, horizon, Asr factor, offsets.
- Manual fixed jamaat schedule mode for the five obligatory prayers.
- Global "Adhan before jamaat" offset in manual fixed mode.

Settings:

- General: launch at login, label style, countdown mode, show Ishraq, show Hijri, language, auto-update.
- Location & Time: automatic/manual location, coordinates, elevation, timezone mode, explicit timezone, Hijri adjustment.
- Calculation: calculated/manual source, method, madhab, high-latitude rule, auto-detect method, manual parameters, fixed jamaat schedule.
- Notifications: master toggle, sample notification, default sound, full Adhan toggle, default early reminder, default iqamah offset, per-prayer matrix with overrides.
- Focus Mode: enabled, duration, blur intensity, trigger prayers, emergency exit, 10 second preview.

Notifications and audio:

- Master notification switch.
- Prayer-entry notifications.
- Per-prayer early reminders.
- Iqamah notifications in calculated mode.
- Sample notification.
- Sounds: None, System Default, Soft Chime, Takbir, Adhan Makkah, Adhan Madinah.
- Full Adhan is played in-process, separate from system notification sound.
- Stop Adhan control in panel and notification action where supported.

Location and method auto-detect:

- One-shot location request, not continuous tracking.
- Reverse geocode to country/timezone.
- Country to method mapping: TR Diyanet, US/CA ISNA, SA Umm al-Qura, EG Egyptian, PK/IN/BD/AF Karachi, MY JAKIM, ID Kemenag, Northern Europe MWL.

Onboarding:

- First-run wizard with steps: welcome, location, calculation, notifications, display, focus, done.
- Writes directly to settings.
- Can be rerun from General settings.

Focus Mode:

- Full-screen overlay on every display.
- Configurable duration and backdrop strength.
- Trigger choices: obligatory, all, Fajr and Isha only.
- Emergency exit.
- Skip when screen locked or a fullscreen app is frontmost on macOS. Windows needs equivalent safeguards.

Updates and startup:

- macOS uses Sparkle and ServiceManagement.
- Windows must replace these with Windows-native updater/startup mechanisms.

Localization:

- English, Arabic, Turkish, Bengali are present in the shipped app.
- RTL support matters for Arabic.
- Time/date/number formatting should follow selected locale and configured timezone.

## Recommended Windows Architecture

Updated implementation path: Tauri + React/TypeScript + Rust.

Why this path:

- The upstream repo already includes a React/CSS design handoff, so matching the UI is faster.
- Tauri gives us a lightweight Windows desktop shell without bundling Chromium.
- React/TypeScript lets us implement and verify the UI and calculation core immediately.
- Rust can later own tray integration, Windows toast notifications, startup, updater, and in-process Adhan playback.
- This keeps the app far lighter than Electron while still giving a modern UI workflow.

Suggested solution layout:

```text
PrayerTimes.Windows/
  src/                          # React/TypeScript UI and portable core
    core/                       # Port of PrayerKit: engine, models, adapters
    ui/                         # Tray-panel/settings/onboarding UI
  src-tauri/                    # Tauri Rust shell, added after Rust install
  assets/                       # icons, sounds, adhan
  tests/                        # additional integration tests as needed
```

Windows app components:

- `PrayerClock`: TypeScript live clock equivalent of the Swift `PrayerClock`.
- `SettingsStore`: Tauri store/JSON under `%AppData%/PrayerTimes/settings.json`.
- `TrayService`: Tauri Rust tray icon, tooltip, click handling.
- `PrayerPanel`: React popover window positioned by the Tauri shell.
- `SettingsWindow`: React five-tab settings UI.
- `OnboardingWindow`: React first-run wizard.
- `NotificationService`: Tauri/Rust Windows toast notifications.
- `AudioService`: Rust-side short clips and full Adhan playback.
- `LocationService`: Rust-side Windows one-shot geolocation plus reverse geocoding.
- `StartupService`: Tauri autostart plugin or packaged StartupTask.
- `UpdateService`: Tauri updater plugin backed by GitHub releases.
- `FocusModeService`: Tauri/Rust borderless topmost windows across monitors.

## Platform Differences To Handle

Menu-bar label:

- macOS can show dynamic text in the menu bar. Windows notification area icons generally cannot show persistent text beside the icon.
- Best Windows equivalent: tray icon with live tooltip, tray icon badge/state, and click-to-open panel.
- If exact always-visible countdown is required, add an optional compact floating pill widget pinned near the taskbar.

Notifications:

- macOS uses `UNUserNotificationCenter`.
- Windows should use toast notifications. A stable AppUserModelID and installer/package identity may be needed for polished behavior.
- Full Adhan should still play in-process, not through toast audio.

Location:

- macOS CoreLocation maps to Windows geolocation APIs or a user-triggered lookup.
- Must remain one-shot and private.

Focus Mode:

- macOS uses shield-level windows and AppKit presentation options.
- Windows should use one borderless topmost window per monitor.
- Emergency exit should use Esc or Ctrl+Esc rather than macOS Cmd+Esc.
- Fullscreen-app detection should use foreground window bounds and monitor bounds.

Updates:

- Sparkle has no Windows equivalent.
- Practical options: MSIX/AppInstaller for Windows-native packaging, or Velopack/Squirrel-style GitHub release updates.

Launch at login:

- Replace ServiceManagement with registry Run key for unpackaged app, or StartupTask for packaged app.

Icons:

- macOS SF Symbols do not exist on Windows.
- Use Fluent UI symbols, Segoe MDL2 Assets, Lucide icons, or bundled SVGs with the same semantic mapping.

## UI/UX Direction

The Windows UI should preserve the structure and visual hierarchy:

- Tray popover width around 312 px.
- Header with date/Hijri date, next prayer hero, countdown.
- Prayer list with past rows dimmed and next row highlighted.
- Footer actions: Focus now, Settings, Updates/Quit as needed.
- Settings window with five equal top tabs.
- Inset grouped sections and compact rows.
- Notifications matrix instead of long repeated blocks.
- Calculation tab switches between Calculated and Manual fixed modes.
- Onboarding uses a branded left rail and content pane.
- Focus overlay uses calm devotional full-screen treatment.

For Windows visual language:

- Prefer Windows 11 Mica/Acrylic-like materials where practical.
- Use the system accent color by default, with brand green reserved for mosque/accent details if desired.
- Keep controls dense and utility-focused, not a landing-page style UI.

## Calculation Port Requirements

Port these from Swift to TypeScript with exact behavior:

- `PrayerTimeEngine`
- `SolarCalculator`
- `HourAngleCalc`
- `DegreeMath`
- `HighLatitudeRule` and clamp logic
- `CalculationParameters`
- `Coordinates`
- `PrayerTimes`
- `CurrentWaqt`
- All adapters and country mapping
- Manual fixed schedule overlay

Tests to port first:

- Adapter constant tests.
- Raleigh MWL reference test.
- Chronological ordering and local-day tests.
- Hanafi Asr later than standard.
- Umm al-Qura fixed Isha = Maghrib + 90 minutes.
- Diyanet ihtiyat offsets.
- Manual offsets.
- High-latitude Oslo/Krakow tests.
- JAKIM and Kemenag golden table tests.
- Settings JSON round-trip and default notification tests.

This was milestone 1. The UI should not be trusted until the TypeScript engine matches the Swift tests.

## Milestones

1. Clone and analysis: complete.
2. Create Windows app scaffold and port `PrayerKit` core: complete.
3. Port and pass calculation/model tests: complete.
4. Build resident tray shell with live next prayer and panel: complete.
5. Implement settings persistence and five settings tabs: complete.
6. Implement notifications, in-process audio, sample notification, and Stop Adhan: complete.
7. Implement manual fixed jamaat mode and scheduling: complete.
8. Implement location detection: complete for one-shot device geolocation; country reverse-geocode method auto-detect remains release work.
9. Implement onboarding wizard: complete.
10. Implement Focus Mode overlay: complete as an in-app/top-level overlay preview and prayer trigger; multi-monitor topmost native shield remains release work.
11. Add localization and RTL verification.
12. Add installer, launch-at-login, updater, and release workflow: installer and launch-at-login complete; signing/updater release feed remains external setup.

## Main Risks

- Windows tray cannot exactly match macOS menu-bar text without an optional floating widget.
- Toast notifications are more reliable with package identity or installer setup.
- Focus overlay must be carefully implemented so it is a reminder, not a hostile lock screen.
- Audio asset provenance should be verified before public redistribution.
- Exact visual parity needs Windows icon replacements for SF Symbols.
- Timezone, locale, and DST edge cases need strong tests.

## Immediate Next Step

Implementation has started with:

- React + TypeScript + Vite scaffold.
- TypeScript port of the PrayerKit calculation core.
- Vitest parity tests for method adapters, solar references, high-latitude behavior, JAKIM/Kemenag golden rows, current waqt, Ishraq, and notification defaults.
- First Windows-style UI preview for the tray label, panel, and five settings tabs.
- Tauri v2 shell under `src-tauri`, with tray menu, show/hide/quit commands, notification/autostart/store/shell plugin wiring, and a Windows app identifier.
- Rust installed locally through rustup (`cargo 1.96.0`, `rustc 1.96.0`, MSVC target).

Native build status:

- Microsoft Visual Studio Build Tools with C++ was installed.
- `npm run tauri:build` completed successfully using `vcvars64.bat` and a local Cargo target directory.
- Built executable: `%LOCALAPPDATA%/prayer-times-windows/cargo-target/release/app.exe`
- MSI installer: `%LOCALAPPDATA%/prayer-times-windows/cargo-target/release/bundle/msi/Prayer Times_0.1.0_x64_en-US.msi`
- NSIS installer: `%LOCALAPPDATA%/prayer-times-windows/cargo-target/release/bundle/nsis/Prayer Times_0.1.0_x64-setup.exe`
- Smoke test: launched the built executable and verified a `Prayer Times` native window process.

Next implementation step:

Completed in this pass:

- Copied upstream Adhan and alert assets into `public/audio`.
- Added Tauri Store-backed settings persistence with localStorage fallback.
- Wired Launch at Login to the Tauri autostart plugin.
- Added one-shot Windows/web geolocation through `navigator.geolocation`.
- Added first-run onboarding controlled by `didCompleteOnboarding`.
- Added live notification checks for prayer time, early reminder, and iqamah reminder events.
- Added in-process sound playback, full Adhan playback, preview controls, and Stop Adhan in the panel.
- Added per-prayer notification toggles and default iqamah reminder settings.
- Rebuilt native Windows artifacts successfully.

Verification completed:

- `npm test`: 16 tests passed.
- `npm run build`: TypeScript and Vite production build passed.
- `npm audit --audit-level=high`: 0 vulnerabilities.
- `npm run tauri:build`: release executable, MSI, and NSIS installer built successfully.
- Native smoke test: launched the built executable and verified a responding `Prayer Times` window process.
- Browser smoke test: local UI loaded at `http://127.0.0.1:5173/` with expected settings/panel surface and no console errors.

Remaining release-grade work that needs product/release inputs:

- Code signing certificate and publisher identity for installer trust.
- Update feed/signing keys for a production updater.
- Optional reverse-geocode provider for country-to-method auto-detect.
- Optional full Windows-native multi-monitor Focus Mode shield beyond the in-app overlay.
- Localization pass for Arabic/Turkish/Bengali UI strings and RTL verification.
